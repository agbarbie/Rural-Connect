import pool from '../db/db.config.js';
import { User, CreateUserRequest, LoginRequest, AuthResponse } from '../utils/types/users.types';
import { hashPassword, comparePassword, generateToken } from '../utils/helpers';

export class AuthService {
  async register(userData: CreateUserRequest): Promise<AuthResponse> {
    const client = await pool.connect();
    
    try {
      // Check if user already exists
      const existingUser = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [userData.email]
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

      // Insert new user
      const result = await client.query(`
        INSERT INTO users (
          name, email, password, user_type, location, contact_number, 
          company_name, company_password, role_in_company
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, name, email, user_type, location, contact_number, 
                 company_name, role_in_company, created_at, updated_at
      `, [
        userData.name,
        userData.email,
        hashedPassword,
        userData.user_type,
        userData.location || null,
        userData.contact_number || null,
        userData.company_name || null,
        hashedCompanyPassword,
        userData.role_in_company || null
      ]);

      const newUser = result.rows[0];
      const token = generateToken(newUser);

      return {
        success: true,
        message: 'User registered successfully',
        token,
        user: newUser
      };

    } catch (error: any) {
      console.error('Registration error:', error);
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
      // Find user by email
      const result = await client.query(`
        SELECT id, name, email, password, user_type, location, contact_number, 
               company_name, role_in_company, created_at, updated_at
        FROM users WHERE email = $1
      `, [loginData.email]);

      if (result.rows.length === 0) {
        return {
          success: false,
          message: 'Invalid email or password'
        };
      }

      const user = result.rows[0];

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
      const token = generateToken(userWithoutPassword);

      return {
        success: true,
        message: 'Login successful',
        token,
        user: userWithoutPassword
      };

    } catch (error: any) {
      console.error('Login error:', error);
      return {
        success: false,
        message: 'Login failed'
      };
    } finally {
      client.release();
    }
  }

  async getUserById(userId: number): Promise<User | null> {
    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        SELECT id, name, email, user_type, location, contact_number, 
               company_name, role_in_company, created_at, updated_at
        FROM users WHERE id = $1
      `, [userId]);

      return result.rows[0] || null;
    } catch (error) {
      console.error('Get user error:', error);
      return null;
    } finally {
      client.release();
    }
  }
}