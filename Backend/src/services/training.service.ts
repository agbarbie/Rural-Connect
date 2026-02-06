// training.service.ts - COMPLETE FIXED VERSION with safe phone_number handling

import { Pool } from 'pg';
import {
  Training,
  CreateTrainingRequest,
  UpdateTrainingRequest,
  TrainingSearchParams,
  TrainingListResponse,
  TrainingStatsResponse,
  TrainingEnrollment,
  TrainingApplication,
  ShortlistDecisionRequest,
  MarkCompletionRequest,
  SubmitApplicationRequest,
} from '../types/training.type';
import { join } from 'path';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid'; 

interface NotificationMetadata {
  training_id?: string;
  training_title?: string;
  application_id?: string;
  user_id?: string;
  applicant_name?: string;
  user_name?: string;
  jobseeker_name?: string;
  applicant_email?: string;
  user_email?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  profile_image?: string;
  motivation_letter?: string;
  applied_at?: Date | string;
  enrollment_id?: string;
  [key: string]: any;
}

interface PaginatedResult<T> {
  trainings: T[];
  pagination: {
    current_page: number;
    total_pages: number;
    page_size: number;
    total_count: number;
    has_next: boolean;
    has_previous: boolean;
  };
}

function generateVerificationCode(): string {
  const hex = crypto.randomBytes(6).toString('hex').toUpperCase();
  return `CERT-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
}

export class TrainingService {
  private phoneNumberColumnExists: boolean | null = null;

  constructor(private db: Pool) {
    this.verifyDatabaseTables();
    this.checkPhoneNumberColumn();
  }

  // ✅ NEW: Check if phone_number column exists in users table
  private async checkPhoneNumberColumn(): Promise<void> {
    try {
      const result = await this.db.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'phone_number'
      `);
      this.phoneNumberColumnExists = result.rows.length > 0;
      console.log(`📞 phone_number column ${this.phoneNumberColumnExists ? 'EXISTS' : 'DOES NOT EXIST'} in users table`);
    } catch (error: any) {
      console.error('❌ Error checking phone_number column:', error.message);
      this.phoneNumberColumnExists = false;
    }
  }

  // ✅ NEW: Helper method to safely get user details
 // ✅ FINAL FIX: Use contact_number instead of phone_number
