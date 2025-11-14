// src/services/job-notification.service.ts
import { Pool } from 'pg';
import pool from '../db/db.config';

export class JobNotificationService {
  private db: Pool;

  constructor() {
    this.db = pool;
  }

  /**
   * Create a notification for a user
   */
  async createNotification(
    userId: string,
    type: string,
    message: string,
    metadata: any
  ): Promise<void> {
    try {
      const title = this.generateNotificationTitle(type, message);
      
      console.log('📬 Creating job notification:', {
        userId,
        type,
        title,
        messagePreview: message.substring(0, 50)
      });

      // Check if notifications table exists
      const tableExists = await this.db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'notifications'
        );
      `);

      if (!tableExists.rows[0]?.exists) {
        console.warn('⚠️ Notifications table does not exist - skipping');
        return;
      }

      // Extract related_id from metadata
      const relatedId = metadata?.job_id || 
                        metadata?.application_id || 
                        null;

      console.log('🔗 Related ID for notification:', relatedId);

      // Insert notification
      await this.db.query(`
        INSERT INTO notifications (
          user_id, 
          type, 
          title, 
          message, 
          metadata, 
          related_id,
          created_at, 
          read
        )
        VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, false)
      `, [
        userId, 
        type, 
        title, 
        message, 
        JSON.stringify(metadata),
        relatedId
      ]);

      console.log('✅ Job notification created successfully');
    } catch (error: any) {
      console.error('❌ Error creating job notification:', error);
      console.error('Error code:', error.code);
      console.error('Error detail:', error.detail);
      
      // Don't throw - notifications are non-critical
      if (error.code === '23502') {
        console.error('💥 NOT NULL constraint violation - check notifications table schema');
      }
    }
  }

  /**
   * Generate notification title based on type
   */
  private generateNotificationTitle(type: string, message: string): string {
    const titleMap: Record<string, string> = {
      'new_job': '💼 New Job Posted',
      'job_updated': '✏️ Job Updated',
      'job_deleted': '🗑️ Job Removed',
      'job_closed': '🔒 Job Closed',
      'job_filled': '✅ Job Filled',
      'application_received': '📨 New Application',
      'application_reviewed': '👀 Application Reviewed',
      'application_shortlisted': '⭐ You\'re Shortlisted!',
      'application_rejected': '❌ Application Update',
      'application_accepted': '🎉 Application Accepted!',
      'interview_scheduled': '📅 Interview Scheduled',
      'job_status_changed': '🔄 Job Status Changed'
    };
    return titleMap[type] || message.split('.')[0].substring(0, 255) || 'Job Update';
  }

  /**
   * 🔥 FIXED: Notify employer about new application
   */
  async notifyEmployerAboutApplication(
    jobId: string,
    jobTitle: string,
    applicantName: string,
    applicationId: string
  ): Promise<void> {
    try {
      console.log('📢 Notifying employer about new application for job:', jobId);

      // 🔥 FIX: Get employer's USER_ID (not employer_id)
      const employerQuery = await this.db.query(`
        SELECT e.user_id, u.email, u.first_name, u.last_name
        FROM jobs j
        JOIN employers e ON j.employer_id = e.id
        JOIN users u ON e.user_id = u.id
        WHERE j.id = $1
      `, [jobId]);

      if (employerQuery.rows.length === 0) {
        console.error('❌ Employer not found for job:', jobId);
        return;
      }

      const employer = employerQuery.rows[0];
      const employerUserId = employer.user_id; // 🔥 This is the correct user_id

      console.log('✅ Found employer user_id:', employerUserId);

      await this.createNotification(
        employerUserId, // 🔥 Use user_id, not employer_id
        'application_received',
        `${applicantName} applied for ${jobTitle}`,
        {
          job_id: jobId,
          job_title: jobTitle,
          applicant_name: applicantName,
          application_id: applicationId,
          action: 'new_application'
        }
      );

      console.log('✅ Employer notified about new application');
    } catch (error: any) {
      console.error('❌ Error notifying employer:', error);
    }
  }

  /**
   * Notify jobseeker about application status change
   */
  async notifyJobseekerAboutApplicationStatus(
    jobseekerId: string,
    jobId: string,
    jobTitle: string,
    status: string,
    applicationId: string,
    companyName?: string
  ): Promise<void> {
    try {
      console.log('📢 Notifying jobseeker about application status change');

      let notificationType: string;
      let message: string;

      switch (status) {
        case 'reviewed':
          notificationType = 'application_reviewed';
          message = `Your application for ${jobTitle} at ${companyName || 'the company'} is being reviewed`;
          break;
        case 'shortlisted':
          notificationType = 'application_shortlisted';
          message = `Congratulations! You've been shortlisted for ${jobTitle} at ${companyName || 'the company'}`;
          break;
        case 'rejected':
          notificationType = 'application_rejected';
          message = `Your application for ${jobTitle} at ${companyName || 'the company'} was not successful`;
          break;
        case 'accepted':
          notificationType = 'application_accepted';
          message = `Great news! Your application for ${jobTitle} at ${companyName || 'the company'} has been accepted`;
          break;
        default:
          notificationType = 'application_reviewed';
          message = `Application status updated for ${jobTitle}`;
      }

      await this.createNotification(
        jobseekerId,
        notificationType,
        message,
        {
          job_id: jobId,
          job_title: jobTitle,
          company_name: companyName,
          application_id: applicationId,
          status: status,
          action: 'status_change'
        }
      );

      console.log('✅ Jobseeker notified about application status');
    } catch (error: any) {
      console.error('❌ Error notifying jobseeker:', error);
    }
  }

  /**
   * 🔥 FIXED: Notify jobseekers about new job posting (relevant to their profile)
   */
  async notifyJobseekersAboutNewJob(
    jobId: string,
    jobTitle: string,
    companyName: string,
    skills: string[],
    location: string,
    employmentType: string
  ): Promise<void> {
    try {
      console.log('📢 Finding relevant jobseekers for new job:', jobTitle);

      // 🔥 FIX: Only get jobseeker users, not employers
      const BATCH_SIZE = 1000;
      let offset = 0;
      let hasMore = true;
      let notifiedCount = 0;

      while (hasMore) {
        const jobseekers = await this.db.query(`
          SELECT DISTINCT u.id, u.first_name, u.last_name, u.email
          FROM users u
          LEFT JOIN user_profiles up ON u.id = up.user_id
          WHERE u.user_type = 'jobseeker' 
            AND u.deleted_at IS NULL
            AND u.is_active = true
            AND (
              up.skills && $1::text[]
              OR up.preferred_location ILIKE $2
              OR $3 = ANY(up.preferred_job_types)
            )
          ORDER BY u.id
          LIMIT $4 OFFSET $5
        `, [skills, `%${location}%`, employmentType, BATCH_SIZE, offset]);

        if (jobseekers.rows.length === 0) {
          hasMore = false;
          break;
        }

        console.log(`📤 Processing batch: ${offset + 1} to ${offset + jobseekers.rows.length}`);

        const message = `New job opportunity: ${jobTitle} at ${companyName}`;
        const metadata = {
          job_id: jobId,
          job_title: jobTitle,
          company_name: companyName,
          location: location,
          employment_type: employmentType
        };

        // Use Promise.all for parallel inserts within batch
        await Promise.all(
          jobseekers.rows.map(jobseeker =>
            this.createNotification(jobseeker.id, 'new_job', message, metadata)
          )
        );

        notifiedCount += jobseekers.rows.length;
        offset += BATCH_SIZE;
        
        if (jobseekers.rows.length < BATCH_SIZE) {
          hasMore = false;
        }
      }

      console.log(`✅ Notified ${notifiedCount} relevant jobseekers about new job`);
    } catch (error: any) {
      console.error('❌ Error notifying jobseekers:', error);
    }
  }

  /**
   * Notify jobseekers about job update
   */
  async notifyJobseekersSavedJob(
    jobId: string,
    jobTitle: string,
    updateType: 'updated' | 'deleted' | 'closed' | 'filled'
  ): Promise<void> {
    try {
      console.log(`📢 Notifying jobseekers who saved job: ${jobTitle}`);

      // Get jobseekers who bookmarked this job
      const savedUsers = await this.db.query(`
        SELECT DISTINCT u.id, u.first_name, u.last_name
        FROM job_bookmarks jb
        JOIN users u ON jb.user_id = u.id
        WHERE jb.job_id = $1
          AND u.user_type = 'jobseeker'
          AND u.deleted_at IS NULL
      `, [jobId]);

      console.log(`✅ Found ${savedUsers.rows.length} users who saved this job`);

      let notificationType: string;
      let message: string;

      switch (updateType) {
        case 'updated':
          notificationType = 'job_updated';
          message = `"${jobTitle}" has been updated`;
          break;
        case 'deleted':
          notificationType = 'job_deleted';
          message = `"${jobTitle}" has been removed`;
          break;
        case 'closed':
          notificationType = 'job_closed';
          message = `"${jobTitle}" is no longer accepting applications`;
          break;
        case 'filled':
          notificationType = 'job_filled';
          message = `"${jobTitle}" position has been filled`;
          break;
      }

      await Promise.all(
        savedUsers.rows.map(user =>
          this.createNotification(
            user.id,
            notificationType,
            message,
            {
              job_id: jobId,
              job_title: jobTitle,
              action: updateType
            }
          )
        )
      );

      console.log('✅ All users notified about job update');
    } catch (error: any) {
      console.error('❌ Error notifying saved job users:', error);
    }
  }

  /**
   * 🔥 FIXED: Get notifications for user - only job-related notifications
   */
