import pool from '../db/db.config';
import { User, CreateUserRequest, LoginRequest, AuthResponse, Employer, EmployerWithDetails, Jobseeker, JobseekerWithDetails } from '../types/user.type';
import { hashPassword, comparePassword, generateToken } from '../utils/helpers';
import { validate as isValidUUID } from 'uuid';

export class AuthService {
  async register(userData: CreateUserRequest): Promise<AuthResponse> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check if user already exists
      const existingUser = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [userData.email.trim()]
      );

      if (existingUser.rows.length > 0) {
        return {
          success: false,
          message: 'User with this email already exists'
        };
      }

      // Hash password
      const hashedPassword = await hashPassword(userData.password);
      
      // Hash company password if provided
      let hashedCompanyPassword = null;
      if (userData.company_password) {
        hashedCompanyPassword = await hashPassword(userData.company_password);
      }

      // Insert new user - ensure UUID is generated and returned as string
      const userResult = await client.query(`
        INSERT INTO users (
          name, email, password, user_type, location, contact_number, 
          company_name, company_password, role_in_company
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id::text as id, name, email, user_type, location, contact_number, 
                 company_name, role_in_company, created_at, updated_at
      `, [
        userData.name,
        userData.email.trim(),
        hashedPassword,
        userData.user_type,
        userData.location || null,
        userData.contact_number || null,
        userData.company_name || null,
        hashedCompanyPassword,
        userData.role_in_company || null
      ]);

      const newUser = userResult.rows[0];
      console.log(`DEBUG - Registered user with id: ${newUser.id}`);

      // Validate UUID
      if (!isValidUUID(newUser.id)) {
        throw new Error(`Invalid UUID generated for user: ${newUser.id}`);
      }

      // Create associated profile based on user type
      if (userData.user_type === 'employer') {
        await client.query(`
          INSERT INTO employers (user_id, role_in_company, can_post_jobs, can_manage_candidates)
          VALUES ($1, $2, $3, $4)
        `, [newUser.id, userData.role_in_company || null, true, true]);
      } else if (userData.user_type === 'jobseeker') {
        await client.query(`
          INSERT INTO jobseekers (user_id, location, contact_number, skills)
          VALUES ($1, $2, $3, $4)
        `, [newUser.id, userData.location || null, userData.contact_number || null, []]);
      } else if (userData.user_type === 'admin') {
        await client.query(`
          INSERT INTO admins (user_id, contact_number, role, permissions)
          VALUES ($1, $2, $3, $4)
        `, [newUser.id, userData.contact_number || null, 'admin', ['all']]);
      }

      await client.query('COMMIT');

      const token = generateToken(newUser);

      return {
        success: true,
        message: 'User registered successfully',
        token,
        user: newUser
      };

    } catch (error: any) {
      await client.query('ROLLBACK');
      console.error('Registration error:', error.message);
      return {
        success: false,
        message: error.message || 'Registration failed'
      };
    } finally {
      client.release();
    }
  }

  async login(loginData: LoginRequest): Promise<AuthResponse> {
    const client = await pool.connect();
    
    try {
      // Find user by email - ensure UUID is returned as string
      const result = await client.query(`
        SELECT id::text as id, name, email, password, user_type, location, contact_number, 
               company_name, role_in_company, created_at, updated_at
        FROM users WHERE email = $1
      `, [loginData.email.trim()]);

      if (result.rows.length === 0) {
        return {
          success: false,
          message: 'Invalid email or password'
        };
      }

      const user = result.rows[0];
      console.log(`DEBUG - Found user with id: ${user.id}`);

      // Validate UUID
      if (!isValidUUID(user.id)) {
        console.error(`Invalid UUID for user: ${user.id}`);
        return {
          success: false,
          message: 'Invalid user ID format'
        };
      }

      // Verify password
      const isPasswordValid = await comparePassword(loginData.password, user.password);
      
      if (!isPasswordValid) {
        return {
          success: false,
          message: 'Invalid email or password'
        };
      }

      // Remove password from user object
      const { password, ...userWithoutPassword } = user;
      
      // Generate token with UUID string
      const token = generateToken(userWithoutPassword);

      return {
        success: true,
        message: 'Login successful',
        token,
        user: userWithoutPassword
      };

    } catch (error: any) {
      console.error('Login error:', error.message);
      return {
        success: false,
        message: 'Login failed'
      };
    } finally {
      client.release();
    }
  }

  async getUserById(userId: string): Promise<User | null> {
    const client = await pool.connect();
    
    try {
      const trimmedUserId = userId.trim();
      console.log(`DEBUG - Querying user with id: ${trimmedUserId}`);

      // Validate UUID format
      if (!isValidUUID(trimmedUserId)) {
        console.log(`DEBUG - Invalid UUID format: ${trimmedUserId}`);
        return null;
      }

      const result = await client.query(`
        SELECT id::text as id, name, email, user_type, location, contact_number, 
               company_name, role_in_company, created_at, updated_at
        FROM users WHERE id = $1::uuid
      `, [trimmedUserId]);

      if (!result.rows[0]) {
        console.log(`DEBUG - No user found for id: ${trimmedUserId}`);
      }
      return result.rows[0] || null;
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

      const result = await client.query(`
        SELECT id::text as id, user_id::text as user_id, company_id::text as company_id, 
               role_in_company, department, can_post_jobs, can_manage_candidates, 
               created_at, updated_at
        FROM employers WHERE user_id = $1::uuid
      `, [trimmedUserId]);

      if (!result.rows[0]) {
        console.log(`DEBUG - No employer found for user_id: ${trimmedUserId}`);
      }
      return result.rows[0] || null;
    } catch (error: any) {
      console.error(`Get employer error for user_id ${userId}:`, error.message);
      return null;
    } finally {
      client.release();
    }
  }

  async getEmployerWithDetails(employerId: string): Promise<EmployerWithDetails | null> {
    const client = await pool.connect();
    
    try {
      const trimmedEmployerId = employerId.trim();
      if (!isValidUUID(trimmedEmployerId)) {
        console.log(`DEBUG - Invalid UUID format: ${trimmedEmployerId}`);
        return null;
      }

      const result = await client.query(`
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
        WHERE e.id = $1::uuid
      `, [trimmedEmployerId]);

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
          password: '',
          user_type: row.user_type,
          location: row.location,
          contact_number: row.contact_number,
          company_name: row.company_name,
          role_in_company: row.role_in_company,
          created_at: row.created_at,
          updated_at: row.updated_at
        },
        company: row.company_id ? {
          id: row.company_id_full,
          name: row.company_name_full,
          description: row.company_description,
          industry: row.industry,
          company_size: row.company_size,
          website_url: row.website_url,
          logo_url: row.logo_url,
          is_verified: row.is_verified || false,
          created_at: row.company_created_at || new Date(),
          updated_at: row.company_updated_at || new Date()
        } : undefined
      };
    } catch (error: any) {
      console.error(`Get employer with details error for id ${employerId}:`, error.message);
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

      const result = await client.query(`
        SELECT id::text as id, user_id::text as user_id, location, contact_number, 
               skills, experience_level, preferred_salary_min, preferred_salary_max, 
               availability, profile_picture, bio, resume_url, portfolio_url, 
               created_at, updated_at
        FROM jobseekers WHERE user_id = $1::uuid
      `, [trimmedUserId]);

      if (!result.rows[0]) {
        console.log(`DEBUG - No jobseeker found for user_id: ${trimmedUserId}`);
      }
      return result.rows[0] || null;
    } catch (error: any) {
      console.error(`Get jobseeker error for user_id ${userId}:`, error.message);
      return null;
    } finally {
      client.release();
    }
  }

  async getJobseekerWithDetails(jobseekerId: string): Promise<JobseekerWithDetails | null> {
    const client = await pool.connect();
    
    try {
      const trimmedJobseekerId = jobseekerId.trim();
      if (!isValidUUID(trimmedJobseekerId)) {
        console.log(`DEBUG - Invalid UUID format: ${trimmedJobseekerId}`);
        return null;
      }

      const result = await client.query(`
        SELECT 
          j.id::text as id, j.user_id::text as user_id, j.location, j.contact_number, 
          j.skills, j.experience_level, j.preferred_salary_min, j.preferred_salary_max, 
          j.availability, j.profile_picture, j.bio, j.resume_url, j.portfolio_url, 
          j.created_at, j.updated_at,
          u.name, u.email, u.user_type, u.location as user_location, 
          u.contact_number as user_contact
        FROM jobseekers j
        INNER JOIN users u ON j.user_id = u.id
        WHERE j.id = $1::uuid
      `, [trimmedJobseekerId]);

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
          password: '',
          user_type: row.user_type,
          location: row.user_location,
          contact_number: row.user_contact,
          created_at: row.created_at,
          updated_at: row.updated_at
        }
      };
    } catch (error: any) {
      console.error(`Get jobseeker with details error for id ${jobseekerId}:`, error.message);
      return null;
    } finally {
      client.release();
    }
  }

  async updateUserProfile(userId: string, updateData: Partial<User>): Promise<User | null> {
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

      const updatableFields = ['name', 'location', 'contact_number', 'company_name', 'role_in_company'];

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
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}::uuid
        RETURNING id::text as id, name, email, user_type, location, contact_number, 
                 company_name, role_in_company, created_at, updated_at
      `;

      const result = await client.query(updateQuery, updateValues);
      return result.rows[0] || null;
    } catch (error: any) {
      console.error(`Update user profile error for id ${userId}:`, error.message);
      return null;
    } finally {
      client.release();
    }
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<boolean> {
    const client = await pool.connect();
    
    try {
      const trimmedUserId = userId.trim();
      if (!isValidUUID(trimmedUserId)) {
        console.log(`DEBUG - Invalid UUID format: ${trimmedUserId}`);
        return false;
      }

      const userResult = await client.query(
        'SELECT password FROM users WHERE id = $1::uuid',
        [trimmedUserId]
      );

      if (userResult.rows.length === 0) {
        return false;
      }

      const isCurrentPasswordValid = await comparePassword(currentPassword, userResult.rows[0].password);
      
      if (!isCurrentPasswordValid) {
        return false;
      }

      const hashedNewPassword = await hashPassword(newPassword);

      await client.query(
        'UPDATE users SET password = $1, updated_at = $2 WHERE id = $3::uuid',
        [hashedNewPassword, new Date(), trimmedUserId]
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

      await client.query('BEGIN');

      await client.query('DELETE FROM employers WHERE user_id = $1::uuid', [trimmedUserId]);
      await client.query('DELETE FROM jobseekers WHERE user_id = $1::uuid', [trimmedUserId]);
      await client.query('DELETE FROM admins WHERE user_id = $1::uuid', [trimmedUserId]);

      const result = await client.query('DELETE FROM users WHERE id = $1::uuid', [trimmedUserId]);
      
      await client.query('COMMIT');
      return (result.rowCount ?? 0) > 0;
    } catch (error: any) {
      await client.query('ROLLBACK');
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

      const result = await client.query('SELECT id FROM users WHERE id = $1::uuid', [trimmedUserId]);
      return result.rows.length > 0;
    } catch (error: any) {
      console.error(`Verify user exists error for id ${userId}:`, error.message);
      return false;
    } finally {
      client.release();
    }
  }
}