import pool from "../db/db.config";
import {
  User,
  CreateUserRequest,
  LoginRequest,
  AuthResponse,
  Employer,
  EmployerWithDetails,
  Jobseeker,
  JobseekerWithDetails,
} from "../types/user.type";
import { hashPassword, comparePassword, generateToken } from "../utils/helpers";
import { validate as isValidUUID } from "uuid";

export class AuthService {
  async register(userData: CreateUserRequest): Promise<AuthResponse> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Check if user already exists
    const existingUser = await client.query(
      "SELECT id FROM users WHERE email = $1",
      [userData.email.trim().toLowerCase()],
    );

    if (existingUser.rows.length > 0) {
      await client.query("ROLLBACK");
      return {
        success: false,
        message: "User with this email already exists",
      };
    }

    // Hash password
    const hashedPassword = await hashPassword(userData.password);

    // ✅ FIX 1: Use actual company name, not generic ID
    const actualCompanyName = userData.company_name?.trim() || null;

    // Insert new user
    const userResult = await client.query(
      `
      INSERT INTO users (
        name, email, password, user_type, location, contact_number, 
        company_name, role_in_company
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id::text as id, name, email, user_type, location, contact_number, 
               company_name, role_in_company, created_at, updated_at
    `,
      [
        userData.name.trim(),
        userData.email.trim().toLowerCase(),
        hashedPassword,
        userData.user_type,
        userData.location || null,
        userData.contact_number || null,
        actualCompanyName,  // ✅ Use actual name here
        userData.role_in_company || null,
      ],
    );

    const newUser = userResult.rows[0];
    console.log(`✅ Registered user with id: ${newUser.id}`);

    // Validate UUID
    if (!isValidUUID(newUser.id)) {
      await client.query("ROLLBACK");
      throw new Error(`Invalid UUID generated for user: ${newUser.id}`);
    }

    // Company handling for employers
    let company_id: string | null = null;

    if (userData.user_type === "employer") {
      if (userData.company_name && userData.company_password) {
        // Check if company already exists (case-insensitive)
        const existingCompany = await client.query(
          `SELECT id::text as id, name, company_password FROM companies WHERE LOWER(name) = LOWER($1)`,
          [actualCompanyName],  // ✅ Use actual name
        );

        if (existingCompany.rows.length > 0) {
          // Company exists - verify password
          const company = existingCompany.rows[0];
          const isValidPassword = await comparePassword(
            userData.company_password,
            company.company_password,
          );

          if (!isValidPassword) {
            await client.query("ROLLBACK");
            return {
              success: false,
              message: "Invalid company password",
            };
          }

          company_id = company.id;
          console.log("✅ User joined existing company:", company.name);
        } else {
          // ✅ FIX 2: Create new company with ACTUAL name, not generic ID
          const hashedCompanyPassword = await hashPassword(
            userData.company_password,
          );

          const companyResult = await client.query(
            `INSERT INTO companies (name, company_password)
             VALUES ($1, $2)
             RETURNING id::text as id, name`,
            [actualCompanyName, hashedCompanyPassword],  // ✅ Use actual name
          );

          company_id = companyResult.rows[0].id;
          console.log("✅ New company created:", companyResult.rows[0].name);
        }
      }

      // ✅ FIX 3: Insert employer profile with ACTUAL company name
      await client.query(
        `
        INSERT INTO employers (
          user_id,
          company_id,
          company_name,
          role_in_company,
          department,
          can_post_jobs,
          can_manage_candidates,
          created_at,
          updated_at
        ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9)
      `,
        [
          newUser.id,
          company_id,
          actualCompanyName,  // ✅ Use actual name, NOT generic "Company - ID"
          userData.role_in_company || null,
          null,
          true,
          true,
          new Date(),
          new Date(),
        ],
      );

      console.log(`✅ Employer profile created with company_name: ${actualCompanyName}`);
    } else if (userData.user_type === "jobseeker") {
      // Create jobseeker profile
      await client.query(
        `
        INSERT INTO jobseekers (user_id, location, contact_number, skills, created_at, updated_at)
        VALUES ($1::uuid, $2, $3, $4::text[], $5, $6)
      `,
        [
          newUser.id,
          userData.location || null,
          userData.contact_number || null,
          "{}",
          new Date(),
          new Date(),
        ],
      );
    } else if (userData.user_type === "admin") {
      // Create admin profile
      await client.query(
        `
        INSERT INTO admins (user_id, name, email, password_hash, contact_number, role, permissions, created_at, updated_at)
        VALUES ($1::uuid, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
      `,
        [
          newUser.id,
          newUser.name,
          newUser.email,
          hashedPassword,
          userData.contact_number || null,
          "admin",
          JSON.stringify(["all"]),
          new Date(),
          new Date(),
        ],
      );
    }