async getNotifications(
  userId: string,
  params: { read?: boolean | string; page?: number; limit?: number }
): Promise<any> {
  const { page = 1, limit = 10, read } = params;
  const offset = (page - 1) * limit;

  console.log('🔔 Backend: Getting job notifications:', {
    userId,
    page,
    limit,
    read: typeof read === 'string' ? read : read ? 'true' : 'false'
  });

  // 🔥 Filter only job-related notification types
  const jobNotificationTypes = [
    'new_job',
    'job_updated',
    'job_deleted',
    'job_closed',
    'job_filled',
    'application_received',
    'application_reviewed',
    'application_shortlisted',
    'application_rejected',
    'application_accepted',
    'interview_scheduled',
    'job_status_changed'
  ];

  let whereClause = 'WHERE user_id = $1 AND type = ANY($2)';
  const queryParams: any[] = [userId, jobNotificationTypes];
  let paramIndex = 3;

  // 🟡 Optional: read filter
  if (read !== undefined) {
    const readBool = (read === true || read === 'true');
    whereClause += ` AND read = $${paramIndex++}`;
    queryParams.push(readBool);
    console.log('🔔 Read filter applied:', readBool);
  }

  // 🆕 DEBUG → Count all notifications (NO filters)
  const totalDebugResult = await this.db.query(
    'SELECT COUNT(*) AS total_all FROM notifications WHERE user_id = $1',
    [userId]
  );
  console.log('🔍 DEBUG: Total notifications for user (no filters):', totalDebugResult.rows[0].total_all);

  // Main filtered job notification query
  const query = `
    SELECT
      id,
      user_id,
      type,
      title,
      message,
      metadata,
      related_id,
      read,
      created_at,
      COUNT(*) OVER() AS total_count
    FROM notifications
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}
  `;

  queryParams.push(limit, offset);

  console.log('🔍 Notification query params:', queryParams.slice(0, 3));

  const result = await this.db.query(query, queryParams);

  const totalCount =
    result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;

  console.log('✅ Job Notifications fetched:', {
    count: result.rows.length,
    unread: result.rows.filter(r => !r.read).length,
    total: totalCount,
    types: [...new Set(result.rows.map(r => r.type))]
  });

  return {
    notifications: result.rows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      type: row.type,
      title: row.title,
      message: row.message,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      related_id: row.related_id,
      read: row.read,
      created_at: row.created_at
    })),
    pagination: {
      current_page: page,
      total_pages: Math.ceil(totalCount / limit),
      total_count: totalCount
    }
  };
}

async createTestJobNotification(userId: string): Promise<void> {
  await this.createNotification(
    userId,
    'application_reviewed',
    'Your application for Frontend Developer has been reviewed!',
    {
      job_id: 'test-job-123',
      job_title: 'Frontend Developer',
      company_name: 'TechCorp',
      application_id: 'test-app-123',
      status: 'reviewed',
      action: 'status_change'
    }
  );
  console.log('✅ Test job notification created for user:', userId);
}

  /**
   * Mark notification as read
   */
  async markNotificationRead(notificationId: string, userId: string): Promise<void> {
    await this.db.query(
      'UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2',
      [notificationId, userId]
    );
  }

  /**
   * Mark all notifications as read
   */
  async markAllNotificationsRead(userId: string): Promise<void> {
    await this.db.query(
      'UPDATE notifications SET read = true WHERE user_id = $1 AND read = false',
      [userId]
    );
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    await this.db.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2',
      [notificationId, userId]
    );
  }
}