private async getUserDetails(userId: string): Promise<any> {
  const query = `
    SELECT 
      id, 
      first_name, 
      last_name, 
      email, 
      contact_number,
      profile_image
    FROM users 
    WHERE id = $1
  `;
  
  const result = await this.db.query(query, [userId]);
  
  if (result.rows.length > 0) {
    const user = result.rows[0];
    return {
      id: user.id,
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      email: user.email || '',
      phone_number: user.contact_number || '', // ✅ Map contact_number to phone_number
      contact_number: user.contact_number || '', // ✅ Include both for compatibility
      profile_image: user.profile_image || ''
    };
  }
  
  return null;
}

  private async verifyDatabaseTables(): Promise<void> {
    try {
      console.log('🔍 Verifying training-related database tables...');
      
      const tables = [
        'trainings',
        'training_sessions',
        'training_outcomes',
        'training_applications',
        'training_enrollments',
        'session_attendance',
        'certificate_verifications',
        'training_reviews',
        'notifications'
      ];

      for (const table of tables) {
        try {
          await this.db.query(`SELECT 1 FROM ${table} LIMIT 1`);
          console.log(`  ✓ ${table} table accessible`);
        } catch (error: any) {
          console.error(`  ✗ ${table} table NOT accessible:`, error.message);
        }
      }
    } catch (error: any) {
      console.error('❌ Error verifying database tables:', error.message);
    }
  }

  // ==========================================================================
  // 1. NOTIFICATION SYSTEM - FIXED WITH PROPER METADATA
  // ==========================================================================

  async createNotification(
    userId: string,
    type: string,
    message: string,
    metadata: Record<string, any>
  ): Promise<void> {
    try {
      const title = this.generateNotificationTitle(type, message);
      const relatedId: string | null =
        metadata?.enrollment_id ?? metadata?.training_id ?? metadata?.application_id ?? null;

      const meta: Record<string, any> = { ...(metadata || {}) };

      // ✅ FIX 1: Always enrich metadata with user details
      const hasName =
        Boolean(meta.applicant_name) || Boolean(meta.jobseeker_name) || Boolean(meta.user_name) || Boolean(meta.name);

      if (!hasName) {
        try {
          let lookupUserId: string | null = meta.user_id ?? null;

          if (!lookupUserId && meta.application_id) {
            const appRes = await this.db.query('SELECT user_id FROM training_applications WHERE id = $1', [meta.application_id]);
            if (appRes.rows.length > 0) lookupUserId = appRes.rows[0].user_id;
          }

          if (!lookupUserId && meta.enrollment_id) {
            const enrRes = await this.db.query('SELECT user_id FROM training_enrollments WHERE id = $1', [meta.enrollment_id]);
            if (enrRes.rows.length > 0) lookupUserId = enrRes.rows[0].user_id;
          }

          if (lookupUserId) {
            const user = await this.getUserDetails(lookupUserId);
            if (user) {
              const builtName = `${user.first_name || ''} ${user.last_name || ''}`.trim()
                || (user.email ? user.email.split('@')[0].replace(/[_.-]/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : null)
                || 'User';
              
              // ✅ Populate ALL name variations for consistency
              meta.applicant_name = builtName;
              meta.jobseeker_name = builtName;
              meta.user_name = builtName;
              meta.user_id = lookupUserId;
              meta.first_name = user.first_name || '';
              meta.last_name = user.last_name || '';
              meta.email = user.email || '';
              meta.user_email = user.email || '';
              meta.applicant_email = user.email || '';
              meta.phone_number = user.phone_number || '';
              meta.profile_image = user.profile_image || '';
            }
          }
        } catch (innerErr: any) {
          console.error('⚠️ createNotification metadata enrichment failed:', innerErr.message);
        }
      }

      const tableExists = await this.db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'notifications'
        );
      `);
      if (!tableExists.rows[0]?.exists) return;

      await this.db.query(
        `INSERT INTO notifications (user_id, type, title, message, metadata, related_id, created_at, is_read)
         VALUES ($1, $2, $3, $4, $5, $6::UUID, CURRENT_TIMESTAMP, false)`,
        [userId, type, title, message, JSON.stringify(meta), relatedId]
      );
      
      console.log('✅ Notification created:', { userId, type, title });
    } catch (err: any) {
      console.error('❌ createNotification:', err.message);
    }
  }

  private generateNotificationTitle(type: string, message: string): string {
    const map: Record<string, string> = {
      new_training:              '🎓 New Training Available',
      training_updated:          '✏️  Training Updated',
      training_deleted:          '🗑️  Training Removed',
      training_suspended:        '⏸️  Training Suspended',
      training_published:        '📢 Training Published',
      application_submitted:     '📝 New Application',
      application_shortlisted:   '✅ Application Shortlisted',
      application_rejected:      '❌ Application Rejected',
      training_completed_mark:   '🏁 Training Completion Marked',
      certificate_issued:        '🎓 Certificate Ready',
      new_enrollment:            '👤 New Enrollment',
    };
    return map[type] || message.split('.')[0].substring(0, 255) || 'Training Update';
  }

  async notifyEnrolledTrainees(
    trainingId: string,
    type: string,
    message: string,
    extraMeta: Record<string, any> = {}
  ): Promise<void> {
    try {
      const rows = await this.db.query(
        `SELECT DISTINCT user_id FROM training_enrollments
         WHERE training_id = $1 AND status IN ('enrolled')`,
        [trainingId]
      );
      await Promise.all(
        rows.rows.map(r =>
          this.createNotification(r.user_id, type, message, { training_id: trainingId, ...extraMeta })
        )
      );
    } catch (err: any) {
      console.error('❌ notifyEnrolledTrainees:', err.message);
    }
  }

  async notifyJobseekersAboutNewTraining(
    trainingId: string,
    title: string,
    category: string,
    providerName: string
  ): Promise<void> {
    try {
      const BATCH = 1000;
      let offset = 0;
      while (true) {
        const rows = await this.db.query(
          `SELECT id FROM users WHERE user_type = 'jobseeker' AND deleted_at IS NULL ORDER BY id LIMIT $1 OFFSET $2`,
          [BATCH, offset]
        );
        if (rows.rows.length === 0) break;
        await Promise.all(
          rows.rows.map(r =>
            this.createNotification(r.id, 'new_training',
              `New training available: "${title}" by ${providerName}`,
              { training_id: trainingId, category, employer_name: providerName }
            )
          )
        );
        offset += BATCH;
        if (rows.rows.length < BATCH) break;
      }
    } catch (err: any) {
      console.error('❌ notifyJobseekersAboutNewTraining:', err.message);
    }
  }

  // ✅ FIX 2: Enhanced getNotifications with proper metadata parsing
  async getNotifications(
    userId: string,
    params: { page?: number; limit?: number; read?: boolean | string } = {}
  ): Promise<any> {
    try {
      const page = params.page || 1;
      const limit = params.limit || 50;
      const offset = (page - 1) * limit;

      console.log('🔔 Loading notifications for user:', userId);

      let whereClause = 'WHERE n.user_id = $1';
      const values: any[] = [userId];
      let paramCount = 2;

      if (params.read !== undefined && params.read !== null && params.read !== '') {
        const isRead = params.read === true || params.read === 'true';
        whereClause += ` AND n.is_read = $${paramCount}`;
        values.push(isRead);
        paramCount++;
      }

      const query = `
        SELECT 
          n.id,
          n.user_id,
          n.type,
          n.title,
          n.message,
          n.related_id,
          n.metadata,
          n.is_read,
          n.created_at,
          n.updated_at
        FROM notifications n
        ${whereClause}
        ORDER BY n.created_at DESC
        LIMIT $${paramCount} OFFSET $${paramCount + 1}
      `;

      values.push(limit, offset);

      const result = await this.db.query(query, values);

      console.log('📥 Raw notifications:', result.rows.length);

      // ✅ CRITICAL: Parse metadata and enrich with user data
      const notifications = await Promise.all(result.rows.map(async (notification: any) => {
        let parsedMetadata: any = {};
        
        if (notification.metadata) {
          try {
            parsedMetadata = typeof notification.metadata === 'string' 
              ? JSON.parse(notification.metadata) 
              : notification.metadata;
          } catch (e) {
            console.error('Failed to parse notification metadata:', e);
            parsedMetadata = {};
          }
        }

        // Fetch complete user details if available in metadata
        let userDetails: any = {};

        if (parsedMetadata.user_id) {
          const user = await this.getUserDetails(parsedMetadata.user_id);
          
          if (user) {
            userDetails = {
              user_id: user.id,
              first_name: user.first_name || '',
              last_name: user.last_name || '',
              email: user.email || '',
              phone_number: user.phone_number || '',
              profile_image: user.profile_image || '',
              display_name: `${user.first_name} ${user.last_name}`.trim() || user.email
            };
          }
        }

        // Fetch application details if present and use its user info to override when appropriate
        let applicationDetails: any = {};

        if (parsedMetadata.application_id) {
          const appResult = await this.db.query(
            `SELECT a.*, u.first_name, u.last_name, u.email, u.profile_image
             FROM training_applications a
             JOIN users u ON a.user_id = u.id
             WHERE a.id = $1`,
            [parsedMetadata.application_id]
          );

          if (appResult.rows.length > 0) {
            const app = appResult.rows[0];
            applicationDetails = {
              application_id: app.id,
              motivation_letter: app.motivation || '',
              applied_at: app.applied_at,
              status: app.status
            };

            // Override user details with application user info for accuracy
            userDetails = {
              user_id: app.user_id,
              first_name: app.first_name || '',
              last_name: app.last_name || '',
              email: app.email || '',
              phone_number: '', // Safe default
              profile_image: app.profile_image || '',
              display_name: `${app.first_name} ${app.last_name}`.trim() || app.email
            };
          }
        }

        // Merge all data and return a single enriched notification object
        return {
          ...notification,
          metadata: parsedMetadata,
          ...userDetails,
          ...applicationDetails,
          // Legacy field mappings for compatibility
          jobseeker_name: userDetails.display_name || '',
          user_name: userDetails.display_name || '',
          user_email: userDetails.email || '',
          training_id: parsedMetadata.training_id || '',
          training_title: parsedMetadata.training_title || '',
          enrollment_id: parsedMetadata.enrollment_id || ''
        };
      }));

      console.log('✅ Enriched notifications:', notifications.length);

      return {
        success: true,
        data: {
          notifications: notifications
        }
      };
    } catch (error) {
      console.error('❌ Error loading notifications:', error);
      throw error;
    }
  }

  async markNotificationRead(notificationId: string, userId: string): Promise<void> {
    try {
      const result = await this.db.query(
        `UPDATE notifications 
         SET is_read = true, updated_at = NOW() 
         WHERE id = $1 AND user_id = $2`,
        [notificationId, userId]
      );
      
      if (result.rowCount === 0) {
        console.warn('⚠️  Notification not found or already read:', notificationId);
      } else {
        console.log('✅ Notification marked as read:', notificationId);
      }
    } catch (error: any) {
      console.error('❌ Error marking notification as read:', error.message);
      throw new Error('Failed to mark notification as read');
    }
  }

  // ==========================================================================
  // 2. TRAINING CRUD
  // ==========================================================================

  async createTraining(data: CreateTrainingRequest, employerId: string): Promise<Training> {
    const client = await this.db.connect();
    
    try {
      console.log('📝 Starting createTraining for employer:', employerId);
      await client.query('BEGIN');

      const userRow = await client.query('SELECT id, email, user_type FROM users WHERE id = $1', [employerId]);
      
      if (userRow.rows.length === 0) {
        throw new Error(`User ${employerId} does not exist`);
      }
      
      if (userRow.rows[0].user_type !== 'employer') {
        throw new Error('Only employers can create trainings');
      }

      const epRow = await client.query('SELECT id FROM employers WHERE user_id = $1', [employerId]);
      
      if (epRow.rows.length === 0) {
        throw new Error('Employer profile not found for this user');
      }
      
      const employerProfileId = epRow.rows[0].id;

      const startDate = data.start_date || data.training_start_date || null;
      const endDate = data.end_date || data.training_end_date || null;
      
      const sessions = Array.isArray(data.sessions) ? data.sessions : [];
      const outcomes = Array.isArray(data.outcomes) ? data.outcomes : [];

      const tResult = await client.query(
        `INSERT INTO trainings (
           title, description, category, level, duration_hours, cost_type, price, mode,
           provider_id, provider_name, has_certificate, eligibility_requirements,
           application_deadline, thumbnail_url, location, start_date, end_date,
           max_participants, status, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'draft',NOW(),NOW())
         RETURNING *`,
        [
          data.title?.trim(), 
          data.description?.trim(), 
          data.category?.trim(), 
          data.level,
          data.duration_hours, 
          data.cost_type, 
          data.price ?? 0, 
          data.mode,
          employerProfileId, 
          data.provider_name?.trim(), 
          data.has_certificate ?? false,
          data.eligibility_requirements ?? null,
          data.application_deadline ?? null,
          data.thumbnail_url ?? null,
          data.location ?? null,
          startDate,
          endDate,
          data.max_participants ?? null,
        ]
      );
      
      const trainingId = tResult.rows[0].id;

      if (sessions.length > 0) {
        for (let i = 0; i < sessions.length; i++) {
          const s = sessions[i];
          await client.query(
            `INSERT INTO training_sessions (
               training_id, title, description, scheduled_at, duration_minutes, 
               meeting_url, order_index, created_at, updated_at
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())`,
            [
              trainingId, 
              s.title?.trim(), 
              s.description?.trim() ?? null,
              s.scheduled_at, 
              s.duration_minutes, 
              s.meeting_url?.trim(), 
              s.order_index ?? i + 1
            ]
          );
        }
      }

      if (outcomes.length > 0) {
        for (const o of outcomes) {
          await client.query(
            `INSERT INTO training_outcomes (training_id, outcome_text, order_index) 
             VALUES ($1,$2,$3)`,
            [trainingId, o.outcome_text?.trim(), o.order_index]
          );
        }
      }

      await client.query('COMMIT');
      
      const result = await this.getTrainingById(trainingId);
      return result as Training;
      
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error('❌ Error in createTraining:', err);
      throw err;
    } finally {
      client.release();
    }
  }

  async updateTraining(id: string, data: UpdateTrainingRequest, employerId: string): Promise<Training | null> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      const epRow = await client.query('SELECT id FROM employers WHERE user_id = $1', [employerId]);
      if (epRow.rows.length === 0) { 
        await client.query('ROLLBACK'); 
        return null; 
      }
      const employerProfileId = epRow.rows[0].id;

      const own = await client.query(
        'SELECT id, title, status FROM trainings WHERE id = $1 AND provider_id = $2',
        [id, employerProfileId]
      );
      if (own.rows.length === 0) { 
        await client.query('ROLLBACK'); 
        return null; 
      }
      const oldTitle  = own.rows[0].title;
      const oldStatus = own.rows[0].status;

      const startDate = data.start_date || data.training_start_date || null;
      const endDate = data.end_date || data.training_end_date || null;

      const sets: string[] = [];
      const vals: any[] = [];
      let pi = 1;
      
      const skip = ['sessions', 'outcomes', 'training_start_date', 'training_end_date'];
      
      for (const [key, value] of Object.entries(data)) {
        if (value === undefined || skip.includes(key)) continue;
        sets.push(`${key} = $${pi++}`);
        vals.push(value);
      }

      if (startDate !== null && startDate !== undefined) {
        sets.push(`start_date = $${pi++}`);
        vals.push(startDate);
      }
      if (endDate !== null && endDate !== undefined) {
        sets.push(`end_date = $${pi++}`);
        vals.push(endDate);
      }

      sets.push('updated_at = CURRENT_TIMESTAMP');
      vals.push(id);

      if (sets.length > 1) {
        await client.query(
          `UPDATE trainings SET ${sets.join(', ')} WHERE id = $${pi}`, 
          vals
        );
      }

      if (data.sessions !== undefined) {
        await client.query('DELETE FROM training_sessions WHERE training_id = $1', [id]);
        
        if (Array.isArray(data.sessions) && data.sessions.length > 0) {
          for (let i = 0; i < data.sessions.length; i++) {
            const s = data.sessions[i];
            await client.query(
              `INSERT INTO training_sessions (
                training_id, title, description, scheduled_at, duration_minutes, 
                meeting_url, meeting_password, order_index, created_at, updated_at
              )
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())`,
              [
                id, 
                s.title?.trim(), 
                s.description?.trim() || null,
                s.scheduled_at, 
                s.duration_minutes, 
                s.meeting_url?.trim() || null,
                (s as any).meeting_password?.trim() || null,
                s.order_index ?? i
              ]
            );
          }
        }
      }

      if (data.outcomes !== undefined) {
        await client.query('DELETE FROM training_outcomes WHERE training_id = $1', [id]);
        
        if (Array.isArray(data.outcomes) && data.outcomes.length > 0) {
          for (let i = 0; i < data.outcomes.length; i++) {
            const o = data.outcomes[i];
            await client.query(
              `INSERT INTO training_outcomes (training_id, outcome_text, order_index) 
               VALUES ($1,$2,$3)`,
              [id, o.outcome_text?.trim(), o.order_index ?? i]
            );
          }
        }
      }

      await client.query('COMMIT');

      if (oldStatus === 'published' || oldStatus === 'in_progress') {
        this.notifyEnrolledTrainees(
          id, 
          'training_updated', 
          `Training "${oldTitle}" has been updated`, 
          { training_id: id }
        );
      }

      const updatedTraining = await this.getTrainingById(id);
      return updatedTraining as Training;
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error('❌ Error updating training:', err);
      throw err;
    } finally {
      client.release();
    }
  }

  async deleteTraining(id: string, employerId: string): Promise<boolean> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      const epRow = await client.query('SELECT id FROM employers WHERE user_id = $1', [employerId]);
      const epId = epRow.rows.length > 0 ? epRow.rows[0].id : null;

      const tRow = await client.query(
        `SELECT title, status FROM trainings WHERE id = $1 AND (provider_id = $2 OR provider_id = $3)`,
        [id, employerId, epId ?? '']
      );
      if (tRow.rows.length === 0) { await client.query('ROLLBACK'); return false; }

      await client.query(
        `DELETE FROM trainings WHERE id = $1 AND (provider_id = $2 OR provider_id = $3)`,
        [id, employerId, epId ?? '']
      );
      await client.query('COMMIT');

      if (tRow.rows[0].status === 'published' || tRow.rows[0].status === 'in_progress') {
        this.notifyEnrolledTrainees(id, 'training_deleted', `Training "${tRow.rows[0].title}" has been removed`, { training_id: id });
      }
      return true;
    } catch (err: any) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async updateTrainingStatus(trainingId: string, employerId: string, newStatus: string): Promise<Training | null> {
    const epRow = await this.db.query('SELECT id FROM employers WHERE user_id = $1', [employerId]);
    if (epRow.rows.length === 0) return null;

    const result = await this.db.query(
      `UPDATE trainings SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND provider_id = $3 RETURNING *`,
      [newStatus, trainingId, epRow.rows[0].id]
    );
    if (result.rows.length === 0) return null;

    if (newStatus === 'published') {
      const t = result.rows[0];
      this.notifyJobseekersAboutNewTraining(trainingId, t.title, t.category, t.provider_name);
    }
    if (newStatus === 'suspended') {
      this.notifyEnrolledTrainees(trainingId, 'training_suspended', `Training "${result.rows[0].title}" has been suspended`);
    }

    return (await this.getTrainingById(trainingId)) as Training;
  }

  // ==========================================================================
  // 3. TRAINING RETRIEVAL
  // ==========================================================================

  async getTrainingById(id: string): Promise<any | null> {
    const result = await this.db.query('SELECT * FROM trainings WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;

    const training = result.rows[0];

    const sessions = await this.db.query(
      'SELECT * FROM training_sessions WHERE training_id = $1 ORDER BY order_index ASC',
      [id]
    );
    training.sessions = sessions.rows;

    const outcomes = await this.db.query(
      'SELECT * FROM training_outcomes WHERE training_id = $1 ORDER BY order_index ASC',
      [id]
    );
    training.outcomes = outcomes.rows;

    return training;
  }

  async getTrainingByIdForUser(id: string, userId: string, userType: string): Promise<any | null> {
    const training = await this.getTrainingById(id);
    if (!training) return null;

    if (userType === 'jobseeker') {
      const hasRelation = await this.db.query(
        `SELECT 1 FROM training_applications WHERE training_id = $1 AND user_id = $2
         UNION
         SELECT 1 FROM training_enrollments WHERE training_id = $1 AND user_id = $2`,
        [id, userId]
      );
      if (training.status !== 'published' && 
          training.status !== 'applications_closed' && 
          training.status !== 'in_progress' && 
          training.status !== 'completed' && 
          hasRelation.rows.length === 0) {
        return null;
      }

      const appRow = await this.db.query(
        'SELECT * FROM training_applications WHERE training_id = $1 AND user_id = $2 ORDER BY applied_at DESC LIMIT 1',
        [id, userId]
      );
      training.my_application = appRow.rows[0] || null;
      training.has_applied = appRow.rows.length > 0;
      training.applied = appRow.rows.length > 0;
      training.application_status = appRow.rows[0]?.status || null;

      const enrRow = await this.db.query(
        'SELECT * FROM training_enrollments WHERE training_id = $1 AND user_id = $2 ORDER BY enrolled_at DESC LIMIT 1',
        [id, userId]
      );
      training.my_enrollment = enrRow.rows[0] || null;
      training.is_enrolled = enrRow.rows.length > 0;
      training.enrolled = enrRow.rows.length > 0;
      training.enrollment_id = enrRow.rows[0]?.id || null;
    }

    return training;
  }

  async getPublishedTrainingsForJobseeker(userId: string, params: TrainingSearchParams): Promise<TrainingListResponse> {
    const { page = 1, limit = 10, sort_by = 'created_at', sort_order = 'desc', filters = {} } = params;
    const offset = (page - 1) * limit;

    const conds: string[] = [
      "t.status IN ('published','applications_closed','in_progress','completed')",
      't.provider_id IS NOT NULL',
      't.title IS NOT NULL',
    ];
    const qp: any[] = [];
    let pi = 1;

    if (filters.category || params.category) {
      conds.push(`t.category = $${pi++}`);
      qp.push(filters.category || params.category);
    }
    if (params.level) { conds.push(`t.level = $${pi++}`); qp.push(params.level); }
    if (params.cost_type) { conds.push(`t.cost_type = $${pi++}`); qp.push(params.cost_type); }
    if (params.mode) { conds.push(`t.mode = $${pi++}`); qp.push(params.mode); }
    if (params.search) {
      conds.push(`(t.title ILIKE $${pi} OR t.description ILIKE $${pi})`);
      qp.push(`%${params.search}%`); pi++;
    }

    const where = `WHERE ${conds.join(' AND ')}`;

    const userIdx = pi++;
    qp.push(userId);
    const limitIdx = pi++;  qp.push(limit);
    const offIdx  = pi++;   qp.push(offset);

    const query = `
      SELECT
        t.*,
        CASE WHEN a.id IS NOT NULL THEN true ELSE false END AS has_applied,
        CASE WHEN a.id IS NOT NULL THEN true ELSE false END AS applied,
        a.status AS application_status,
        a.applied_at,
        CASE WHEN e.id IS NOT NULL THEN true ELSE false END AS is_enrolled,
        CASE WHEN e.id IS NOT NULL THEN true ELSE false END AS enrolled,
        e.status AS enrollment_status,
        e.enrolled_at,
        e.completed_at,
        e.certificate_issued,
        e.id AS enrollment_id,
        COUNT(*) OVER() AS total_count
      FROM trainings t
      LEFT JOIN training_applications a ON a.training_id = t.id AND a.user_id = $${userIdx}
      LEFT JOIN training_enrollments  e ON e.training_id = t.id AND e.user_id = $${userIdx}
      ${where}
      ORDER BY t.${sort_by} ${sort_order.toUpperCase()}
      LIMIT $${limitIdx} OFFSET $${offIdx}
    `;

    const result = await this.db.query(query, qp);
    const rows  = result.rows;
    const total = rows.length > 0 ? parseInt(rows[0].total_count) : 0;

    return {
      trainings: rows.map(r => this.mapTrainingWithContext(r)),
      pagination: {
        current_page: page,
        total_pages: Math.ceil(total / limit),
        page_size: limit,
        total_count: total,
        has_next: page * limit < total,
        has_previous: page > 1,
      },
      filters_applied: filters,
    };
  }

  // ✅ FIX 4: CRITICAL - Proper employer filtering in getAllTrainings
  async getAllTrainings(
    params: any,
    employerId?: string
  ): Promise<any> {
    try {
      const page = params.page || 1;
      const limit = params.limit || 10;
      const offset = (page - 1) * limit;

      console.log('🔍 getAllTrainings - Input:', { employerId, params });

      const conditions: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      // ✅ CRITICAL FIX: Proper employer filtering
      if (employerId) {
        // Method 1: Try to resolve employer profile ID from user_id
        const epResult = await this.db.query(
          'SELECT id FROM employers WHERE user_id = $1',
          [employerId]
        );

        let employerProfileId: string | null = null;

        if (epResult.rows.length > 0) {
          employerProfileId = epResult.rows[0].id;
          console.log('✅ Employer profile found (via user_id):', employerProfileId);
        } else {
          // Method 2: Check if employerId IS the employer profile ID
          const directCheck = await this.db.query(
            'SELECT id FROM employers WHERE id = $1',
            [employerId]
          );

          if (directCheck.rows.length > 0) {
            employerProfileId = employerId;
            console.log('✅ Employer profile found (direct ID):', employerProfileId);
          }
        }

        if (!employerProfileId) {
          console.error('❌ No employer profile found for:', employerId);
          return {
            trainings: [],
            pagination: {
              current_page: page,
              total_pages: 0,
              page_size: limit,
              total_count: 0,
              has_next: false,
              has_previous: false
            }
          };
        }
    
        // ✅ STRICT FILTERING: Only trainings owned by THIS employer
        conditions.push(`t.provider_id = $${paramCount}`);
        values.push(employerProfileId);
        paramCount++;
        
        console.log(`✅ Filtering for employer profile: ${employerProfileId}`);
      } else {
        // If no employerId provided, show only published trainings
        conditions.push(`t.status = 'published'`);
        console.log('ℹ️  No employer filter - showing published trainings');
      }

      // Apply other filters
      if (params.search) {
        conditions.push(`(t.title ILIKE $${paramCount} OR t.description ILIKE $${paramCount})`);
        values.push(`%${params.search}%`);
        paramCount++;
      }

      if (params.category) {
        conditions.push(`t.category = $${paramCount}`);
        values.push(params.category);
        paramCount++;
      }

      if (params.level) {
        conditions.push(`t.level = $${paramCount}`);
        values.push(params.level);
        paramCount++;
      }

      if (params.status) {
        conditions.push(`t.status = $${paramCount}`);
        values.push(params.status);
        paramCount++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countQuery = `SELECT COUNT(*) as count FROM trainings t ${whereClause}`;
      const countResult = await this.db.query(countQuery, values);
      const totalCount = parseInt(countResult.rows[0]?.count || '0', 10);

      console.log('📊 Total trainings found:', totalCount);

      // Get trainings with sessions and outcomes
      const dataQuery = `
        SELECT t.*,
          (SELECT COUNT(*) FROM training_sessions WHERE training_id = t.id) as session_count,
          (SELECT COUNT(*) FROM training_applications WHERE training_id = t.id) as application_count,
          (SELECT COUNT(*) FROM training_enrollments WHERE training_id = t.id) as enrollment_count
        FROM trainings t
        ${whereClause}
        ORDER BY t.created_at DESC
        LIMIT $${paramCount} OFFSET $${paramCount + 1}
      `;

      const dataValues = [...values, limit, offset];
      const dataResult = await this.db.query(dataQuery, dataValues);

      console.log('📦 Trainings fetched:', dataResult.rows.length);

      // Load sessions and outcomes for each training
      const trainingsWithRelations = await Promise.all(
        dataResult.rows.map(async (training: any) => {
          const [sessionsResult, outcomesResult] = await Promise.all([
            this.db.query(
              'SELECT * FROM training_sessions WHERE training_id = $1 ORDER BY order_index ASC',
              [training.id]
            ),
            this.db.query(
              'SELECT * FROM training_outcomes WHERE training_id = $1 ORDER BY order_index ASC',
              [training.id]
            )
          ]);

          return {
            ...training,
            sessions: sessionsResult.rows,
            outcomes: outcomesResult.rows,
            session_count: sessionsResult.rows.length,
            current_participants: parseInt(training.enrollment_count) || 0
          };
        })
      );

      return {
        trainings: trainingsWithRelations,
        pagination: {
          current_page: page,
          total_pages: Math.ceil(totalCount / limit),
          page_size: limit,
          total_count: totalCount,
          has_next: page < Math.ceil(totalCount / limit),
          has_previous: page > 1
        }
      };
    } catch (error) {
      console.error('❌ Error in getAllTrainings:', error);
      throw error;
    }
  }

  async getEnrolledTrainings(userId: string, params: TrainingSearchParams): Promise<TrainingListResponse> {
    const { page = 1, limit = 10, sort_by = 'created_at', sort_order = 'desc' } = params;
    const offset = (page - 1) * limit;

    const result = await this.db.query(
      `SELECT t.*,
              e.id AS enrollment_id,
              e.status AS enrollment_status,
              e.enrolled_at,
              e.completed_at,
              e.certificate_issued,
              e.certificate_url,
              true AS is_enrolled,
              COUNT(*) OVER() AS total_count
       FROM training_enrollments e
       JOIN trainings t ON e.training_id = t.id
       WHERE e.user_id = $1
       ORDER BY e.enrolled_at ${sort_order.toUpperCase()}
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    const rows  = result.rows;
    const total = rows.length > 0 ? parseInt(rows[0].total_count) : 0;

    return {
      trainings: rows.map(r => ({
        ...this.mapTrainingFromDb(r),
        has_applied: true,
        is_enrolled: true,
        enrollment_status: r.enrollment_status,
        enrolled_at: r.enrolled_at,
        completed_at: r.completed_at,
        enrollment_id: r.enrollment_id,
        certificate_issued: Boolean(r.certificate_issued),
        certificate_url: r.certificate_url || null,
      })),
      pagination: { current_page: page, total_pages: Math.ceil(total / limit), page_size: limit, total_count: total, has_next: page * limit < total, has_previous: page > 1 },
      filters_applied: {},
    };
  }

  // ==========================================================================
  // 4. APPLICATION FLOW - FIXED WITH SAFE COLUMN HANDLING
  // ==========================================================================

  // ✅ FIX 5: Enhanced submitApplication with safe phone_number handling
  async submitApplication(
    trainingId: string,
    userId: string,
    data: { motivation?: string }
  ): Promise<any> {
    try {
      console.log('📝 Processing application:', { trainingId, userId });

      // Check for existing application
      const existingApp = await this.db.query(
        'SELECT id FROM training_applications WHERE training_id = $1 AND user_id = $2',
        [trainingId, userId]
      );

      if (existingApp.rows.length > 0) {
        return {
          success: false,
          message: 'You have already applied for this training'
        };
      }

      // Get training details
      const trainingResult = await this.db.query(
        'SELECT id, title, provider_id, provider_name FROM trainings WHERE id = $1',
        [trainingId]
      );

      if (trainingResult.rows.length === 0) {
        return { success: false, message: 'Training not found' };
      }

      const training = trainingResult.rows[0];

      // ✅ FIX: Get user details safely
      const user = await this.getUserDetails(userId);

      if (!user) {
        return { success: false, message: 'User not found' };
      }

      // Create application
      const applicationResult = await this.db.query(
        `INSERT INTO training_applications 
         (training_id, user_id, motivation, status, applied_at) 
         VALUES ($1, $2, $3, 'pending', NOW()) 
         RETURNING *`,
        [trainingId, userId, data.motivation || '']
      );

      const application = applicationResult.rows[0];

      // ✅ CRITICAL: Create notification with COMPLETE metadata
      const displayName = `${user.first_name} ${user.last_name}`.trim() || user.email;
      
      const metadata = {
        // Training info
        training_id: trainingId,
        training_title: training.title,
        
        // Application info
        application_id: application.id,
        motivation_letter: data.motivation || '',
        applied_at: application.applied_at,
        
        // User info (ALL variations for compatibility)
        user_id: userId,
        applicant_name: displayName,
        user_name: displayName,
        jobseeker_name: displayName,
        display_name: displayName,
        
        // Contact details
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
        user_email: user.email || '',
        applicant_email: user.email || '',
        phone_number: user.phone_number || '',
        profile_image: user.profile_image || ''
      };

      await this.db.query(
        `INSERT INTO notifications 
         (user_id, type, title, message, related_id, metadata, is_read, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, false, NOW())`,
        [
          training.provider_id,
          'application_submitted',
          '📝 New Application',
          `${displayName} applied for "${training.title}"`,
          application.id,
          JSON.stringify(metadata)
        ]
      );

      console.log('✅ Application created with notification:', {
        applicationId: application.id,
        employerId: training.provider_id,
        metadata
      });

      return {
        success: true,
        message: 'Application submitted successfully',
        data: application
      };
    } catch (error) {
      console.error('❌ Error submitting application:', error);
      throw error;
    }
  }

  async getApplications(trainingId: string, employerId: string, params: { page?: number; limit?: number; status?: string }): Promise<any> {
  const epRow = await this.db.query('SELECT id FROM employers WHERE user_id = $1', [employerId]);
  const epId = epRow.rows.length > 0 ? epRow.rows[0].id : null;

  const own = await this.db.query(
    `SELECT id FROM trainings WHERE id = $1 AND (provider_id = $2 OR provider_id = $3)`,
    [trainingId, employerId, epId ?? '']
  );
  if (own.rows.length === 0) return null;

  const { page = 1, limit = 20, status } = params;
  const offset = (page - 1) * limit;

  let where = 'WHERE a.training_id = $1';
  const qp: any[] = [trainingId];
  let pi = 2;
  if (status) { where += ` AND a.status = $${pi++}`; qp.push(status); }

  qp.push(limit, offset);
  
  // ✅ FIX: Explicit column selection instead of dynamic
  const userQuery = `
    SELECT 
      a.*,
      u.first_name,
      u.last_name,
      u.email,
      u.profile_image,
      u.contact_number,  -- ✅ Changed from phone_number
      COUNT(*) OVER() AS total_count
    FROM training_applications a
    JOIN users u ON a.user_id = u.id
    ${where}
    ORDER BY a.applied_at DESC
    LIMIT $${pi++} OFFSET $${pi++}
  `;

  const result = await this.db.query(userQuery, qp);
  const rows = result.rows;
  const total = rows.length > 0 ? parseInt(rows[0].total_count) : 0;

  return {
    applications: rows.map(r => ({
      id: r.id,
      training_id: r.training_id,
      user_id: r.user_id,
      motivation: r.motivation,
      status: r.status,
      reviewed_at: r.reviewed_at,
      employer_notes: r.employer_notes,
      applied_at: r.applied_at,
      user: { 
        id: r.user_id, 
        first_name: r.first_name, 
        last_name: r.last_name, 
        email: r.email, 
        profile_image: r.profile_image || '',
        phone_number: r.contact_number || ''  // ✅ Map to phone_number
      },
    })),
    pagination: { /* ... */ },
  };
}

  // ==========================================================================
  // 5. SHORTLISTING & ENROLLMENT
  // ==========================================================================

  async shortlistApplicant(applicationId: string, employerId: string, body: ShortlistDecisionRequest): Promise<any> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      const appRow = await client.query(
        `SELECT a.*, t.title AS training_title, t.provider_id, t.max_participants
         FROM training_applications a
         JOIN trainings t ON a.training_id = t.id
         WHERE a.id = $1`,
        [applicationId]
      );
      if (appRow.rows.length === 0) throw new Error('Application not found');

      const app = appRow.rows[0];

      const epRow = await client.query('SELECT id FROM employers WHERE user_id = $1', [employerId]);
      const epId = epRow.rows.length > 0 ? epRow.rows[0].id : null;
      if (app.provider_id !== employerId && app.provider_id !== epId) {
        throw new Error('Unauthorized');
      }

      if (app.status !== 'pending') {
        throw new Error(`Application is already ${app.status}`);
      }

      if (body.decision === 'shortlisted' && app.max_participants) {
        const enrolled = await client.query(
          `SELECT COUNT(*) AS cnt FROM training_enrollments WHERE training_id = $1 AND status = 'enrolled'`,
          [app.training_id]
        );
        if (parseInt(enrolled.rows[0].cnt) >= app.max_participants) {
          throw new Error('Training is at full capacity');
        }
      }

      await client.query(
        `UPDATE training_applications SET status = $1, employer_notes = $2, reviewed_at = NOW(), updated_at = NOW() WHERE id = $3`,
        [body.decision, body.employer_notes ?? null, applicationId]
      );

      let enrollment: any = null;

      if (body.decision === 'shortlisted') {
        const enrResult = await client.query(
          `INSERT INTO training_enrollments (training_id, user_id, application_id, status, enrolled_at, completion_marked, certificate_issued, created_at, updated_at)
           VALUES ($1, $2, $3, 'enrolled', NOW(), false, false, NOW(), NOW()) RETURNING *`,
          [app.training_id, app.user_id, applicationId]
        );
        enrollment = enrResult.rows[0];

        await client.query(
          `UPDATE trainings SET current_participants = COALESCE(current_participants, 0) + 1, total_students = COALESCE(total_students, 0) + 1 WHERE id = $1`,
          [app.training_id]
        );
      }

      await client.query('COMMIT');

      // ✅ FIX: Safe user data retrieval for notification
      const user = await this.getUserDetails(app.user_id);
      const name = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email : 'User';

      if (body.decision === 'shortlisted') {
        this.createNotification(app.user_id, 'application_shortlisted',
          `Congratulations! You have been shortlisted for "${app.training_title}". You are now enrolled.`,
          { training_id: app.training_id, application_id: applicationId, enrollment_id: enrollment?.id }
        );
        this.createNotification(app.provider_id, 'new_enrollment',
          `${name} has been enrolled in "${app.training_title}"`,
          { training_id: app.training_id, application_id: applicationId, enrollment_id: enrollment?.id, user_id: app.user_id }
        );
      } else {
        this.createNotification(app.user_id, 'application_rejected',
          `Your application for "${app.training_title}" was not shortlisted at this time.`,
          { training_id: app.training_id, application_id: applicationId }
        );
      }

      return { success: true, message: `Application ${body.decision}`, application: { ...app, status: body.decision }, enrollment };
    } catch (err: any) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ==========================================================================
  // 6. COMPLETION & CERTIFICATES
  // ==========================================================================

  async markTraineeCompletion(enrollmentId: string, employerId: string, body: MarkCompletionRequest): Promise<any> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      const enrRow = await client.query(
        `SELECT e.*, t.title AS training_title, t.provider_id, t.has_certificate
         FROM training_enrollments e
         JOIN trainings t ON e.training_id = t.id
         WHERE e.id = $1`,
        [enrollmentId]
      );
      if (enrRow.rows.length === 0) throw new Error('Enrollment not found');

      const enr = enrRow.rows[0];

      const epRow = await client.query('SELECT id FROM employers WHERE user_id = $1', [employerId]);
      const epId = epRow.rows.length > 0 ? epRow.rows[0].id : null;
      if (enr.provider_id !== employerId && enr.provider_id !== epId) throw new Error('Unauthorized');

      const newStatus = body.completed ? 'completed' : 'not_completed';
      await client.query(
        `UPDATE training_enrollments
         SET status = $1, completion_marked = true, completed_at = NOW(), updated_at = NOW()
         WHERE id = $2`,
        [newStatus, enrollmentId]
      );

      await client.query('COMMIT');

      // ✅ FIX: Safe user data retrieval
      const user = await this.getUserDetails(enr.user_id);
      const name = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email : 'User';

      if (body.completed) {
        this.createNotification(enr.user_id, 'training_completed_mark',
          `Your training "${enr.training_title}" has been marked as completed by the provider.${enr.has_certificate ? ' You are eligible for a certificate.' : ''}`,
          { training_id: enr.training_id, enrollment_id: enrollmentId }
        );
        this.createNotification(enr.provider_id, 'training_completed_mark',
          `${name} has been marked as completed for "${enr.training_title}".`,
          { training_id: enr.training_id, enrollment_id: enrollmentId, user_id: enr.user_id }
        );
      } else {
        this.createNotification(enr.user_id, 'training_completed_mark',
          `Your training "${enr.training_title}" was marked as not completed. Please contact the provider for details.`,
          { training_id: enr.training_id, enrollment_id: enrollmentId }
        );
      }

      return { success: true, status: newStatus, enrollment_id: enrollmentId };
    } catch (err: any) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async issueCertificate(enrollmentId: string, employerId: string): Promise<any> {
  // ✅ FIX: Explicit column selection
  const enrQuery = `
    SELECT 
      e.*, 
      t.title AS training_title, 
      t.provider_id, 
      t.has_certificate, 
      t.duration_hours,
      u.first_name, 
      u.last_name, 
      u.email,
      u.contact_number,  -- ✅ Changed from phone_number
      u.profile_image
    FROM training_enrollments e
    JOIN trainings t ON e.training_id = t.id
    JOIN users u ON e.user_id = u.id
    WHERE e.id = $1
  `;

  const enrRow = await this.db.query(enrQuery, [enrollmentId]);
  
  if (enrRow.rows.length === 0) throw new Error('Enrollment not found');

  const enr = enrRow.rows[0];

  const epRow = await this.db.query('SELECT id FROM employers WHERE user_id = $1', [employerId]);
  const epId = epRow.rows.length > 0 ? epRow.rows[0].id : null;
  
  if (enr.provider_id !== employerId && enr.provider_id !== epId) {
    throw new Error('Unauthorized: You can only issue certificates for your own trainings');
  }
  
  if (!enr.has_certificate) throw new Error('This training does not provide certificates');
  if (enr.status !== 'completed') throw new Error('Certificate can only be issued for completed enrollments');
  
  if (enr.certificate_issued) {
    return { 
      success: true, 
      message: 'Certificate already issued', 
      certificate_url: enr.certificate_url, 
      enrollment_id: enrollmentId 
    };
  }

  const userName = `${enr.first_name || ''} ${enr.last_name || ''}`.trim() || 
                   (enr.email ? enr.email.split('@')[0] : 'User');

  const cert = await this.generateCertificatePDF(
    enrollmentId, 
    enr.user_id, 
    enr.training_id, 
    enr.training_title, 
    enr.duration_hours
  );

  await this.db.query(
    `UPDATE training_enrollments 
     SET certificate_issued = true, 
         certificate_url = $1, 
         certificate_issued_at = NOW() 
     WHERE id = $2`,
    [cert.certificate_url, enrollmentId]
  );

  await this.db.query(
    `INSERT INTO certificate_verifications (enrollment_id, verification_code, certificate_url, issued_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (enrollment_id) DO NOTHING`,
    [enrollmentId, cert.verification_code, cert.certificate_url]
  );

  this.createNotification(
    enr.user_id, 
    'certificate_issued',
    `🎉 Your certificate for "${enr.training_title}" is ready! Click to download.`,
    { 
      training_id: enr.training_id, 
      enrollment_id: enrollmentId, 
      certificate_url: cert.certificate_url,
      user_id: enr.user_id,
      applicant_name: userName,
      profile_image: enr.profile_image || ''
    }
  );
  
  this.createNotification(
    enr.provider_id, 
    'certificate_issued',
    `Certificate issued to ${userName} for "${enr.training_title}".`,
    { 
      training_id: enr.training_id, 
      enrollment_id: enrollmentId, 
      user_id: enr.user_id,
      applicant_name: userName,
      jobseeker_name: userName,
      profile_image: enr.profile_image || ''
    }
  );

  return { 
    success: true, 
    message: 'Certificate issued successfully', 
    certificate_url: cert.certificate_url, 
    verification_code: cert.verification_code, 
    enrollment_id: enrollmentId 
  };
}

  async verifyCertificate(verificationCode: string): Promise<any> {
    const result = await this.db.query(
      `SELECT cv.*, e.training_id, e.user_id, e.completed_at,
              t.title AS training_title, t.provider_name, t.duration_hours,
              u.first_name, u.last_name
       FROM certificate_verifications cv
       JOIN training_enrollments e ON cv.enrollment_id = e.id
       JOIN trainings t ON e.training_id = t.id
       JOIN users u ON e.user_id = u.id
       WHERE cv.verification_code = $1`,
      [verificationCode]
    );
    if (result.rows.length === 0) return { valid: false, message: 'Certificate not found or invalid' };

    const r = result.rows[0];
    return {
      valid: true,
      trainee_name: `${r.first_name || ''} ${r.last_name || ''}`.trim(),
      training_title: r.training_title,
      provider_name: r.provider_name,
      duration_hours: r.duration_hours,
      completed_at: r.completed_at,
      issued_at: r.issued_at,
      verification_code: r.verification_code,
    };
  }

  private async generateCertificatePDF(
    enrollmentId: string,
    userId: string,
    trainingId: string,
    trainingTitle: string,
    durationHours: number
  ): Promise<{ certificate_url: string; verification_code: string }> {
    const fs   = require('fs');
    const path = require('path');
    const PDFDocument = require('pdfkit');

    // ✅ FIX: Safe user data retrieval
    const user = await this.getUserDetails(userId);
    const trainee = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || (user.email || '').split('@')[0] : 'Trainee';

    const tRow = await this.db.query(
      `SELECT t.provider_name, t.provider_id,
              COALESCE(c.name, '') AS company_name
       FROM trainings t
       LEFT JOIN employers e ON e.id = t.provider_id
       LEFT JOIN companies c ON c.id = e.company_id
       WHERE t.id = $1`,
      [trainingId]
    );
    const td       = tRow.rows[0] || {};
    const provider = (td.company_name && td.company_name.trim()) ? td.company_name.trim() : (td.provider_name || 'Training Provider');

    const verificationCode = generateVerificationCode();

    const baseUpload    = path.join(__dirname, '../../uploads');
    const certDir       = path.join(baseUpload, 'certificates');
    if (!fs.existsSync(certDir)) fs.mkdirSync(certDir, { recursive: true });

    const fileName = `certificate-${enrollmentId}-${Date.now()}.pdf`;
    const filePath = path.join(certDir, fileName);

    const doc = new PDFDocument({ size: 'A4', layout: 'landscape' });
    const W   = doc.page.width;
    const H   = doc.page.height;
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    doc.rect(40, 40, W - 80, H - 80).stroke('#2c3e50');
    doc.rect(46, 46, W - 92, H - 92).stroke('#2c3e50');

    doc.fontSize(36).font('Helvetica-Bold').fillColor('#2c3e50')
       .text('Certificate of Completion', 0, 70, { align: 'center', width: W });

    doc.fontSize(15).font('Helvetica').fillColor('#555555')
       .text('This is to certify that', 0, 140, { align: 'center', width: W });

    doc.fontSize(30).font('Helvetica-Bold').fillColor('#1a5276')
       .text(trainee, 0, 180, { align: 'center', width: W });

    doc.fontSize(15).font('Helvetica').fillColor('#555555')
       .text('has successfully completed the training programme', 0, 240, { align: 'center', width: W });

    doc.fontSize(24).font('Helvetica-Bold').fillColor('#2c3e50')
       .text(trainingTitle, 0, 278, { align: 'center', width: W });

    doc.fontSize(13).font('Helvetica').fillColor('#666666')
       .text(`Total Duration: ${durationHours} hours`, 0, 325, { align: 'center', width: W });

    const completionDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    doc.fontSize(13).font('Helvetica').fillColor('#666666')
       .text(`Date of Completion: ${completionDate}`, 0, 348, { align: 'center', width: W });

    doc.moveTo(180, 390).lineTo(W - 180, 390).strokeColor('#aaaaaa').stroke();

    doc.fontSize(12).font('Helvetica-Oblique').fillColor('#888888')
       .text('Issued by:', 0, 400, { align: 'center', width: W });
    doc.fontSize(18).font('Helvetica-Bold').fillColor('#2c3e50')
       .text(provider, 0, 422, { align: 'center', width: W });

    doc.moveTo(W / 2 - 80, 465).lineTo(W / 2 + 80, 465).strokeColor('#888888').stroke();
    doc.fontSize(10).font('Helvetica-Oblique').fillColor('#888888')
       .text('Authorised Signature', 0, 468, { align: 'center', width: W });

    doc.fontSize(9).font('Helvetica').fillColor('#aaaaaa')
       .text(`Verification Code: ${verificationCode}`, 0, H - 75, { align: 'center', width: W });
    doc.fontSize(8).font('Helvetica').fillColor('#aaaaaa')
       .text('This certificate can be verified at the Digital Skills Training Platform', 0, H - 60, { align: 'center', width: W });

    doc.end();

    return new Promise((resolve, reject) => {
      stream.on('finish', () => resolve({ certificate_url: fileName, verification_code: verificationCode }));
      stream.on('error', reject);
    });
  }

  // ==========================================================================
  // 7. STATS & ANALYTICS
  // ==========================================================================

  async getTrainingStats(employerId: string): Promise<TrainingStatsResponse> {
    try {
      const epRow = await this.db.query('SELECT id FROM employers WHERE user_id = $1', [employerId]);
      let cond = 't.provider_id = $1';
      const qp: any[] = [employerId];
      
      if (epRow.rows.length > 0) {
        cond = '(t.provider_id = $1 OR t.provider_id = $2)';
        qp.push(epRow.rows[0].id);
      }

      const stats = await this.db.query(
        `SELECT
           COUNT(t.id) AS total_trainings,
           COUNT(*) FILTER (WHERE t.status = 'published') AS published_trainings,
           COUNT(*) FILTER (WHERE t.status = 'draft') AS draft_trainings,
           COUNT(*) FILTER (WHERE t.status = 'suspended') AS suspended_trainings,
           COALESCE(AVG(t.rating), 0) AS avg_rating
         FROM trainings t
         WHERE ${cond}`,
        qp
      );

      const appStats = await this.db.query(
        `SELECT COUNT(*) AS total
         FROM training_applications a
         JOIN trainings t ON a.training_id = t.id
         WHERE ${cond}`,
        qp
      );

      const enrStats = await this.db.query(
        `SELECT 
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE e.status = 'completed') AS completed
         FROM training_enrollments e
         JOIN trainings t ON e.training_id = t.id
         WHERE ${cond}`,
        qp
      );

      const s = stats.rows[0];
      const totalEnr = parseInt(enrStats.rows[0]?.total || 0);
      const totalComp = parseInt(enrStats.rows[0]?.completed || 0);

      return {
        total_trainings: parseInt(s.total_trainings || 0),
        published_trainings: parseInt(s.published_trainings || 0),
        draft_trainings: parseInt(s.draft_trainings || 0),
        suspended_trainings: parseInt(s.suspended_trainings || 0),
        total_applications: parseInt(appStats.rows[0]?.total || 0),
        total_enrollments: totalEnr,
        total_completions: totalComp,
        total_revenue: 0,
        avg_rating: parseFloat(s.avg_rating) || 0,
        completion_rate: totalEnr > 0 ? Math.round((totalComp / totalEnr) * 10000) / 100 : 0,
        categories_breakdown: [],
        monthly_enrollments: [],
      };
    } catch (error: any) {
      console.error('❌ Error in getTrainingStats:', error.message);
      return {
        total_trainings: 0,
        published_trainings: 0,
        draft_trainings: 0,
        suspended_trainings: 0,
        total_applications: 0,
        total_enrollments: 0,
        total_completions: 0,
        total_revenue: 0,
        avg_rating: 0,
        completion_rate: 0,
        categories_breakdown: [],
        monthly_enrollments: [],
      };
    }
  }

  async getJobseekerTrainingStats(userId: string): Promise<any> {
    const result = await this.db.query(
      `SELECT
         (SELECT COUNT(*) FROM training_applications WHERE user_id = $1)                          AS total_applied,
         (SELECT COUNT(*) FROM training_enrollments  WHERE user_id = $1)                          AS total_enrolled,
         (SELECT COUNT(*) FROM training_enrollments  WHERE user_id = $1 AND status = 'completed') AS completed_count,
         (SELECT COUNT(*) FROM training_enrollments  WHERE user_id = $1 AND certificate_issued = true) AS certificates_earned`,
      [userId]
    );
    return {
      total_applied:      parseInt(result.rows[0].total_applied),
      total_enrolled:     parseInt(result.rows[0].total_enrolled),
      completed_count:    parseInt(result.rows[0].completed_count),
      certificates_earned:parseInt(result.rows[0].certificates_earned),
    };
  }

  async getTrainingReviews(trainingId: string, params: any): Promise<any | null> {
    const check = await this.db.query('SELECT id FROM trainings WHERE id = $1', [trainingId]);
    if (check.rows.length === 0) return null;

    const { page = 1, limit = 10, sort_by = 'created_at', sort_order = 'desc' } = params;
    const offset = (page - 1) * limit;

    const result = await this.db.query(
      `SELECT r.*, u.first_name, u.last_name, u.profile_image, COUNT(*) OVER() AS total_count
       FROM training_reviews r
       JOIN users u ON r.user_id = u.id
       WHERE r.training_id = $1
       ORDER BY r.${sort_by} ${sort_order.toUpperCase()}
       LIMIT $2 OFFSET $3`,
      [trainingId, limit, offset]
    );

    const summary = await this.db.query(
      `SELECT AVG(rating) AS avg, COUNT(*) AS total,
              COUNT(*) FILTER (WHERE rating=5) AS r5, COUNT(*) FILTER (WHERE rating=4) AS r4,
              COUNT(*) FILTER (WHERE rating=3) AS r3, COUNT(*) FILTER (WHERE rating=2) AS r2,
              COUNT(*) FILTER (WHERE rating=1) AS r1
       FROM training_reviews WHERE training_id = $1`,
      [trainingId]
    );
    const sm = summary.rows[0];
    const rows = result.rows;
    const total = rows.length > 0 ? parseInt(rows[0].total_count) : 0;

    return {
      reviews: rows.map(r => ({
        id: r.id, training_id: r.training_id, user_id: r.user_id,
        rating: r.rating, review_text: r.review_text, created_at: r.created_at,
        user: { id: r.user_id, first_name: r.first_name, last_name: r.last_name, profile_image: r.profile_image },
      })),
      summary: {
        avg_rating: Math.round(parseFloat(sm.avg || 0) * 100) / 100,
        total_reviews: parseInt(sm.total),
        rating_distribution: { 5: parseInt(sm.r5||0), 4: parseInt(sm.r4||0), 3: parseInt(sm.r3||0), 2: parseInt(sm.r2||0), 1: parseInt(sm.r1||0) },
      },
      pagination: { current_page: page, total_pages: Math.ceil(total / limit), page_size: limit, total_count: total, has_next: page * limit < total, has_previous: page > 1 },
    };
  }

  async submitTrainingReview(trainingId: string, userId: string, reviewData: { rating: number; review_text?: string }): Promise<any> {
    const check = await this.db.query(
      `SELECT id FROM training_enrollments WHERE training_id = $1 AND user_id = $2`,
      [trainingId, userId]
    );
    if (check.rows.length === 0) return null;

    const result = await this.db.query(
      `INSERT INTO training_reviews (training_id, user_id, rating, review_text)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (training_id, user_id)
       DO UPDATE SET rating = EXCLUDED.rating, review_text = EXCLUDED.review_text, updated_at = NOW()
       RETURNING *`,
      [trainingId, userId, reviewData.rating, reviewData.review_text ?? null]
    );

    await this.updateTrainingRating(trainingId);
    return result.rows[0];
  }

  async getTrainingAnalytics(trainingId: string, employerId: string, timeRange: string): Promise<any | null> {
    const epRow = await this.db.query('SELECT id FROM employers WHERE user_id = $1', [employerId]);
    const epId = epRow.rows.length > 0 ? epRow.rows[0].id : null;

    const own = await this.db.query(
      `SELECT * FROM trainings WHERE id = $1 AND (provider_id = $2 OR provider_id = $3)`,
      [trainingId, employerId, epId ?? '']
    );
    if (own.rows.length === 0) return null;

    let dateFilter = '';
    if (timeRange === '7days')  dateFilter = "AND enrolled_at >= CURRENT_DATE - INTERVAL '7 days'";
    if (timeRange === '30days') dateFilter = "AND enrolled_at >= CURRENT_DATE - INTERVAL '30 days'";
    if (timeRange === '90days') dateFilter = "AND enrolled_at >= CURRENT_DATE - INTERVAL '90 days'";

    const appStats = await this.db.query(
      `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status='shortlisted') AS shortlisted, COUNT(*) FILTER (WHERE status='rejected') AS rejected
       FROM training_applications WHERE training_id = $1`,
      [trainingId]
    );
    const enrStats = await this.db.query(
      `SELECT COUNT(*) AS total,
              COUNT(*) FILTER (WHERE status='completed')     AS completed,
              COUNT(*) FILTER (WHERE status='not_completed') AS not_completed,
              COUNT(*) FILTER (WHERE status='dropped')       AS dropped,
              COUNT(*) FILTER (WHERE certificate_issued=true) AS certs
       FROM training_enrollments WHERE training_id = $1 ${dateFilter}`,
      [trainingId]
    );

    const trend = await this.db.query(
      `SELECT DATE(enrolled_at) AS date, COUNT(*) AS enrollments,
              COUNT(*) FILTER (WHERE status='completed') AS completions
       FROM training_enrollments WHERE training_id = $1 ${dateFilter}
       GROUP BY DATE(enrolled_at) ORDER BY date`,
      [trainingId]
    );

    const reviews = await this.db.query(
      `SELECT AVG(rating) AS avg_rating, COUNT(*) AS count FROM training_reviews WHERE training_id = $1`,
      [trainingId]
    );

    const totalEnr  = parseInt(enrStats.rows[0].total);
    const completed = parseInt(enrStats.rows[0].completed);

    return {
      training_info: { id: own.rows[0].id, title: own.rows[0].title, status: own.rows[0].status },
      application_metrics: {
        total_applications: parseInt(appStats.rows[0].total),
        shortlisted: parseInt(appStats.rows[0].shortlisted),
        rejected: parseInt(appStats.rows[0].rejected),
      },
      enrollment_metrics: {
        total_enrollments: totalEnr,
        completed,
        not_completed: parseInt(enrStats.rows[0].not_completed),
        dropped: parseInt(enrStats.rows[0].dropped),
        completion_rate: totalEnr > 0 ? Math.round((completed / totalEnr) * 10000) / 100 : 0,
        certificates_issued: parseInt(enrStats.rows[0].certs),
      },
      review_metrics: { avg_rating: parseFloat(reviews.rows[0].avg_rating || 0), total_reviews: parseInt(reviews.rows[0].count) },
      trends: { daily_enrollments: trend.rows.map(r => ({ date: r.date, enrollments: parseInt(r.enrollments), completions: parseInt(r.completions) })) },
      time_range: timeRange,
    };
  }

  async getTrainingEnrollments(trainingId: string, employerId: string, params: any): Promise<any | null> {
  const epRow = await this.db.query('SELECT id FROM employers WHERE user_id = $1', [employerId]);
  const epId = epRow.rows.length > 0 ? epRow.rows[0].id : null;

  const own = await this.db.query(
    `SELECT id FROM trainings WHERE id = $1 AND (provider_id = $2 OR provider_id = $3)`,
    [trainingId, employerId, epId ?? '']
  );
  if (own.rows.length === 0) return null;

  const { page = 1, limit = 20, status } = params;
  const offset = (page - 1) * limit;
  let where = 'WHERE e.training_id = $1';
  const qp: any[] = [trainingId];
  let pi = 2;
  if (status) { where += ` AND e.status = $${pi++}`; qp.push(status); }
  qp.push(limit, offset);

  // ✅ FIX: Explicit column selection
  const enrollQuery = `
    SELECT 
      e.*,
      u.first_name,
      u.last_name,
      u.email,
      u.profile_image,
      u.contact_number,  -- ✅ Changed from phone_number
      COUNT(*) OVER() AS total_count
    FROM training_enrollments e
    JOIN users u ON e.user_id = u.id
    ${where}
    ORDER BY e.enrolled_at DESC
    LIMIT $${pi++} OFFSET $${pi++}
  `;

  const result = await this.db.query(enrollQuery, qp);
  const rows = result.rows;
  const total = rows.length > 0 ? parseInt(rows[0].total_count) : 0;

  return {
    enrollments: rows.map(r => ({
      id: r.id, 
      training_id: r.training_id, 
      user_id: r.user_id,
      status: r.status, 
      enrolled_at: r.enrolled_at, 
      completed_at: r.completed_at,
      completion_marked: r.completion_marked, 
      certificate_issued: r.certificate_issued,
      user: { 
        id: r.user_id, 
        first_name: r.first_name, 
        last_name: r.last_name, 
        email: r.email, 
        profile_image: r.profile_image || '', 
        phone_number: r.contact_number || ''  // ✅ Map to phone_number
      },
    })),
    pagination: { /* ... */ },
  };
}

  // ==========================================================================
  // 8. MISC METHODS
  // ==========================================================================

  async getTrainingCategories(): Promise<any[]> {
    const result = await this.db.query(
      `SELECT category, COUNT(*) AS cnt, AVG(rating) AS avg_rating,
              COUNT(*) FILTER (WHERE cost_type='Free') AS free_count,
              COUNT(*) FILTER (WHERE has_certificate=true) AS cert_count
       FROM trainings WHERE status IN ('published','applications_closed','in_progress','completed')
       GROUP BY category ORDER BY cnt DESC`
    );
    return result.rows.map(r => ({
      name: r.category, training_count: parseInt(r.cnt),
      avg_rating: parseFloat(r.avg_rating) || 0,
      free_count: parseInt(r.free_count), certificate_count: parseInt(r.cert_count),
    }));
  }

  async getPopularTrainings(limit: number = 10): Promise<any[]> {
    const result = await this.db.query(
      `SELECT t.*, COUNT(a.id) AS application_count
       FROM trainings t
       LEFT JOIN training_applications a ON a.training_id = t.id
       WHERE t.status IN ('published','applications_closed','in_progress')
       GROUP BY t.id
       ORDER BY application_count DESC, t.rating DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  }

  async getRecommendedTrainings(userId: string, limit: number = 10): Promise<any[]> {
    const result = await this.db.query(
      `WITH user_cats AS (
         SELECT DISTINCT t.category
         FROM training_enrollments e JOIN trainings t ON e.training_id = t.id
         WHERE e.user_id = $1
       )
       SELECT DISTINCT t.*,
              CASE WHEN uc.category IS NOT NULL THEN 2 ELSE 1 END AS score
       FROM trainings t
       LEFT JOIN user_cats uc ON t.category = uc.category
       LEFT JOIN training_applications a ON a.training_id = t.id AND a.user_id = $1
       WHERE t.status IN ('published') AND a.id IS NULL AND t.rating >= 3.5
       ORDER BY score DESC, t.rating DESC
       LIMIT $2`,
      [userId, limit]
    );
    return result.rows;
  }

  private async updateTrainingRating(trainingId: string): Promise<void> {
    const r = await this.db.query('SELECT AVG(rating) AS avg FROM training_reviews WHERE training_id = $1', [trainingId]);
    await this.db.query('UPDATE trainings SET rating = $1 WHERE id = $2', [parseFloat(r.rows[0].avg) || 0, trainingId]);
  }

  private mapTrainingFromDb(row: any): any {
    return {
      id: row.id, title: row.title, description: row.description, category: row.category,
      level: row.level, duration_hours: row.duration_hours, cost_type: row.cost_type,
      price: parseFloat(row.price), mode: row.mode, provider_id: row.provider_id,
      provider_name: row.provider_name, has_certificate: row.has_certificate,
      eligibility_requirements: row.eligibility_requirements,
      application_deadline: row.application_deadline,
      rating: parseFloat(row.rating), total_students: row.total_students,
      thumbnail_url: row.thumbnail_url, location: row.location,
      start_date: row.start_date, end_date: row.end_date,
      max_participants: row.max_participants, current_participants: row.current_participants,
      status: row.status, created_at: row.created_at, updated_at: row.updated_at,
    };
  }

  private mapTrainingWithContext(row: any): any {
    return {
      ...this.mapTrainingFromDb(row),
      has_applied: row.has_applied === true || row.has_applied === 'true',
      applied: row.applied === true || row.applied === 'true',
      is_enrolled: row.is_enrolled === true || row.is_enrolled === 'true',
      enrolled: row.enrolled === true || row.enrolled === 'true',
      application_status: row.application_status || null,
      enrollment_status:  row.enrollment_status  || null,
      applied_at:  row.applied_at  || null,
      enrolled_at: row.enrolled_at || null,
      completed_at: row.completed_at || null,
      certificate_issued: Boolean(row.certificate_issued),
      enrollment_id: row.enrollment_id || null,
    };
  }

  async markSessionAttendance(
    sessionId: string,
    enrollmentIds: string[],
    attendanceData: { enrollment_id: string; attended: boolean; notes?: string }[],
    employerId: string
  ): Promise<any> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      const session = await client.query(
        `SELECT ts.*, t.provider_id 
         FROM training_sessions ts
         JOIN trainings t ON ts.training_id = t.id
         WHERE ts.id = $1`,
        [sessionId]
      );

      if (session.rows.length === 0) throw new Error('Session not found');

      const epRow = await client.query('SELECT id FROM employers WHERE user_id = $1', [employerId]);
      const epId = epRow.rows.length > 0 ? epRow.rows[0].id : null;

      if (session.rows[0].provider_id !== employerId && session.rows[0].provider_id !== epId) {
        throw new Error('Unauthorized');
      }

      for (const record of attendanceData) {
        const enr = await client.query(
          'SELECT user_id FROM training_enrollments WHERE id = $1',
          [record.enrollment_id]
        );

        if (enr.rows.length > 0) {
          await client.query(
            `INSERT INTO session_attendance (session_id, enrollment_id, user_id, attended, notes, attendance_marked_at)
             VALUES ($1, $2, $3, $4, $5, NOW())
             ON CONFLICT (session_id, enrollment_id)
             DO UPDATE SET attended = $4, notes = $5, attendance_marked_at = NOW()`,
            [sessionId, record.enrollment_id, enr.rows[0].user_id, record.attended, record.notes || null]
          );
        }
      }

      for (const record of attendanceData) {
        await this.updateEnrollmentAttendanceRate(record.enrollment_id, client);
      }

      await client.query('COMMIT');

      return { success: true, message: 'Attendance marked successfully' };
    } catch (err: any) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  private async updateEnrollmentAttendanceRate(enrollmentId: string, client: any): Promise<void> {
    const result = await client.query(
      `SELECT 
         COUNT(*) as total_sessions,
         COUNT(*) FILTER (WHERE attended = true) as attended_sessions
       FROM session_attendance
       WHERE enrollment_id = $1`,
      [enrollmentId]
    );

    const total = parseInt(result.rows[0].total_sessions);
    const attended = parseInt(result.rows[0].attended_sessions);
    const rate = total > 0 ? Math.round((attended / total) * 100) : 0;

    await client.query(
      'UPDATE training_enrollments SET attendance_rate = $1 WHERE id = $2',
      [rate, enrollmentId]
    );
  }

  async getSessionAttendance(sessionId: string, employerId: string): Promise<any> {
    const epRow = await this.db.query('SELECT id FROM employers WHERE user_id = $1', [employerId]);
    const epId = epRow.rows.length > 0 ? epRow.rows[0].id : null;

    const session = await this.db.query(
      `SELECT ts.*, t.provider_id 
       FROM training_sessions ts
       JOIN trainings t ON ts.training_id = t.id
       WHERE ts.id = $1 AND (t.provider_id = $2 OR t.provider_id = $3)`,
      [sessionId, employerId, epId ?? '']
    );

    if (session.rows.length === 0) return null;

    const result = await this.db.query(
      `SELECT 
         e.id as enrollment_id,
         e.user_id,
         u.first_name,
         u.last_name,
         u.email,
         COALESCE(sa.attended, false) as attended,
         sa.notes,
         sa.attendance_marked_at
       FROM training_enrollments e
       JOIN users u ON e.user_id = u.id
       LEFT JOIN session_attendance sa ON sa.enrollment_id = e.id AND sa.session_id = $1
       WHERE e.training_id = $2 AND e.status = 'enrolled'
       ORDER BY u.last_name, u.first_name`,
      [sessionId, session.rows[0].training_id]
    );

    return {
      session: session.rows[0],
      attendance: result.rows.map(r => ({
        enrollment_id: r.enrollment_id,
        user_id: r.user_id,
        user_name: `${r.first_name} ${r.last_name}`,
        email: r.email,
        attended: r.attended,
        notes: r.notes,
        marked_at: r.attendance_marked_at,
      })),
    };
  }
}