    await client.query("COMMIT");

    // Prepare user object to return
    const userToReturn: any = { ...newUser };
    if (userData.user_type === "employer") {
      userToReturn.company_id = company_id || null;
      userToReturn.company_name = actualCompanyName || null;  // ✅ Return actual name
    }

    // Generate token
    const token = generateToken(userToReturn);

    return {
      success: true,
      message: "User registered successfully",
      user: userToReturn,
      token: token,
    };
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Registration error:", error.message ?? error);
    return {
      success: false,
      message: error.message || "Registration failed",
    };
  } finally {
    client.release();
  }
}

  async login(
    loginData: LoginRequest & { expected_role?: string },
  ): Promise<AuthResponse> {
    const client = await pool.connect();

    try {
      // Get user with employer/company info
      const result = await client.query(
        `
        SELECT
          u.id::text AS id,
          u.name,
          u.email,
          u.password,
          u.user_type,
          u.created_at,
          u.updated_at,
          e.company_id::text AS company_id,
          e.company_name,
          e.role_in_company,
          c.name AS company_full_name,
          c.logo_url AS company_logo
        FROM users u
        LEFT JOIN employers e ON u.id = e.user_id
        LEFT JOIN companies c ON e.company_id = c.id
        WHERE LOWER(u.email) = $1
      `,
        [loginData.email.trim().toLowerCase()],
      );

      if (result.rows.length === 0) {
        return {
          success: false,
          message: "Invalid email or password",
        };
      }

      const user = result.rows[0];
      console.log(`DEBUG - Found user with id: ${user.id}`);

      // Validate UUID
      if (!isValidUUID(user.id)) {
        console.error(`Invalid UUID for user: ${user.id}`);
        return {
          success: false,
          message: "Invalid user ID format",
        };
      }

      // Verify password using existing helper
      const isPasswordValid = await comparePassword(
        loginData.password,
        user.password,
      );

      if (!isPasswordValid) {
        return {
          success: false,
          message: "Invalid email or password",
        };
      }

      // Verify expected role if provided
      if (
        loginData.expected_role &&
        user.user_type !== loginData.expected_role
      ) {
        return {
          success: false,
          message: `Account type mismatch. This account is registered as ${user.user_type}, but you're trying to login as ${loginData.expected_role}.`,
        };
      }

      // Determine actual company name (prefer employer.company_name then companies.name)
      const actualCompanyName =
        user.user_type === "employer"
          ? user.company_name || user.company_full_name || null
          : null;

      console.log("✅ User logged in with company:", actualCompanyName);

      // Prepare user object to return (remove sensitive fields)
      const userData: any = {
        id: user.id,
        name: user.name,
        email: user.email,
        user_type: user.user_type,
        created_at: user.created_at,
        updated_at: user.updated_at || user.created_at,
      };

      if (user.user_type === "employer") {
        userData.company_id = user.company_id || null;
        userData.company_name = actualCompanyName;
        userData.role_in_company = user.role_in_company || null;
        userData.company_logo = user.company_logo || null;
      }

      // Generate token (use the full user-like object to satisfy the expected type)
      const token = generateToken(userData);

      return {
        success: true,
        message: "Login successful",
        user: userData,
        token,
      };
    } catch (error: any) {
      console.error("Login error:", error.message ?? error);
      return {
        success: false,
        message: error.message || "Login failed",
      };
    } finally {
      client.release();
    }
  }
  async logout(userId: string): Promise<boolean> {
    const client = await pool.connect();

    try {
      const trimmedUserId = userId.trim();
      if (!isValidUUID(trimmedUserId)) {
        console.log(`DEBUG - Invalid UUID format: ${trimmedUserId}`);
        return false;
      }

      // Try to record a logout timestamp on the user record if the column exists.
      // If the column doesn't exist or the update fails, fall back to treating logout
      // as successful since JWTs are stateless (future token blacklist can be added).
      try {
        const now = new Date();
        const result = await client.query(
          "UPDATE users SET last_logout_at = $1, updated_at = $2 WHERE id = $3::uuid RETURNING id",
          [now, now, trimmedUserId],
        );
        if (result.rowCount && result.rowCount > 0) {
          console.log(`User ${trimmedUserId} logged out (timestamp recorded)`);
          return true;
        }
        console.log(`User ${trimmedUserId} logout: user not found`);
        return false;
      } catch (innerErr: any) {
        // Likely the last_logout_at column doesn't exist; log and return success for now.
        console.warn(
          `Logout DB update failed for user ${trimmedUserId}, treating as success:`,
          innerErr.message,
        );
        console.log(`User ${trimmedUserId} logged out`);
        return true;
      }
    } catch (error: any) {
      console.error(`Logout error for id ${userId}:`, error.message);
      return false;
    } finally {
      client.release();
    }
  }

  // ADD THESE TWO METHODS TO YOUR src/services/auth.service.ts FILE
// Place them at the end of the AuthService class (before the closing brace)

/**
 * Get user by email address
 * Used for password reset functionality
 */
async getUserByEmail(email: string): Promise<User | null> {
  const client = await pool.connect();
  
  try {
    const trimmedEmail = email.trim().toLowerCase();
    console.log(`DEBUG - Querying user with email: ${trimmedEmail}`);

    const result = await client.query(
      `SELECT id::text as id, name, email, user_type, location, contact_number, 
             company_name, role_in_company, created_at, updated_at
       FROM users WHERE LOWER(email) = $1`,
      [trimmedEmail]
    );

    if (!result.rows[0]) {
      console.log(`DEBUG - No user found for email: ${trimmedEmail}`);
      return null;
    }

    return result.rows[0];
  } catch (error: any) {
    console.error(`Get user by email error for ${email}:`, error.message);
    return null;
  } finally {
    client.release();
  }
}

/**
 * Update user password
 * Used for password reset functionality
 */
async updatePassword(userId: string, newPassword: string): Promise<boolean> {
  const client = await pool.connect();

  try {
    const trimmedUserId = userId.trim();
    
    if (!isValidUUID(trimmedUserId)) {
      console.log(`DEBUG - Invalid UUID format: ${trimmedUserId}`);
      return false;
    }

    // Hash the new password
    const hashedPassword = await hashPassword(newPassword);
    
    // Update password in database
    const result = await client.query(
      'UPDATE users SET password = $1, updated_at = $2 WHERE id = $3::uuid',
      [hashedPassword, new Date(), trimmedUserId]
    );

    const success = (result.rowCount ?? 0) > 0;
    
    if (success) {
      console.log(`✅ Password updated successfully for user: ${trimmedUserId}`);
    } else {
      console.log(`⚠️ No user found to update password for: ${trimmedUserId}`);
    }

    return success;
  } catch (error: any) {
    console.error(`Update password error for ${userId}:`, error.message);
    return false;
  } finally {
    client.release();
  }
}

  async getUserById(userId: string): Promise<User | null> {
    const client = await pool.connect();

    try {
      const trimmedUserId = userId.trim();
      console.log(`DEBUG - Querying user with id: ${trimmedUserId}`);

      if (!isValidUUID(trimmedUserId)) {
        console.log(`DEBUG - Invalid UUID format: ${trimmedUserId}`);
        return null;
      }

      const result = await client.query(
        `
        SELECT id::text as id, name, email, user_type, location, contact_number, 
               company_name, role_in_company, created_at, updated_at
        FROM users WHERE id = $1::uuid
      `,
        [trimmedUserId],
      );

      if (!result.rows[0]) {
        console.log(`DEBUG - No user found for id: ${trimmedUserId}`);
        return null;
      }

      return result.rows[0];
    } catch (error: any) {
      console.error(`Get user error for id ${userId}:`, error.message);
      return null;
    } finally {
      client.release();
    }
  }

  async getEmployerByUserId(userId: string): Promise<Employer | null> {
    const client = await pool.connect();

    try {
      const trimmedUserId = userId.trim();
      console.log(`DEBUG - Querying employer with user_id: ${trimmedUserId}`);

      if (!isValidUUID(trimmedUserId)) {
        console.log(`DEBUG - Invalid UUID format: ${trimmedUserId}`);
        return null;
      }

      const result = await client.query(
        `
        SELECT id::text as id, user_id::text as user_id, company_id::text as company_id, 
               role_in_company, department, can_post_jobs, can_manage_candidates, 
               created_at, updated_at
        FROM employers WHERE user_id = $1::uuid
      `,
        [trimmedUserId],
      );

      if (!result.rows[0]) {
        console.log(`DEBUG - No employer found for user_id: ${trimmedUserId}`);
        return null;
      }

      return result.rows[0];
    } catch (error: any) {
      console.error(`Get employer error for user_id ${userId}:`, error.message);
      return null;
    } finally {
      client.release();
    }
  }

  async getEmployerWithDetails(
    employerId: string,
  ): Promise<EmployerWithDetails | null> {
    const client = await pool.connect();

    try {
      const trimmedEmployerId = employerId.trim();
      if (!isValidUUID(trimmedEmployerId)) {
        console.log(`DEBUG - Invalid UUID format: ${trimmedEmployerId}`);
        return null;
      }

      const result = await client.query(
        `
        SELECT 
          e.id::text as id, e.user_id::text as user_id, e.company_id::text as company_id, 
          e.role_in_company, e.department, e.can_post_jobs, e.can_manage_candidates, 
          e.created_at, e.updated_at,
          u.name, u.email, u.user_type, u.location, u.contact_number, u.company_name,
          c.id::text as company_id_full, c.name as company_name_full, 
          c.description as company_description, c.industry, c.company_size, 
          c.website_url, c.logo_url, c.is_verified, c.created_at as company_created_at,
          c.updated_at as company_updated_at
        FROM employers e
        INNER JOIN users u ON e.user_id = u.id
        LEFT JOIN companies c ON e.company_id = c.id
        WHERE e.user_id = $1::uuid
      `,
        [trimmedEmployerId],
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        user_id: row.user_id,
        company_id: row.company_id,
        role_in_company: row.role_in_company,
        department: row.department,
        can_post_jobs: row.can_post_jobs,
        can_manage_candidates: row.can_manage_candidates,
        created_at: row.created_at,
        updated_at: row.updated_at,
        user: {
          id: row.user_id,
          name: row.name,
          email: row.email,
          password: "",
          user_type: row.user_type,
          location: row.location,
          contact_number: row.contact_number,
          company_name: row.company_name,
          role_in_company: row.role_in_company,
          created_at: row.created_at,
          updated_at: row.updated_at,
        },
        company: row.company_id
          ? {
              id: row.company_id_full,
              name: row.company_name_full,
              description: row.company_description,
              industry: row.industry,
              company_size: row.company_size,
              website_url: row.website_url,
              logo_url: row.logo_url,
              is_verified: row.is_verified || false,
              created_at: row.company_created_at || new Date(),
              updated_at: row.company_updated_at || new Date(),
            }
          : undefined,
      };
    } catch (error: any) {
      console.error(
        `Get employer with details error for id ${employerId}:`,
        error.message,
      );
      return null;
    } finally {
      client.release();
    }
  }

  async getJobseekerByUserId(userId: string): Promise<Jobseeker | null> {
    const client = await pool.connect();

    try {
      const trimmedUserId = userId.trim();
      if (!isValidUUID(trimmedUserId)) {
        console.log(`DEBUG - Invalid UUID format: ${trimmedUserId}`);
        return null;
      }

      const result = await client.query(
        `
        SELECT id::text as id, user_id::text as user_id, location, contact_number, 
               skills, experience_level, preferred_salary_min, preferred_salary_max, 
               availability, profile_picture, bio, resume_url, portfolio_url, 
               created_at, updated_at
        FROM jobseekers WHERE user_id = $1::uuid
      `,
        [trimmedUserId],
      );

      if (!result.rows[0]) {
        console.log(`DEBUG - No jobseeker found for user_id: ${trimmedUserId}`);
        return null;
      }

      return result.rows[0];
    } catch (error: any) {
      console.error(
        `Get jobseeker error for user_id ${userId}:`,
        error.message,
      );
      return null;
    } finally {
      client.release();
    }
  }

  async getJobseekerWithDetails(
    jobseekerId: string,
  ): Promise<JobseekerWithDetails | null> {
    const client = await pool.connect();

    try {
      const trimmedJobseekerId = jobseekerId.trim();
      if (!isValidUUID(trimmedJobseekerId)) {
        console.log(`DEBUG - Invalid UUID format: ${trimmedJobseekerId}`);
        return null;
      }

      const result = await client.query(
        `
        SELECT 
          j.id::text as id, j.user_id::text as user_id, j.location, j.contact_number, 
          j.skills, j.experience_level, j.preferred_salary_min, j.preferred_salary_max, 
          j.availability, j.profile_picture, j.bio, j.resume_url, j.portfolio_url, 
          j.created_at, j.updated_at,
          u.name, u.email, u.user_type, u.location as user_location, 
          u.contact_number as user_contact
        FROM jobseekers j
        INNER JOIN users u ON j.user_id = u.id
        WHERE j.user_id = $1::uuid
      `,
        [trimmedJobseekerId],
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        user_id: row.user_id,
        location: row.location,
        contact_number: row.contact_number,
        skills: row.skills,
        experience_level: row.experience_level,
        preferred_salary_min: row.preferred_salary_min,
        preferred_salary_max: row.preferred_salary_max,
        availability: row.availability,
        profile_picture: row.profile_picture,
        bio: row.bio,
        resume_url: row.resume_url,
        portfolio_url: row.portfolio_url,
        created_at: row.created_at,
        updated_at: row.updated_at,
        user: {
          id: row.user_id,
          name: row.name,
          email: row.email,
          password: "",
          user_type: row.user_type,
          location: row.user_location,
          contact_number: row.user_contact,
          created_at: row.created_at,
          updated_at: row.updated_at,
        },
      };
    } catch (error: any) {
      console.error(
        `Get jobseeker with details error for id ${jobseekerId}:`,
        error.message,
      );
      return null;
    } finally {
      client.release();
    }
  }

  async updateUserProfile(
    userId: string,
    updateData: Partial<User>,
  ): Promise<User | null> {
    const client = await pool.connect();

    try {
      const trimmedUserId = userId.trim();
      if (!isValidUUID(trimmedUserId)) {
        console.log(`DEBUG - Invalid UUID format: ${trimmedUserId}`);
        return null;
      }

      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramCount = 0;

      const updatableFields = [
        "name",
        "location",
        "contact_number",
        "company_name",
        "role_in_company",
      ];

      Object.entries(updateData).forEach(([key, value]) => {
        if (updatableFields.includes(key) && value !== undefined) {
          paramCount++;
          updateFields.push(`${key} = $${paramCount}`);
          updateValues.push(value);
        }
      });

      if (updateFields.length === 0) {
        return this.getUserById(trimmedUserId);
      }

      paramCount++;
      updateFields.push(`updated_at = $${paramCount}`);
      updateValues.push(new Date());

      paramCount++;
      updateValues.push(trimmedUserId);

      const updateQuery = `
        UPDATE users 
        SET ${updateFields.join(", ")}
        WHERE id = $${paramCount}::uuid
        RETURNING id::text as id, name, email, user_type, location, contact_number, 
                 company_name, role_in_company, created_at, updated_at
      `;

      const result = await client.query(updateQuery, updateValues);
      return result.rows[0] || null;
    } catch (error: any) {
      console.error(
        `Update user profile error for id ${userId}:`,
        error.message,
      );
      return null;
    } finally {
      client.release();
    }
  }

  async updateJobseekerProfile(
    userId: string,
    updateData: Partial<Jobseeker>,
  ): Promise<Jobseeker | null> {
    const client = await pool.connect();

    try {
      const trimmedUserId = userId.trim();
      if (!isValidUUID(trimmedUserId)) {
        console.log(`DEBUG - Invalid UUID format: ${trimmedUserId}`);
        return null;
      }

      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramCount = 0;

      const updatableFields = [
        "location",
        "contact_number",
        "skills",
        "experience_level",
        "preferred_salary_min",
        "preferred_salary_max",
        "availability",
        "profile_picture",
        "bio",
        "resume_url",
        "portfolio_url",
      ];

      Object.entries(updateData).forEach(([key, value]) => {
        if (updatableFields.includes(key) && value !== undefined) {
          paramCount++;
          // Handle skills array properly
          if (key === "skills" && Array.isArray(value)) {
            updateFields.push(`${key} = $${paramCount}::text[]`);
            updateValues.push(value);
          } else {
            updateFields.push(`${key} = $${paramCount}`);
            updateValues.push(value);
          }
        }
      });

      if (updateFields.length === 0) {
        return this.getJobseekerByUserId(trimmedUserId);
      }

      paramCount++;
      updateFields.push(`updated_at = $${paramCount}`);
      updateValues.push(new Date());

      paramCount++;
      updateValues.push(trimmedUserId);

      const updateQuery = `
        UPDATE jobseekers 
        SET ${updateFields.join(", ")}
        WHERE user_id = $${paramCount}::uuid
        RETURNING id::text as id, user_id::text as user_id, location, contact_number, 
                 skills, experience_level, preferred_salary_min, preferred_salary_max, 
                 availability, profile_picture, bio, resume_url, portfolio_url, 
                 created_at, updated_at
      `;

      const result = await client.query(updateQuery, updateValues);
      return result.rows[0] || null;
    } catch (error: any) {
      console.error(
        `Update jobseeker profile error for id ${userId}:`,
        error.message,
      );
      return null;
    } finally {
      client.release();
    }
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<boolean> {
    const client = await pool.connect();

    try {
      const trimmedUserId = userId.trim();
      if (!isValidUUID(trimmedUserId)) {
        console.log(`DEBUG - Invalid UUID format: ${trimmedUserId}`);
        return false;
      }

      const userResult = await client.query(
        "SELECT password FROM users WHERE id = $1::uuid",
        [trimmedUserId],
      );

      if (userResult.rows.length === 0) {
        return false;
      }

      const isCurrentPasswordValid = await comparePassword(
        currentPassword,
        userResult.rows[0].password,
      );

      if (!isCurrentPasswordValid) {
        return false;
      }

      const hashedNewPassword = await hashPassword(newPassword);

      await client.query(
        "UPDATE users SET password = $1, updated_at = $2 WHERE id = $3::uuid",
        [hashedNewPassword, new Date(), trimmedUserId],
      );

      return true;
    } catch (error: any) {
      console.error(`Change password error for id ${userId}:`, error.message);
      return false;
    } finally {
      client.release();
    }
  }

  async deleteUser(userId: string): Promise<boolean> {
    const client = await pool.connect();

    try {
      const trimmedUserId = userId.trim();
      if (!isValidUUID(trimmedUserId)) {
        console.log(`DEBUG - Invalid UUID format: ${trimmedUserId}`);
        return false;
      }

      await client.query("BEGIN");

      await client.query("DELETE FROM employers WHERE user_id = $1::uuid", [
        trimmedUserId,
      ]);
      await client.query("DELETE FROM jobseekers WHERE user_id = $1::uuid", [
        trimmedUserId,
      ]);
      await client.query("DELETE FROM admins WHERE user_id = $1::uuid", [
        trimmedUserId,
      ]);

      const result = await client.query(
        "DELETE FROM users WHERE id = $1::uuid",
        [trimmedUserId],
      );

      await client.query("COMMIT");
      return (result.rowCount ?? 0) > 0;
    } catch (error: any) {
      await client.query("ROLLBACK");
      console.error(`Delete user error for id ${userId}:`, error.message);
      return false;
    } finally {
      client.release();
    }
  }

  async verifyUserExists(userId: string): Promise<boolean> {
    const client = await pool.connect();

    try {
      const trimmedUserId = userId.trim();
      if (!isValidUUID(trimmedUserId)) {
        console.log(`DEBUG - Invalid UUID format: ${trimmedUserId}`);
        return false;
      }

      const result = await client.query(
        "SELECT id FROM users WHERE id = $1::uuid",
        [trimmedUserId],
      );
      return result.rows.length > 0;
    } catch (error: any) {
      console.error(
        `Verify user exists error for id ${userId}:`,
        error.message,
      );
      return false;
    } finally {
      client.release();
    }
  }
}