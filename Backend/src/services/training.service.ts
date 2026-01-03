import { Pool } from 'pg';
import {
  Training,
  CreateTrainingRequest,
  UpdateTrainingRequest,
  TrainingSearchParams,
  TrainingListResponse,
  TrainingStatsResponse,
  TrainingEnrollment
} from '../types/training.type';
import PDFDocument from 'pdfkit';
import { createWriteStream } from 'fs';
import { join } from 'path';

export class TrainingService {

  constructor(private db: Pool) {}

  // ============================================
  // NOTIFICATION SYSTEM
  // ============================================
// ✅ FIXED: Always include related_id when creating notifications
async createNotification(
  userId: string,
  type: string,
  message: string,
  metadata: any
): Promise<void> {
  try {
    const title = this.generateNotificationTitle(type, message);
    
    console.log('📬 Creating notification:', {
      userId,
      type,
      title,
      messagePreview: message.substring(0, 50),
      metadata
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

    // ✅ CRITICAL FIX: Extract related_id from metadata with priority
    // The related_id column is UUID type in the database
    let relatedId: string | null = null;
    
    // Try enrollment_id first (for certificate_issued notifications)
    if (metadata?.enrollment_id) {
      relatedId = metadata.enrollment_id;
    }
    // Then try training_id
    else if (metadata?.training_id) {
      relatedId = metadata.training_id;
    }
    // Then try certificate_id
    else if (metadata?.certificate_id) {
      relatedId = metadata.certificate_id;
    }

    if (!relatedId) {
      console.warn('⚠️ No related_id found in metadata:', metadata);
    } else {
      console.log('🔗 Related ID for notification:', relatedId);
    }

    // ✅ CRITICAL FIX: Use parameterized query with proper UUID casting
    // PostgreSQL will handle the UUID conversion automatically when we pass the string
    const query = `
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
      VALUES ($1, $2, $3, $4, $5, $6::UUID, CURRENT_TIMESTAMP, false)
    `;
    
    const values = [
      userId, 
      type, 
      title, 
      message, 
      JSON.stringify(metadata),
      relatedId  // Pass as string, PostgreSQL will cast to UUID
    ];

    await this.db.query(query, values);

    console.log('✅ Notification created successfully with related_id:', relatedId);
  } catch (error: any) {
    console.error('❌ Error creating notification:', error);
    console.error('Error code:', error.code);
    console.error('Error detail:', error.detail);
    
    // Log specific errors
    if (error.code === '23502') {
      console.error('💥 NOT NULL constraint violation - check notifications table schema');
    } else if (error.code === '22P02') {
      console.error('💥 Invalid UUID format - check related_id value');
    } else if (error.code === '23503') {
      console.error('💥 Foreign key constraint violation - check related_id references');
    }
    
    // Don't throw - notifications are non-critical
  }
}

// Alternative: If you want to make related_id required, update the signature
async createNotificationWithRelatedId(
  userId: string,
  type: string,
  message: string,
  metadata: any,
  relatedId: string  // ✅ Make it explicit
): Promise<void> {
  try {
    const title = this.generateNotificationTitle(type, message);
    
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

    console.log('✅ Notification created with related_id:', relatedId);
  } catch (error: any) {
    console.error('❌ Error creating notification:', error);
  }
}



private generateNotificationTitle(type: string, message: string): string {
  const titleMap: Record<string, string> = {
    'new_training': '🎓 New Training Available',
    'training_updated': '✏️ Training Updated',
    'training_deleted': '🗑️ Training Removed',
    'training_suspended': '⏸️ Training Suspended',
    'training_published': '📢 Training Published',
    'certificate_issued': '🎓 Certificate Ready',
    'training_completed': '🎉 Training Completed',
    'enrollment_confirmed': '✅ Enrollment Confirmed',
    'video_added': '📹 New Video Added',
    'content_updated': '📝 Content Updated',
    'new_enrollment': '👤 New Enrollment'
  };
  return titleMap[type] || message.split('.')[0].substring(0, 255) || 'Training Update';
}

async notifyEnrolledJobseekers(
  trainingId: string,
  notificationType: 'training_updated' | 'training_deleted' | 'training_suspended' | 'video_added' | 'content_updated',
  message: string,
  metadata: any
): Promise<void> {
  try {
    console.log('📢 Notifying enrolled jobseekers:', {
      trainingId,
      type: notificationType
    });

    const enrolledUsers = await this.db.query(`
      SELECT DISTINCT te.user_id, u.first_name, u.last_name
      FROM training_enrollments te
      JOIN users u ON te.user_id = u.id
      WHERE te.training_id = $1
        AND te.status IN ('enrolled', 'in_progress')
    `, [trainingId]);

    console.log(`✅ Found ${enrolledUsers.rows.length} enrolled users to notify`);

    await Promise.all(
      enrolledUsers.rows.map(user =>
        this.createNotification(
          user.user_id,
          notificationType,
          message,
          {
            ...metadata,
            training_id: trainingId  // ✅ Ensure training_id is in metadata
          }
        )
      )
    );

    console.log('✅ All enrolled users notified successfully');
  } catch (error: any) {
    console.error('❌ Error notifying enrolled jobseekers:', error);
  }
}

  /**
   * Notify jobseekers about new training opportunities
   */
async notifyJobseekersAboutNewTraining(
  trainingId: string,
  trainingTitle: string,
  category: string,
  employerName: string
): Promise<void> {
  try {
    console.log('📢 Notifying jobseekers about new training:', trainingTitle);

    // ✅ FIXED: Batch notifications (1000 at a time to avoid memory issues)
    const BATCH_SIZE = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const jobseekers = await this.db.query(`
        SELECT id, first_name, last_name, email
        FROM users
        WHERE user_type = 'jobseeker' AND deleted_at IS NULL
        ORDER BY id
        LIMIT $1 OFFSET $2
      `, [BATCH_SIZE, offset]);

      if (jobseekers.rows.length === 0) {
        hasMore = false;
        break;
      }

      console.log(`📤 Processing batch: ${offset + 1} to ${offset + jobseekers.rows.length}`);

      const message = `New training available: "${trainingTitle}" by ${employerName}`;
      const metadata = {
        training_id: trainingId,
        training_title: trainingTitle,
        category,
        employer_name: employerName
      };

      // ✅ Use Promise.all for parallel inserts within batch
      await Promise.all(
        jobseekers.rows.map(jobseeker =>
          this.createNotification(jobseeker.id, 'new_training', message, metadata)
        )
      );

      offset += BATCH_SIZE;
      if (jobseekers.rows.length < BATCH_SIZE) {
        hasMore = false;
      }
    }

    console.log(`✅ All jobseekers notified about new training (total: ${offset})`);
  } catch (error: any) {
    console.error('❌ Error notifying jobseekers:', error);
  }
}

  async notifyEnrolledJobseekersAboutNewVideo(
    trainingId: string,
    trainingTitle: string,
    videoTitle: string,
    employerName: string
  ): Promise<void> {
    try {
      console.log('📹 Notifying enrolled jobseekers about new video:', videoTitle);
    
      // Get all enrolled users for this training
      const enrolledUsers = await this.db.query(`
        SELECT DISTINCT te.user_id, u.first_name, u.last_name, u.email
        FROM training_enrollments te
        JOIN users u ON te.user_id = u.id
        WHERE te.training_id = $1
          AND te.status IN ('enrolled', 'in_progress')
      `, [trainingId]);
    
      console.log(`✅ Found ${enrolledUsers.rows.length} enrolled users to notify`);
    
      const message = `New video added to ${trainingTitle}: ${videoTitle}`;
      const metadata = {
        training_id: trainingId,
        training_title: trainingTitle,
        video_title: videoTitle,
        employer_name: employerName,
        action: 'video_added'
      };
    
      // Create notifications for each enrolled user
      for (const user of enrolledUsers.rows) {
        await this.createNotification(
          user.user_id,
          'video_added',
          message,
          metadata
        );
      }
    
      console.log('✅ All enrolled users notified about new video');
    } catch (error: any) {
      console.error('❌ Error notifying about new video:', error);
      // Don't throw - notifications are non-critical
    }
  }

  // In backend training.service.ts - Replace getNotifications method
async getNotifications(
  userId: string,
  params: { page?: number; limit?: number; read?: boolean | string }
): Promise<any> {
  const { page = 1, limit = 10, read } = params;
  const offset = (page - 1) * limit;
  
  console.log('🔔 Backend: Getting notifications:', {
    userId,
    page,
    limit,
    read: typeof read === 'string' ? read : read ? 'true' : 'false'
  });
  
  let whereClause = 'WHERE user_id = $1';
  const queryParams: any[] = [userId];
  let paramIndex = 2;
  
  if (read !== undefined) {
    const readBool = (read === true || read === 'true');
    whereClause += ` AND read = $${paramIndex++}`;
    queryParams.push(readBool);
    console.log('🔔 Read filter applied:', readBool);
  }
  
  const query = `
    SELECT
      id,
      user_id,
      type,
      title,
      message,
      metadata,
      read,
      created_at,
      COUNT(*) OVER() as total_count
    FROM notifications
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}
  `;
  
  queryParams.push(limit, offset);
  
  console.log('🔍 Notification query params:', queryParams.slice(0, 3));
  
  const result = await this.db.query(query, queryParams);
  
  const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;
  
  console.log('✅ Notifications fetched:', {
    count: result.rows.length,
    unread: result.rows.filter(r => !r.read).length,
    total: totalCount
  });
  
  return {
    notifications: result.rows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      type: row.type,
      title: row.title,
      message: row.message,
      // ✅ FIX: PostgreSQL json/jsonb columns return JavaScript objects, not strings
      // Only parse if it's actually a string
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
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

  async markNotificationRead(notificationId: string, userId: string): Promise<void> {
    await this.db.query(
      'UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2',
      [notificationId, userId]
    );
  }

  // ============================================
  // ENROLLMENT CHECK
  // ============================================
  async isUserEnrolled(trainingId: string, userId: string): Promise<boolean> {
    const result = await this.db.query(
      'SELECT id FROM training_enrollments WHERE training_id = $1 AND user_id = $2',
      [trainingId, userId]
    );
    return result.rows.length > 0;
  }

  // ============================================
  // VIDEO PROGRESS TRACKING (Backend)
  // ============================================
async updateVideoProgress(
  trainingId: string,
  userId: string,
  videoId: string,
  watchTimeSeconds: number,
  isCompleted: boolean
): Promise<any> {
  const client = await this.db.connect();
  try {
    console.log('💾 Starting video progress update:', {
      trainingId,
      userId,
      videoId,
      watchTimeSeconds,
      isCompleted
    });

    await client.query('BEGIN');

    // Step 1: Check if user is enrolled
    console.log('1️⃣ Checking enrollment...');
    const enrollmentResult = await client.query(
      'SELECT id FROM training_enrollments WHERE training_id = $1 AND user_id = $2',
      [trainingId, userId]
    );

    if (enrollmentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      throw new Error('User is not enrolled in this training');
    }

    const enrollmentId = enrollmentResult.rows[0].id;
    console.log('✅ Enrollment found:', enrollmentId);

    // Step 2: Check if video exists
    console.log('2️⃣ Checking video exists...');
    const videoCheck = await client.query(
      'SELECT id, title FROM training_videos WHERE id = $1 AND training_id = $2',
      [videoId, trainingId]
    );

    if (videoCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      throw new Error('Video not found in this training');
    }

    console.log('✅ Video found:', videoCheck.rows[0].title);

    // Step 3: Upsert video progress
    console.log('3️⃣ Upserting video progress...');
    const progressResult = await client.query(`
      INSERT INTO training_video_progress
        (enrollment_id, video_id, watch_time_seconds, is_completed, completed_at, last_updated)
      VALUES ($1, $2, $3, $4,
        CASE WHEN $4 THEN CURRENT_TIMESTAMP ELSE NULL END,
        CURRENT_TIMESTAMP)
      ON CONFLICT (enrollment_id, video_id)
      DO UPDATE SET
        watch_time_seconds = GREATEST(training_video_progress.watch_time_seconds, EXCLUDED.watch_time_seconds),
        is_completed = EXCLUDED.is_completed OR training_video_progress.is_completed,
        completed_at = CASE
          WHEN EXCLUDED.is_completed AND training_video_progress.completed_at IS NULL
          THEN CURRENT_TIMESTAMP
          ELSE training_video_progress.completed_at
        END,
        last_updated = CURRENT_TIMESTAMP
      RETURNING *
    `, [enrollmentId, videoId, watchTimeSeconds, isCompleted]);

    console.log('✅ Video progress saved:', progressResult.rows[0]);

    // Step 4: Recalculate overall progress
    console.log('4️⃣ Calculating overall progress...');
    const progressCalc = await client.query(`
      SELECT
        COUNT(*) as total_videos,
        COUNT(*) FILTER (WHERE tvp.is_completed = true) as completed_videos
      FROM training_videos tv
      LEFT JOIN training_video_progress tvp
        ON tv.id = tvp.video_id AND tvp.enrollment_id = $1
      WHERE tv.training_id = $2
    `, [enrollmentId, trainingId]);

    const { total_videos, completed_videos } = progressCalc.rows[0];
    const progressPercentage = total_videos > 0
      ? Math.round((completed_videos / total_videos) * 100)
      : 0;

    console.log('📊 Progress calculated:', {
      total_videos,
      completed_videos,
      progressPercentage
    });

    // Step 5: Update enrollment
    console.log('5️⃣ Updating enrollment...');
    const enrollmentUpdate = await client.query(`
      UPDATE training_enrollments
      SET
        progress_percentage = $1,
        status = CASE
          WHEN $1 = 100 THEN 'completed'
          WHEN $1 > 0 THEN 'in_progress'
          ELSE status
        END,
        completed_at = CASE
          WHEN $1 = 100 AND completed_at IS NULL
          THEN CURRENT_TIMESTAMP
          ELSE completed_at
        END
      WHERE id = $2
      RETURNING *
    `, [progressPercentage, enrollmentId]);

    const enrollment = enrollmentUpdate.rows[0];
    console.log('✅ Enrollment updated:', {
      progress: enrollment.progress_percentage,
      status: enrollment.status
    });

    const trainingCompleted = progressPercentage === 100;
    let certificateIssued = false;
    let certificateUrl: string | null = null;

    // Step 6: Check for certificate if completed
    if (trainingCompleted) {
      console.log('6️⃣ Checking certificate eligibility...');
      // Fetch training and user details for notifications and certificate logic
      const trainingQuery = await client.query(
        'SELECT has_certificate, provider_id, title FROM trainings WHERE id = $1',
        [trainingId]
      );
      const trainingRow = trainingQuery.rows[0];

      const userQuery = await client.query(
        'SELECT first_name, last_name, email FROM users WHERE id = $1',
        [userId]
      );
      const userRow = userQuery.rows[0];
      const userName = `${(userRow.first_name || '').trim()} ${(userRow.last_name || '').trim()}`.trim() || userRow.email || 'User';
      const trainingTitle = trainingRow.title;

      // If training supports auto-certificate issuance, generate it
      if (trainingRow.has_certificate) {
        console.log('📜 Generating certificate (auto-issue)...');
        const certResult = await this.generateCertificate(
          enrollmentId,
          userId,
          trainingId,
          trainingTitle
        );

        certificateIssued = true;
        certificateUrl = certResult.certificate_url;

        await client.query(`
          UPDATE training_enrollments
          SET certificate_issued = true, certificate_url = $1, certificate_issued_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [certificateUrl, enrollmentId]);

        console.log('✅ Certificate generated and enrollment updated:', certificateUrl);
      } else {
        console.log('ℹ️ Training does not auto-issue certificates - manual issuance required');
      }

      // ✅ ENHANCED: Always notify employer on completion (even if no auto-certificate)
      const employerNotificationMessage = `${userName} has completed "${trainingTitle}" – ready to issue certificate!`;
      console.log(`📢 Notifying employer: ${employerNotificationMessage}`);

      // Insert additional employer notification requested by user (adapted to available variables)
      console.log('🎉 Training completed! Notifying employer...');

      const jobseekerName = userName;

      // ✅ NOTIFY EMPLOYER about training completion (additional detailed notification)
      await this.createNotification(
        trainingRow.provider_id,  // Employer user_id / provider id
        'training_completed',
        `${jobseekerName} completed "${trainingTitle}"! Ready for certificate issuance.`,
        {
          training_id: trainingId,
          enrollment_id: enrollment.id,
          jobseeker_id: userId,
          jobseeker_name: jobseekerName,
          jobseeker_email: userRow.email,
          training_title: trainingTitle,
          completed_at: new Date().toISOString()
        }
      );

      console.log('✅ Employer notified of training completion');

      await this.createNotification(
        trainingRow.provider_id,
        'training_completed',
        employerNotificationMessage,
        {
          training_id: trainingId,
          user_id: userId,
          enrollment_id: enrollmentId,
          user_name: userName,
          training_title: trainingTitle
        }
      ).catch(err => console.error('Failed to notify employer about completion:', err));

      // Notify jobseeker:
      if (certificateIssued && certificateUrl) {
        // If auto-issued, inform jobseeker of the certificate (certificate_issued)
        await this.createNotification(
          userId,
          'certificate_issued',
          `Congratulations! You've earned a certificate for ${trainingTitle}`,
          { training_id: trainingId, enrollment_id: enrollmentId, certificate_url: certificateUrl }
        ).catch(err => console.error('Failed to notify jobseeker about certificate:', err));
      } else {
        // If manual issuance is required, notify the jobseeker that employer needs to issue the certificate
        await this.createNotification(
          userId,
          'training_completed',
          `You've completed "${trainingTitle}"! Awaiting certificate from employer.`,
          { training_id: trainingId, enrollment_id: enrollmentId }
        ).catch(err => console.error('Failed to notify jobseeker about completion awaiting certificate:', err));
      }
    }

    await client.query('COMMIT');
    console.log('✅ Transaction committed successfully');

    return {
      success: true,
      overall_progress: progressPercentage,
      training_completed: trainingCompleted,
      certificate_issued: certificateIssued,
      certificate_url: certificateUrl,
      enrollment,
      video_progress: progressResult.rows[0]
    };
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('❌ Error in updateVideoProgress service:', error);
    console.error('Stack:', error.stack);
    throw error;
  } finally {
    client.release();
  }
}

  // ============================================
  // CERTIFICATE GENERATION
  // ============================================
// ✅ FIXED: Generate certificate with correct path
async generateCertificate(
  enrollmentId: string,
  userId: string,
  trainingId: string,
  trainingTitle: string
): Promise<{ certificate_url: string }> {
  // Get user details
  const userResult = await this.db.query(
    'SELECT first_name, last_name, email FROM users WHERE id = $1',
    [userId]
  );
  const user = userResult.rows[0];
  const userName = `${user.first_name} ${user.last_name}`;

  const certificateFileName = `certificate-${enrollmentId}-${Date.now()}.pdf`;

  // Generate PDF certificate (using PDFKit)
  const fs = require('fs');
  const path = require('path');
  const PDFDocument = require('pdfkit');

  // ✅ CRITICAL FIX: Ensure correct path structure
  const baseUploadPath = path.join(__dirname, '../../uploads');
  const certificateDir = path.join(baseUploadPath, 'certificates');
  
  // ✅ Create directory if it doesn't exist
  if (!fs.existsSync(certificateDir)) {
    fs.mkdirSync(certificateDir, { recursive: true });
    console.log('📁 Created certificates directory:', certificateDir);
  }

  const certificatePath = path.join(certificateDir, certificateFileName);
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape' });
  const writeStream = fs.createWriteStream(certificatePath);

  doc.pipe(writeStream);

  // Certificate design
  doc.rect(50, 50, doc.page.width - 100, doc.page.height - 100).stroke();
  doc.rect(55, 55, doc.page.width - 110, doc.page.height - 110).stroke();

  doc.fontSize(40).font('Helvetica-Bold').text('Certificate of Completion', 100, 120, {
    align: 'center',
    width: doc.page.width - 200
  });

  doc.fontSize(16).font('Helvetica').text('This is to certify that', 100, 200, {
    align: 'center',
    width: doc.page.width - 200
  });

  doc.fontSize(30).font('Helvetica-Bold').text(userName, 100, 240, {
    align: 'center',
    width: doc.page.width - 200
  });

  doc.fontSize(16).font('Helvetica').text('has successfully completed the training', 100, 300, {
    align: 'center',
    width: doc.page.width - 200
  });

  doc.fontSize(24).font('Helvetica-Bold').text(trainingTitle, 100, 340, {
    align: 'center',
    width: doc.page.width - 200
  });

  const completionDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  doc.fontSize(14).font('Helvetica').text(`Issued on: ${completionDate}`, 100, 420, {
    align: 'center',
    width: doc.page.width - 200
  });

  doc.end();

  return new Promise((resolve, reject) => {
    writeStream.on('finish', () => {
      // ✅ CRITICAL FIX: Return ONLY filename, not full path
      // Frontend will prepend /uploads/certificates/ when needed
      console.log('✅ Certificate generated:', certificateFileName);
      console.log('📂 Full path:', certificatePath);
      resolve({ certificate_url: certificateFileName });
    });
    writeStream.on('error', (error: any) => {
      console.error('❌ Certificate generation error:', error);
      reject(error);
    });
  });
}

  // ============================================
  // VIDEO MANAGEMENT (Employer)
  // ============================================
async addVideoToTraining(
  trainingId: string,
  videoData: any,
  employerId: string
): Promise<any> {
  console.log('🔍 Add video ownership check:', { trainingId, employerId });

  // Get employer profile ID
  const employerProfileCheck = await this.db.query(
    'SELECT id FROM employers WHERE user_id = $1',
    [employerId]
  );

  const employerProfileId = employerProfileCheck.rows.length > 0
    ? employerProfileCheck.rows[0].id
    : null;

  // Verify ownership
  const ownershipCheck = await this.db.query(
    'SELECT id, title, provider_name FROM trainings WHERE id = $1 AND (provider_id = $2 OR provider_id = $3)',
    [trainingId, employerId, employerProfileId]
  );

  if (ownershipCheck.rows.length === 0) {
    console.error('❌ Ownership check failed for addVideo');
    throw new Error('Unauthorized');
  }

  const training = ownershipCheck.rows[0];

  console.log('✅ Ownership verified, adding video');

  const result = await this.db.query(`
    INSERT INTO training_videos
      (training_id, title, description, video_url, duration_minutes, order_index, is_preview)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `, [
    trainingId,
    videoData.title,
    videoData.description,
    videoData.video_url,
    videoData.duration_minutes,
    videoData.order_index,
    videoData.is_preview || false
  ]);

  // ✅ CRITICAL: Notify enrolled jobseekers about new video
  this.notifyEnrolledJobseekers(
    trainingId,
    'video_added',
    `New video "${videoData.title}" added to ${training.title}`,
    {
      training_id: trainingId,
      training_title: training.title,
      video_title: videoData.title,
      video_id: result.rows[0].id
    }
  ).catch(err => console.error('Failed to notify about new video:', err));

  return result.rows[0];
}

async updateTrainingVideo(
  trainingId: string,
  videoId: string,
  videoData: any,
  employerId: string
): Promise<any> {
  console.log('🔍 Update video ownership check:', {
    trainingId,
    videoId,
    employerId
  });

  // Get employer profile ID
  const employerProfileCheck = await this.db.query(
    'SELECT id FROM employers WHERE user_id = $1',
    [employerId]
  );

  const employerProfileId = employerProfileCheck.rows.length > 0
    ? employerProfileCheck.rows[0].id
    : null;

  console.log('🔍 Employer IDs:', {
    userId: employerId,
    profileId: employerProfileId
  });

  // Verify ownership with BOTH user ID and profile ID
  const ownershipCheck = await this.db.query(`
    SELECT v.id, t.provider_id, t.title
    FROM training_videos v
    JOIN trainings t ON v.training_id = t.id
    WHERE v.id = $1
      AND t.id = $2
      AND (t.provider_id = $3 OR t.provider_id = $4)
  `, [videoId, trainingId, employerId, employerProfileId]);

  console.log('🔍 Ownership check result:', {
    found: ownershipCheck.rows.length > 0,
    actualProviderId: ownershipCheck.rows[0]?.provider_id
  });

  if (ownershipCheck.rows.length === 0) {
    // Enhanced debug for failure case
    const debugQuery = await this.db.query(`
      SELECT t.provider_id, t.title
      FROM trainings t
      WHERE t.id = $1
    `, [trainingId]);

    console.error('❌ Ownership check failed:', {
      videoId,
      trainingId,
      requestedBy: employerId,
      requestedByProfile: employerProfileId,
      actualOwner: debugQuery.rows[0]?.provider_id,
      trainingTitle: debugQuery.rows[0]?.title
    });
    throw new Error('Unauthorized');
  }

  console.log('✅ Ownership verified, updating video');

  const result = await this.db.query(`
    UPDATE training_videos
    SET
      title = COALESCE($1, title),
      description = COALESCE($2, description),
      video_url = COALESCE($3, video_url),
      duration_minutes = COALESCE($4, duration_minutes),
      order_index = COALESCE($5, order_index),
      is_preview = COALESCE($6, is_preview)
    WHERE id = $7
    RETURNING *
  `, [
    videoData.title,
    videoData.description,
    videoData.video_url,
    videoData.duration_minutes,
    videoData.order_index,
    videoData.is_preview,
    videoId
  ]);

  console.log('✅ Video updated successfully');

  return result.rows[0];
}

async deleteTrainingVideo(
  trainingId: string,
  videoId: string,
  employerId: string
): Promise<boolean> {
  console.log('🗑️ Delete video ownership check:', {
    trainingId,
    videoId,
    employerId
  });

  // Get employer profile ID
  const employerProfileCheck = await this.db.query(
    'SELECT id FROM employers WHERE user_id = $1',
    [employerId]
  );

  const employerProfileId = employerProfileCheck.rows.length > 0
    ? employerProfileCheck.rows[0].id
    : null;

  console.log('🔍 Employer IDs:', {
    userId: employerId,
    profileId: employerProfileId
  });

  // Delete with ownership check for BOTH user ID and profile ID
  const result = await this.db.query(`
    DELETE FROM training_videos v
    USING trainings t
    WHERE v.training_id = t.id
      AND v.id = $1
      AND t.id = $2
      AND (t.provider_id = $3 OR t.provider_id = $4)
    RETURNING v.id
  `, [videoId, trainingId, employerId, employerProfileId]);

  const deleted = (result.rowCount ?? 0) > 0;

  console.log('🗑️ Delete result:', {
    deleted,
    rowCount: result.rowCount
  });

  return deleted;
}



  // ============================================
  // ENROLLMENT NOTIFICATIONS (Employer)
  // ============================================
  // In your training.service.ts - Update the enrollment notification query
  async getEnrollmentNotifications(employerId: string): Promise<any> {
    console.log('🔔 Getting enrollment notifications for employer:', employerId);
 
    // Get employer profile ID
    const employerProfileCheck = await this.db.query(
      'SELECT id FROM employers WHERE user_id = $1',
      [employerId]
    );
 
    let providerCondition = 't.provider_id = $1';
    let queryParams = [employerId];
 
    if (employerProfileCheck.rows.length > 0) {
      const employerProfileId = employerProfileCheck.rows[0].id;
      providerCondition = '(t.provider_id = $1 OR t.provider_id = $2)';
      queryParams = [employerId, employerProfileId];
    }
 
   const query = `
    SELECT
      e.id as enrollment_id,
      e.training_id,
      e.user_id,
      e.status,
      e.progress_percentage,
      e.enrolled_at,
      e.completed_at,
      e.certificate_issued,
      t.title as training_title,
      -- ✅ ENHANCED: Robust name with email parsing fallback (e.g., "alice.test" -> "Alice Test")
      CASE
        WHEN COALESCE(TRIM(CONCAT(u.first_name, ' ', u.last_name)), '') != ''
        THEN TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')))
        WHEN u.email IS NOT NULL
        THEN -- Parse email: Split before '@', capitalize words
          INITCAP(REGEXP_REPLACE(
            SPLIT_PART(u.email, '@', 1),
            '[_.-]',
            ' ',
            'g'
          ))
        ELSE 'Anonymous User'
      END as jobseeker_name,
      u.first_name,
      u.last_name,
      u.email,
      CASE
        WHEN e.completed_at IS NOT NULL THEN 'completed'
        WHEN e.enrolled_at > CURRENT_TIMESTAMP - INTERVAL '24 hours' THEN 'new'
        ELSE 'in_progress'
      END as notification_type
    FROM training_enrollments e
    JOIN trainings t ON e.training_id = t.id
    JOIN users u ON e.user_id = u.id
    WHERE ${providerCondition}
    ORDER BY
      CASE
        WHEN e.completed_at IS NOT NULL THEN e.completed_at
        ELSE e.enrolled_at
      END DESC
  `;
  const result = await this.db.query(query, queryParams);

  console.log(`✅ Loaded ${result.rows.length} enrollment notifications with names:`, 
    result.rows.map(r => ({ name: r.jobseeker_name, email: r.email, training: r.training_title })));

  return result.rows;
}

  // ============================================
  // JOBSEEKER-SPECIFIC TRAINING ACCESS
  // ============================================
 async getTrainingWithDetailsForJobseeker(
  trainingId: string,
  userId: string
): Promise<any> {
  try {
    console.log('🔍 Getting training details for jobseeker:', { trainingId, userId });

    // ===================================================
    // STEP 1: Get basic training info
    // ===================================================
    const trainingQuery = `
      SELECT 
        t.*,
        e.id as enrollment_id,
        e.enrolled_at,
        e.status as enrollment_status,
        e.progress_percentage,
        e.completed_at,
        e.certificate_issued,
        e.certificate_url,
        e.certificate_issued_at,
        CASE WHEN e.id IS NOT NULL THEN true ELSE false END as is_enrolled
      FROM trainings t
      LEFT JOIN training_enrollments e 
        ON t.id = e.training_id AND e.user_id = $2
      WHERE t.id = $1 AND t.status = 'published'
    `;

    const trainingResult = await this.db.query(trainingQuery, [trainingId, userId]);
    
    if (trainingResult.rows.length === 0) {
      throw new Error('Training not found or not published');
    }

    const training = trainingResult.rows[0];

    // ===================================================
    // STEP 2: Get videos (without progress if table missing)
    // ===================================================
    const videosQuery = `
      SELECT 
        v.id,
        v.training_id,
        v.title,
        v.description,
        v.video_url,
        v.duration_minutes,
        v.order_index,
        v.is_preview,
        false as watched,
        0 as watch_time,
        false as completed
      FROM training_videos v
      WHERE v.training_id = $1
      ORDER BY v.order_index
    `;

    const videosResult = await this.db.query(videosQuery, [trainingId]);
    training.videos = videosResult.rows;

    // ===================================================
    // STEP 3: Get learning outcomes (or empty array)
    // ===================================================
    try {
      const outcomesQuery = `
        SELECT 
          id,
          training_id,
          outcome_text,
          order_index
        FROM learning_outcomes
        WHERE training_id = $1
        ORDER BY order_index
      `;

      const outcomesResult = await this.db.query(outcomesQuery, [trainingId]);
      training.learning_outcomes = outcomesResult.rows;
    } catch (error: any) {
      console.warn('⚠️ Could not load learning outcomes:', error.message);
      training.learning_outcomes = [];
    }

    // ===================================================
    // STEP 4: Get provider info (safe way)
    // ===================================================
    try {
      const providerQuery = `
        SELECT 
          id,
          business_name,
          logo_url,
          industry
        FROM employers
        WHERE id = $1
        LIMIT 1
      `;

      const providerResult = await this.db.query(providerQuery, [training.provider_id]);
      
      if (providerResult.rows.length > 0) {
        training.provider_company_name = providerResult.rows[0].business_name;
        training.provider_logo = providerResult.rows[0].logo_url;
        training.provider_industry = providerResult.rows[0].industry;
      }
    } catch (error: any) {
      console.warn('⚠️ Could not load provider details:', error.message);
    }

    console.log('✅ Training details retrieved:', {
      trainingId: training.id,
      title: training.title,
      isEnrolled: training.is_enrolled,
      videoCount: training.videos?.length || 0,
      outcomesCount: training.learning_outcomes?.length || 0
    });

    return training;
  } catch (error: any) {
    console.error('❌ Error getting training details:', error);
    throw error;
  }
}


  // ============================================
  // DATABASE MAINTENANCE
  // ============================================
  async cleanupInvalidTrainings(): Promise<void> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      // Find and mark invalid trainings as suspended
      const invalidTrainings = await client.query(`
        SELECT t.id, t.title, t.status, t.provider_id, t.provider_name, t.created_at
        FROM trainings t
        WHERE t.provider_id IS NULL
           OR t.title IS NULL
           OR t.description IS NULL
           OR t.duration_hours <= 0
           OR NOT EXISTS (
             SELECT 1 FROM employers e
             WHERE e.id = t.provider_id
             AND e.deleted_at IS NULL
           )
        ORDER BY t.created_at DESC
      `);
      if (invalidTrainings.rows.length > 0) {
        await client.query(`
          UPDATE trainings
          SET status = 'suspended'
          WHERE id = ANY($1)
        `, [invalidTrainings.rows.map(t => t.id)]);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async diagnoseTrainingData(): Promise<void> {
    // Total trainings by status
    const statusQuery = await this.db.query(`
      SELECT status, COUNT(*) as count
      FROM trainings
      GROUP BY status
      ORDER BY count DESC
    `);
    // Trainings without valid provider
    const invalidProviderQuery = await this.db.query(`
      SELECT COUNT(*) as count
      FROM trainings t
      WHERE t.provider_id IS NULL
         OR NOT EXISTS (
           SELECT 1 FROM employers e
           WHERE e.id = t.provider_id
         )
    `);
    // Published trainings that would show to jobseekers
    const validPublishedQuery = await this.db.query(`
      SELECT COUNT(*) as count
      FROM trainings t
      WHERE t.status = 'published'
        AND t.provider_id IS NOT NULL
        AND t.title IS NOT NULL
        AND t.description IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM employers e
          WHERE e.id = t.provider_id
          AND e.deleted_at IS NULL
        )
    `);
    // Test data patterns
    const testDataQuery = await this.db.query(`
      SELECT COUNT(*) as count
      FROM trainings
      WHERE title ILIKE '%test%'
         OR title ILIKE '%postman%'
         OR description ILIKE '%test%'
    `);
  }

  // ============================================
  // JOBSEEKER TRAINING LISTING
  // ============================================
  // In training.service.ts - Replace the getPublishedTrainingsForJobseeker method
  async getPublishedTrainingsForJobseeker(userId: string, params: TrainingSearchParams): Promise<TrainingListResponse> {
    const {
      page = 1,
      limit = 10,
      sort_by = 'created_at',
      sort_order = 'desc',
      filters = {}
    } = params;
    const offset = (page - 1) * limit;
    let whereConditions: string[] = [
      "t.status = 'published'",
      "t.provider_id IS NOT NULL",
      "t.title IS NOT NULL",
      "t.description IS NOT NULL",
      "t.duration_hours > 0",
      `EXISTS (
        SELECT 1 FROM employers e
        WHERE e.id = t.provider_id
      )`
    ];
    let queryParams: any[] = [];
    let paramIndex = 1;
    // Apply user filters
    if (filters.category || params.category) {
      const category = filters.category || params.category;
      whereConditions.push(`t.category = $${paramIndex++}`);
      queryParams.push(category);
    }
    if (params.level) {
      whereConditions.push(`t.level = $${paramIndex++}`);
      queryParams.push(params.level);
    }
    if (params.cost_type) {
      whereConditions.push(`t.cost_type = $${paramIndex++}`);
      queryParams.push(params.cost_type);
    }
    if (params.mode) {
      whereConditions.push(`t.mode = $${paramIndex++}`);
      queryParams.push(params.mode);
    }
    if (params.search) {
      whereConditions.push(`(t.title ILIKE $${paramIndex} OR t.description ILIKE $${paramIndex})`);
      const searchPattern = `%${params.search}%`;
      queryParams.push(searchPattern);
      paramIndex++;
    }
    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    // ✅ FIXED: Added videos aggregation to list query
    const query = `
      SELECT
        t.id,
        t.title,
        t.description,
        t.category,
        t.level,
        t.duration_hours,
        t.cost_type,
        t.price,
        t.mode,
        t.provider_id,
        t.provider_name,
        t.has_certificate,
        t.rating,
        t.total_students,
        t.thumbnail_url,
        t.location,
        t.start_date,
        t.end_date,
        t.max_participants,
        t.current_participants,
        t.status,
        t.created_at,
        t.updated_at,
        CASE WHEN e.id IS NOT NULL THEN true ELSE false END as enrolled,
        COALESCE(e.progress_percentage, 0) as progress,
        e.status as enrollment_status,
        e.enrolled_at,
        e.completed_at,
        (SELECT COUNT(*) FROM training_videos WHERE training_id = t.id) as video_count,
        COALESCE(
          (SELECT json_agg(
            json_build_object(
              'id', v.id,
              'training_id', v.training_id,
              'title', v.title,
              'description', v.description,
              'video_url', v.video_url,
              'duration_minutes', v.duration_minutes,
              'order_index', v.order_index,
              'is_preview', v.is_preview
            ) ORDER BY v.order_index
          )
          FROM training_videos v
          WHERE v.training_id = t.id),
          '[]'::json
        ) as videos,
        COUNT(*) OVER() as total_count
      FROM trainings t
      LEFT JOIN training_enrollments e ON t.id = e.training_id AND e.user_id = $${paramIndex++}
      ${whereClause}
      ORDER BY t.${sort_by} ${sort_order.toUpperCase()}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    queryParams.push(userId, limit, offset);
    console.log('🔍 Query params:', queryParams);
    console.log('🔍 Full query:', query);
    const result = await this.db.query(query, queryParams);
    const trainings = result.rows;
    const totalCount = trainings.length > 0 ? parseInt(trainings[0].total_count) : 0;
    console.log('✅ Query returned trainings:', trainings.length);
    if (trainings.length > 0) {
      console.log('✅ First training videos:', trainings[0].videos);
    }
    return {
      trainings: trainings.map(row => ({
        ...this.mapTrainingFromDb(row),
        enrolled: row.enrolled,
        progress: row.progress || 0,
        enrollment_status: row.enrollment_status,
        enrolled_at: row.enrolled_at,
        completed_at: row.completed_at,
        video_count: parseInt(row.video_count || 0),
        videos: row.videos || [] // ✅ Include videos array
      })),
      pagination: {
        current_page: page,
        total_pages: Math.ceil(totalCount / limit),
        page_size: limit,
        total_count: totalCount,
        has_next: page * limit < totalCount,
        has_previous: page > 1
      },
      filters_applied: filters
    };
  }

  // ============================================
  // BASIC TRAINING RETRIEVAL
  // ============================================
  async getTrainingById(id: string): Promise<any | null> {
    const result = await this.db.query(
      'SELECT * FROM trainings WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  // ============================================
  // EMPLOYER ENROLLMENT MANAGEMENT
  // ============================================
  async getTrainingEnrollments(trainingId: string, employerId: string, params: any): Promise<any | null> {
    // First verify the training belongs to this employer
    const trainingCheck = await this.db.query(
      'SELECT id FROM trainings WHERE id = $1 AND provider_id = $2',
      [trainingId, employerId]
    );
    if (trainingCheck.rows.length === 0) return null;
    const {
      page = 1,
      limit = 10,
      status
    } = params;
    const offset = (page - 1) * limit;
    let whereConditions = ['e.training_id = $1'];
    let queryParams: (string | number)[] = [trainingId];
    let paramIndex = 2;
    if (status) {
      whereConditions.push(`e.status = $${paramIndex++}`);
      queryParams.push(status);
    }
    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    // Check what columns exist in the users table
    const columnCheck = await this.db.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users' AND table_schema = 'public'
    `);
    const availableColumns = columnCheck.rows.map(row => row.column_name);
    // Build the SELECT clause based on available columns
    let userColumns = ['u.email'];
    if (availableColumns.includes('first_name')) {
      userColumns.push('u.first_name');
    } else {
      userColumns.push("'' as first_name");
    }
    if (availableColumns.includes('last_name')) {
      userColumns.push('u.last_name');
    } else {
      userColumns.push("'' as last_name");
    }
    if (availableColumns.includes('profile_image')) {
      userColumns.push('u.profile_image');
    } else {
      userColumns.push("null as profile_image");
    }
    // Build query with proper parameter indexing
    const limitParam = `$${paramIndex++}`;
    const offsetParam = `$${paramIndex++}`;
    const query = `
      SELECT
        e.*,
        ${userColumns.join(', ')},
        COUNT(*) OVER() as total_count
      FROM training_enrollments e
      JOIN users u ON e.user_id = u.id
      ${whereClause}
      ORDER BY e.enrolled_at DESC
      LIMIT ${limitParam} OFFSET ${offsetParam}
    `;
    // Add limit and offset parameters
    queryParams.push(limit, offset);
    const result = await this.db.query(query, queryParams);
    const enrollments = result.rows;
    const totalCount = enrollments.length > 0 ? parseInt(enrollments[0].total_count) : 0;
    return {
      enrollments: enrollments.map(row => ({
        id: row.id,
        training_id: row.training_id,
        user_id: row.user_id,
        status: row.status,
        progress_percentage: row.progress_percentage,
        enrolled_at: row.enrolled_at,
        completed_at: row.completed_at,
        certificate_issued: row.certificate_issued,
        user: {
          id: row.user_id,
          first_name: row.first_name || 'User',
          last_name: row.last_name || '',
          email: row.email,
          profile_image: row.profile_image
        }
      })),
      pagination: {
        current_page: page,
        total_pages: Math.ceil(totalCount / limit),
        page_size: limit,
        total_count: totalCount,
        has_next: page * limit < totalCount,
        has_previous: page > 1
      }
    };
  }

  // ============================================
  // TRAINING ANALYTICS
  // ============================================
  async getTrainingAnalytics(trainingId: string, employerId: string, timeRange: string): Promise<any | null> {
    // Get employer profile ID
    const employerProfileCheck = await this.db.query(
      'SELECT id FROM employers WHERE user_id = $1',
      [employerId]
    );
    let ownershipCondition = 'provider_id = $2';
    let ownershipParams = [trainingId, employerId];
    if (employerProfileCheck.rows.length > 0) {
      const employerProfileId = employerProfileCheck.rows[0].id;
      ownershipCondition = '(provider_id = $2 OR provider_id = $3)';
      ownershipParams = [trainingId, employerId, employerProfileId];
    }
    // Verify training ownership
    const trainingCheck = await this.db.query(
      `SELECT * FROM trainings WHERE id = $1 AND ${ownershipCondition}`,
      ownershipParams
    );
    if (trainingCheck.rows.length === 0) {
      return null;
    }
    const training = trainingCheck.rows[0];
    // Calculate date range
    let dateFilter = '';
    const params = [trainingId];
    if (timeRange === '7days') {
      dateFilter = 'AND te.enrolled_at >= CURRENT_DATE - INTERVAL \'7 days\'';
    } else if (timeRange === '30days') {
      dateFilter = 'AND te.enrolled_at >= CURRENT_DATE - INTERVAL \'30 days\'';
    } else if (timeRange === '90days') {
      dateFilter = 'AND te.enrolled_at >= CURRENT_DATE - INTERVAL \'90 days\'';
    }
    // Get enrollment statistics
    const enrollmentQuery = `
      SELECT
        COUNT(*) as total_enrollments,
        COUNT(*) FILTER (WHERE te.status = 'completed') as completed_enrollments,
        COUNT(*) FILTER (WHERE te.status = 'in_progress') as in_progress_enrollments,
        COUNT(*) FILTER (WHERE te.status = 'dropped') as dropped_enrollments,
        AVG(te.progress_percentage) as avg_progress,
        COUNT(*) FILTER (WHERE te.certificate_issued = true) as certificates_issued
      FROM training_enrollments te
      WHERE te.training_id = $1 ${dateFilter}
    `;
    const enrollmentResult = await this.db.query(enrollmentQuery, params);
    const enrollmentStats = enrollmentResult.rows[0];
    // Get daily enrollment trend
    const trendQuery = `
      SELECT
        DATE(te.enrolled_at) as date,
        COUNT(*) as enrollments,
        COUNT(*) FILTER (WHERE te.status = 'completed') as completions
      FROM training_enrollments te
      WHERE te.training_id = $1 ${dateFilter}
      GROUP BY DATE(te.enrolled_at)
      ORDER BY date
    `;
    const trendResult = await this.db.query(trendQuery, params);
    // Get review analytics
    const reviewQuery = `
      SELECT
        AVG(rating) as avg_rating,
        COUNT(*) as review_count,
        COUNT(*) FILTER (WHERE rating = 5) as five_star_count,
        COUNT(*) FILTER (WHERE rating = 4) as four_star_count,
        COUNT(*) FILTER (WHERE rating = 3) as three_star_count,
        COUNT(*) FILTER (WHERE rating = 2) as two_star_count,
        COUNT(*) FILTER (WHERE rating = 1) as one_star_count
      FROM training_reviews
      WHERE training_id = $1
    `;
    const reviewResult = await this.db.query(reviewQuery, [trainingId]);
    const reviewStats = reviewResult.rows[0];
    // Calculate completion rate
    const totalEnrollments = parseInt(enrollmentStats.total_enrollments);
    const completedEnrollments = parseInt(enrollmentStats.completed_enrollments);
    const completionRate = totalEnrollments > 0 ? (completedEnrollments / totalEnrollments) * 100 : 0;
    // Calculate drop rate
    const droppedEnrollments = parseInt(enrollmentStats.dropped_enrollments);
    const dropRate = totalEnrollments > 0 ? (droppedEnrollments / totalEnrollments) * 100 : 0;
    return {
      training_info: {
        id: training.id,
        title: training.title,
        status: training.status,
        created_at: training.created_at
      },
      enrollment_metrics: {
        total_enrollments: totalEnrollments,
        completed_enrollments: completedEnrollments,
        in_progress_enrollments: parseInt(enrollmentStats.in_progress_enrollments),
        dropped_enrollments: droppedEnrollments,
        completion_rate: Math.round(completionRate * 100) / 100,
        drop_rate: Math.round(dropRate * 100) / 100,
        avg_progress: Math.round(parseFloat(enrollmentStats.avg_progress || 0) * 100) / 100,
        certificates_issued: parseInt(enrollmentStats.certificates_issued)
      },
      review_metrics: {
        avg_rating: Math.round(parseFloat(reviewStats.avg_rating || 0) * 100) / 100,
        total_reviews: parseInt(reviewStats.review_count),
        rating_distribution: {
          five_star: parseInt(reviewStats.five_star_count || 0),
          four_star: parseInt(reviewStats.four_star_count || 0),
          three_star: parseInt(reviewStats.three_star_count || 0),
          two_star: parseInt(reviewStats.two_star_count || 0),
          one_star: parseInt(reviewStats.one_star_count || 0)
        }
      },
      trends: {
        daily_enrollments: trendResult.rows.map(row => ({
          date: row.date,
          enrollments: parseInt(row.enrollments),
          completions: parseInt(row.completions)
        }))
      },
      time_range: timeRange
    };
  }

  // ============================================
  // REVIEW MANAGEMENT
  // ============================================
  async getTrainingReviews(trainingId: string, params: any): Promise<any | null> {
    // First verify the training exists
    const trainingCheck = await this.db.query(
      'SELECT id FROM trainings WHERE id = $1',
      [trainingId]
    );
    if (trainingCheck.rows.length === 0) return null;
    const {
      page = 1,
      limit = 10,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = params;
    const offset = (page - 1) * limit;
    const query = `
      SELECT
        r.*,
        u.first_name,
        u.last_name,
        u.profile_image,
        COUNT(*) OVER() as total_count
      FROM training_reviews r
      JOIN users u ON r.user_id = u.id
      WHERE r.training_id = $1
      ORDER BY r.${sort_by} ${sort_order.toUpperCase()}
      LIMIT $2 OFFSET $3
    `;
    const result = await this.db.query(query, [trainingId, limit, offset]);
    const reviews = result.rows;
    const totalCount = reviews.length > 0 ? parseInt(reviews[0].total_count) : 0;
    // Get rating summary
    const summaryQuery = `
      SELECT
        AVG(rating) as avg_rating,
        COUNT(*) as total_reviews,
        COUNT(*) FILTER (WHERE rating = 5) as five_star,
        COUNT(*) FILTER (WHERE rating = 4) as four_star,
        COUNT(*) FILTER (WHERE rating = 3) as three_star,
        COUNT(*) FILTER (WHERE rating = 2) as two_star,
        COUNT(*) FILTER (WHERE rating = 1) as one_star
      FROM training_reviews
      WHERE training_id = $1
    `;
    const summaryResult = await this.db.query(summaryQuery, [trainingId]);
    const summary = summaryResult.rows[0];
    return {
      reviews: reviews.map(row => ({
        id: row.id,
        training_id: row.training_id,
        user_id: row.user_id,
        rating: row.rating,
        review_text: row.review_text,
        created_at: row.created_at,
        updated_at: row.updated_at,
        user: {
          id: row.user_id,
          first_name: row.first_name,
          last_name: row.last_name,
          profile_image: row.profile_image
        }
      })),
      summary: {
        avg_rating: Math.round(parseFloat(summary.avg_rating || 0) * 100) / 100,
        total_reviews: parseInt(summary.total_reviews),
        rating_distribution: {
          5: parseInt(summary.five_star || 0),
          4: parseInt(summary.four_star || 0),
          3: parseInt(summary.three_star || 0),
          2: parseInt(summary.two_star || 0),
          1: parseInt(summary.one_star || 0)
        }
      },
      pagination: {
        current_page: page,
        total_pages: Math.ceil(totalCount / limit),
        page_size: limit,
        total_count: totalCount,
        has_next: page * limit < totalCount,
        has_previous: page > 1
      }
    };
  }

  // ============================================
  // EMPLOYER TRAINING MANAGEMENT
  // ============================================
  async getAllTrainings(params: TrainingSearchParams, employerId?: string): Promise<TrainingListResponse> {
    const {
      page = 1,
      limit = 10,
      sort_by = 'created_at',
      sort_order = 'desc',
      filters = {}
    } = params;
    const offset = (page - 1) * limit;
    let whereConditions: string[] = [];
    let queryParams: any[] = [];
    let paramIndex = 1;
    // ADAPTIVE: Check both user ID and employer profile ID
    if (employerId) {
      // Get employer profile ID
      const employerProfileCheck = await this.db.query(
        'SELECT id FROM employers WHERE user_id = $1',
        [employerId]
      );
      if (employerProfileCheck.rows.length > 0) {
        const employerProfileId = employerProfileCheck.rows[0].id;
        // Check BOTH user ID and profile ID to find trainings
        whereConditions.push(`(t.provider_id = $${paramIndex++} OR t.provider_id = $${paramIndex++})`);
        queryParams.push(employerId, employerProfileId);
      } else {
        // Fallback to just user ID if no employer profile
        whereConditions.push(`t.provider_id = $${paramIndex++}`);
        queryParams.push(employerId);
      }
    }
    if (filters.category) {
      whereConditions.push(`t.category = $${paramIndex++}`);
      queryParams.push(filters.category);
    }
    if (filters.level && filters.level.length > 0) {
      whereConditions.push(`t.level = ANY($${paramIndex++})`);
      queryParams.push(filters.level);
    }
    if (filters.search) {
      whereConditions.push(`(t.title ILIKE $${paramIndex++} OR t.description ILIKE $${paramIndex++})`);
      const searchTerm = `%${filters.search}%`;
      queryParams.push(searchTerm, searchTerm);
    }
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    // CRITICAL FIX: Add enrollment count subquery
    const query = `
      SELECT
        t.*,
        (SELECT COUNT(*) FROM training_enrollments WHERE training_id = t.id) as enrollment_count,
        COALESCE(t.total_students, 0) as total_students,
        COALESCE(t.current_participants, 0) as current_participants,
        COUNT(*) OVER() as total_count
      FROM trainings t
      ${whereClause}
      ORDER BY t.${sort_by} ${sort_order.toUpperCase()}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    queryParams.push(limit, offset);
    const result = await this.db.query(query, queryParams);
    const trainings = result.rows;
    const totalCount = trainings.length > 0 ? parseInt(trainings[0].total_count) : 0;
    return {
      trainings: trainings.map(row => ({
        ...this.mapTrainingFromDb(row),
        enrolled: false,
        progress: 0,
        enrollment_status: undefined,
        // CRITICAL: Preserve enrollment counts
        total_students: parseInt(row.enrollment_count || row.total_students || 0),
        current_participants: parseInt(row.current_participants || row.enrollment_count || 0)
      })),
      pagination: {
        current_page: page,
        total_pages: Math.ceil(totalCount / limit),
        page_size: limit,
        total_count: totalCount,
        has_next: page * limit < totalCount,
        has_previous: page > 1
      },
      filters_applied: filters
    };
  }

  // ============================================
  // TRAINING CRUD OPERATIONS
  // ============================================
  async createTraining(data: CreateTrainingRequest, employerId: string): Promise<Training> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      // STEP 1: Verify the employer exists and has the correct user_type
      const userCheck = await client.query(
        'SELECT id, email, user_type FROM users WHERE id = $1',
        [employerId]
      );
      if (userCheck.rows.length === 0) {
        throw new Error(`User with ID ${employerId} does not exist in the database`);
      }
      const user = userCheck.rows[0];
      if (user.user_type !== 'employer') {
        throw new Error(`User ${user.email} is not an employer. Current type: ${user.user_type}`);
      }
      // STEP 2: Get the employer profile ID (this is what the foreign key references)
      const employerProfileCheck = await client.query(
        'SELECT id FROM employers WHERE user_id = $1',
        [employerId]
      );
      if (employerProfileCheck.rows.length === 0) {
        throw new Error(`Employer profile not found for user ${user.email}. Please complete your employer registration.`);
      }
      const employerProfileId = employerProfileCheck.rows[0].id;
      // STEP 4: Prepare the insert query with explicit column mapping
      const trainingQuery = `
        INSERT INTO trainings (
          title,
          description,
          category,
          level,
          duration_hours,
          cost_type,
          price,
          mode,
          provider_id,
          provider_name,
          has_certificate,
          thumbnail_url,
          location,
          start_date,
          end_date,
          max_participants,
          status,
          created_at,
          updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
        ) RETURNING *
      `;
      const queryParams = [
        data.title?.trim(),
        data.description?.trim(),
        data.category?.trim(),
        data.level,
        data.duration_hours,
        data.cost_type,
        data.price || 0,
        data.mode,
        employerProfileId, // Use the employer profile ID, not the user ID
        data.provider_name?.trim(),
        data.has_certificate || false,
        data.thumbnail_url || null,
        data.location || null,
        data.start_date || null,
        data.end_date || null,
        data.max_participants || null,
        'draft', // Default status
        new Date(),
        new Date()
      ];
      // STEP 5: Execute the training insertion
      const trainingResult = await client.query(trainingQuery, queryParams);
      if (trainingResult.rows.length === 0) {
        throw new Error('Training insertion failed - no rows returned');
      }
      const trainingId = trainingResult.rows[0].id;
      // STEP 6: Insert videos if provided (UPDATED: Default first video as preview)
      if (data.videos && data.videos.length > 0) {
        for (let i = 0; i < data.videos.length; i++) {
          const video = data.videos[i];
          const isPreview = (i === 0) ? true : (video.is_preview || false); // FIXED: First video is preview by default
    
          await client.query(`
            INSERT INTO training_videos (
              training_id,
              title,
              description,
              video_url,
              duration_minutes,
              order_index,
              is_preview
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            trainingId,
            video.title?.trim(),
            video.description?.trim(),
            video.video_url?.trim() || null,
            video.duration_minutes || 0,
            video.order_index || i + 1,
            isPreview // FIXED: Use computed preview flag
          ]);
        }
      }
      // STEP 7: Insert outcomes if provided
      if (data.outcomes && data.outcomes.length > 0) {
        for (let i = 0; i < data.outcomes.length; i++) {
          const outcome = data.outcomes[i];
    
          await client.query(`
            INSERT INTO training_outcomes (training_id, outcome_text, order_index)
            VALUES ($1, $2, $3)
          `, [
            trainingId,
            outcome.outcome_text?.trim(),
            outcome.order_index
          ]);
        }
      }
      await client.query('COMMIT');
      // ✅ NEW: If training is published, notify jobseekers
      const finalTraining = trainingResult.rows[0];
      if (finalTraining.status === 'published') {
        // Don't await - run in background
        this.notifyJobseekersAboutNewTraining(
          trainingId,
          data.title,
          data.category,
          data.provider_name
        ).catch(err => console.error('Failed to notify jobseekers:', err));
      }
      // Return the created training
      const fetchedTraining = await this.getTrainingById(trainingId) as Training;
      return fetchedTraining;
    } catch (error: any) {
      await client.query('ROLLBACK');
      // Re-throw with enhanced error information
      if (error.code === '23503') {
        if (error.constraint?.includes('provider_id') || error.detail?.includes('provider_id')) {
          throw new Error(`Employer reference error: User ID ${employerId} cannot be used as provider_id. Database constraint: ${error.constraint}`);
        }
      }
      throw error;
    } finally {
      client.release();
    }
  }

async updateTraining(id: string, data: UpdateTrainingRequest, employerId: string): Promise<Training | null> {
  const client = await this.db.connect();
  try {
    await client.query('BEGIN');

    // Get employer profile ID
    const employerProfileCheck = await client.query(
      'SELECT id FROM employers WHERE user_id = $1',
      [employerId]
    );

    if (employerProfileCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    const employerProfileId = employerProfileCheck.rows[0].id;

    // Verify training ownership
    const ownershipCheck = await client.query(
      'SELECT id, title, status FROM trainings WHERE id = $1 AND provider_id = $2',
      [id, employerProfileId]
    );

    if (ownershipCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    const oldTraining = ownershipCheck.rows[0];

    // Build update query
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && !['videos', 'outcomes'].includes(key)) {
        updateFields.push(`${key} = $${paramIndex++}`);
        updateValues.push(value);
      }
    });

    if (updateFields.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(id);

    const query = `
      UPDATE trainings
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex++}
      RETURNING *
    `;

    const result = await client.query(query, updateValues);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    const updatedTraining = result.rows[0];

    // Handle video updates
    if (data.videos && Array.isArray(data.videos) && data.videos.length > 0) {
      await client.query('DELETE FROM training_videos WHERE training_id = $1', [id]);

      for (let i = 0; i < data.videos.length; i++) {
        const video = data.videos[i];
        const isPreview = (i === 0) ? true : (video.is_preview || false);

        await client.query(`
          INSERT INTO training_videos (
            training_id, title, description, video_url, duration_minutes, order_index, is_preview
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          id, video.title?.trim(), video.description?.trim(), video.video_url?.trim() || null,
          video.duration_minutes || 0, video.order_index || i + 1, isPreview
        ]);
      }
    }

    await client.query('COMMIT');

    // ✅ CRITICAL: Send notification to enrolled jobseekers AFTER commit
    if (oldTraining.status === 'published') {
      this.notifyEnrolledJobseekers(
        id,
        'training_updated',
        `Training "${oldTraining.title}" has been updated`,
        {
          training_id: id,
          training_title: oldTraining.title,
          changes: Object.keys(data).filter(k => !['videos', 'outcomes'].includes(k))
        }
      ).catch(err => console.error('Failed to notify about update:', err));
    }

    return this.mapTrainingFromDb(result.rows[0]);
  } catch (error: any) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

  // In deleteTrainingVideo method - ensure this logic exists
  async deleteTraining(id: string, employerId: string): Promise<boolean> {
  const client = await this.db.connect();
  try {
    await client.query('BEGIN');
    
    // Get training details BEFORE deletion (for notifications)
    const trainingResult = await client.query(
      'SELECT title, status, provider_id FROM trainings WHERE id = $1',
      [id]
    );
    if (trainingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return false;
    }
    const training = trainingResult.rows[0];

    // FIXED: Get employer profile ID and check BOTH user ID and profile ID for ownership
    const employerProfileCheck = await client.query(
      'SELECT id FROM employers WHERE user_id = $1',
      [employerId]
    );
    const employerProfileId = employerProfileCheck.rows.length > 0
      ? employerProfileCheck.rows[0].id
      : null;

    console.log('🔍 Delete ownership check:', {
      trainingId: id,
      requestedByUserId: employerId,
      requestedByProfileId: employerProfileId,
      actualProviderId: training.provider_id
    });

    // Verify ownership with BOTH user ID and profile ID
    const ownershipCheck = await client.query(
      `SELECT id FROM trainings 
       WHERE id = $1 
         AND (provider_id = $2 OR provider_id = $3)`,
      [id, employerId, employerProfileId || '']  // '' as fallback for null
    );

    if (ownershipCheck.rows.length === 0) {
      console.error('❌ Ownership check failed for deleteTraining:', {
        trainingId: id,
        requestedBy: employerId,
        requestedByProfile: employerProfileId,
        actualOwner: training.provider_id
      });
      await client.query('ROLLBACK');
      return false;  // This will trigger 404 in controller
    }

    // Delete training (cascades to videos, enrollments, etc.)
    const deleteResult = await client.query(
      `DELETE FROM trainings 
       WHERE id = $1 
         AND (provider_id = $2 OR provider_id = $3)`,
      [id, employerId, employerProfileId || '']
    );

    if ((deleteResult.rowCount ?? 0) === 0) {
      await client.query('ROLLBACK');
      return false;
    }

    await client.query('COMMIT');

    console.log('✅ Training deleted successfully:', { trainingId: id });

    // CRITICAL: Notify enrolled jobseekers AFTER commit
    if (training.status === 'published') {
      this.notifyEnrolledJobseekers(
        id,
        'training_deleted',
        `Training "${training.title}" has been removed`,
        {
          training_id: id,
          training_title: training.title,
          action: 'deleted'
        }
      ).catch(err => console.error('Failed to notify about deletion:', err));
    }

    return true;
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('❌ Error in deleteTraining:', error);
    throw error;
  } finally {
    client.release();
  }
}

async suspendTraining(trainingId: string, employerId: string): Promise<any> {
  const client = await this.db.connect();
  try {
    await client.query('BEGIN');

    const trainingResult = await client.query(
      'SELECT title FROM trainings WHERE id = $1',
      [trainingId]
    );

    if (trainingResult.rows.length === 0) {
      throw new Error('Training not found');
    }

    const training = trainingResult.rows[0];

    await client.query(
      'UPDATE trainings SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['suspended', trainingId]
    );

    await client.query('COMMIT');

    // ✅ CRITICAL: Notify enrolled jobseekers AFTER commit
    this.notifyEnrolledJobseekers(
      trainingId,
      'training_suspended',
      `Training "${training.title}" has been temporarily suspended`,
      {
        training_id: trainingId,
        training_title: training.title,
        action: 'suspended'
      }
    ).catch(err => console.error('Failed to notify about suspension:', err));

    return { success: true, message: 'Training suspended successfully' };
  } catch (error: any) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

  // ============================================
  // EMPLOYER STATS
  // ============================================
  async getTrainingStats(employerId: string): Promise<TrainingStatsResponse> {
    // Get employer profile ID
    const employerProfileCheck = await this.db.query(
      'SELECT id FROM employers WHERE user_id = $1',
      [employerId]
    );
    let providerCondition = 'provider_id = $1';
    let queryParams = [employerId];
    if (employerProfileCheck.rows.length > 0) {
      const employerProfileId = employerProfileCheck.rows[0].id;
      providerCondition = '(provider_id = $1 OR provider_id = $2)';
      queryParams = [employerId, employerProfileId];
    }
    // FIXED: Use lateral join for accurate enrollment counts without relying on total_students column
    const statsQuery = `
      SELECT
        COUNT(*) as total_trainings,
        COUNT(*) FILTER (WHERE status = 'published') as published_trainings,
        COUNT(*) FILTER (WHERE status = 'draft') as draft_trainings,
        COUNT(*) FILTER (WHERE status = 'suspended') as suspended_trainings,
        COALESCE(SUM(te_count.enrollment_count), 0) as total_enrollments,
        COALESCE(AVG(t.rating), 0) as avg_rating,
        COALESCE(SUM(CASE WHEN t.cost_type = 'Paid' THEN t.price * te_count.enrollment_count ELSE 0 END), 0) as total_revenue
      FROM trainings t
      LEFT JOIN LATERAL (
        SELECT COUNT(*) as enrollment_count
        FROM training_enrollments te
        WHERE te.training_id = t.id
      ) te_count ON true
      WHERE ${providerCondition}
    `;
    const result = await this.db.query(statsQuery, queryParams);
    const stats = result.rows[0];
    return {
      total_trainings: parseInt(stats.total_trainings) || 0,
      published_trainings: parseInt(stats.published_trainings) || 0,
      draft_trainings: parseInt(stats.draft_trainings) || 0,
      suspended_trainings: parseInt(stats.suspended_trainings) || 0,
      total_enrollments: parseInt(stats.total_enrollments) || 0,
      total_revenue: parseFloat(stats.total_revenue) || 0,
      avg_rating: parseFloat(stats.avg_rating) || 0,
      completion_rate: 0,
      categories_breakdown: [],
      monthly_enrollments: []
    };
  }

  // ============================================
  // JOBSEEKER ENROLLED TRAININGS
  // ============================================
// In training.service.ts - BULLETPROOF getEnrolledTrainings
// In training.service.ts - FIXED with quoted aliases
async getEnrolledTrainings(userId: string, params: TrainingSearchParams): Promise<TrainingListResponse> {
  const { page = 1, limit = 10, sort_by = 'enrolled_at', sort_order = 'desc' } = params;
  const offset = (page - 1) * limit;
  
  const query = `
    SELECT
      t.*,
      e.id AS "enrollment_id",
      e.progress_percentage AS "progress",
      e.status AS "enrollment_status",
      e.enrolled_at,
      e.completed_at,
      e.certificate_issued,
      e.certificate_url,
      true AS enrolled,
      (SELECT COUNT(*) FROM training_videos WHERE training_id = t.id) AS "video_count",
      COUNT(*) OVER() AS total_count
    FROM training_enrollments e
    JOIN trainings t ON e.training_id = t.id
    WHERE e.user_id = $1
    ORDER BY e."${sort_by}" ${sort_order.toUpperCase()}
    LIMIT $2 OFFSET $3
  `;
  
  const result = await this.db.query(query, [userId, limit, offset]);
  const trainings = result.rows;
  const totalCount = trainings.length > 0 ? parseInt(trainings[0].total_count) : 0;
  
  console.log('✅ Enrolled - Sample ID:', trainings[0]?.enrollment_id);  // Verify on load
  
  return {
    trainings: trainings.map(row => ({
      ...this.mapTrainingFromDb(row),
      enrolled: true,
      progress: parseFloat(row.progress) || 0,
      enrollment_status: row.enrollment_status,
      enrolled_at: row.enrolled_at,
      completed_at: row.completed_at,
      enrollment_id: row.enrollment_id,  // Exact match now
      certificate_issued: Boolean(row.certificate_issued),
      certificate_url: row.certificate_url || null,
      video_count: parseInt(row.video_count || 0)
    })),
    pagination: {
      current_page: page,
      total_pages: Math.ceil(totalCount / limit),
      page_size: limit,
      total_count: totalCount,
      has_next: page * limit < totalCount,
      has_previous: page > 1
    },
    filters_applied: {}
  };
}

  // ============================================
  // ENROLLMENT OPERATIONS
  // ============================================

  async enrollUserInTraining(trainingId: string, userId: string): Promise<any> {
  const client = await this.db.connect();
  try {
    await client.query('BEGIN');

    // Fetch training details
    const trainingCheck = await client.query(
      'SELECT id, title, max_participants, current_participants, status, provider_id, provider_name FROM trainings WHERE id = $1',
      [trainingId]
    );

    if (trainingCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, message: 'Training not found' };
    }

    const training = trainingCheck.rows[0];

    if (training.status !== 'published') {
      await client.query('ROLLBACK');
      return { success: false, message: 'Training is not available for enrollment' };
    }

    // ✅ CRITICAL FIX: Fetch jobseeker's name BEFORE checking enrollment
    const userResult = await client.query(
      'SELECT first_name, last_name, email FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, message: 'User not found' };
    }

    const jobseeker = userResult.rows[0];
    const jobseekerName = `${jobseeker.first_name || ''} ${jobseeker.last_name || ''}`.trim() || jobseeker.email;

    console.log('✅ Enrolling user:', {
      userId,
      jobseekerName,
      trainingId,
      trainingTitle: training.title
    });

    // Check for existing enrollment
    const existingEnrollment = await client.query(
      'SELECT id, status FROM training_enrollments WHERE training_id = $1 AND user_id = $2',
      [trainingId, userId]
    );

    if (existingEnrollment.rows.length > 0) {
      await client.query('ROLLBACK');
      return {
        success: false,
        message: 'You are already enrolled in this training',
        enrollment: existingEnrollment.rows[0]
      };
    }

    // Check capacity
    if (training.max_participants && training.current_participants >= training.max_participants) {
      await client.query('ROLLBACK');
      return { success: false, message: 'Training is at full capacity' };
    }

    // Create enrollment
    const enrollmentResult = await client.query(`
      INSERT INTO training_enrollments (training_id, user_id, status, enrolled_at, progress_percentage)
      VALUES ($1, $2, 'enrolled', CURRENT_TIMESTAMP, 0)
      RETURNING *
    `, [trainingId, userId]);

    // Update training participant counts
    await client.query(`
      UPDATE trainings
      SET
        current_participants = COALESCE(current_participants, 0) + 1,
        total_students = COALESCE(total_students, 0) + 1
      WHERE id = $1
    `, [trainingId]);

    await client.query('COMMIT');

    const enrollment = enrollmentResult.rows[0];

    console.log('✅ Enrollment successful, sending notifications...');

    // ✅ FIXED: Notify employer with jobseeker's FULL NAME in the message
    this.createNotification(
      training.provider_id,
      'new_enrollment',
      `${jobseekerName} has enrolled in "${training.title}"`,  // ✅ Clear message with name
      {
        training_id: trainingId,
        training_title: training.title,
        user_id: userId,
        enrollment_id: enrollment.id,
        jobseeker_name: jobseekerName,  // ✅ Include name in metadata
        jobseeker_email: jobseeker.email,
        jobseeker_first_name: jobseeker.first_name,
        jobseeker_last_name: jobseeker.last_name
      }
    ).catch(err => console.error('Failed to notify employer:', err));

    // ✅ Notify jobseeker about enrollment confirmation
    this.createNotification(
      userId,
      'enrollment_confirmed',
      `You've successfully enrolled in "${training.title}"`,
      {
        training_id: trainingId,
        training_title: training.title,
        enrollment_id: enrollment.id
      }
    ).catch(err => console.error('Failed to notify jobseeker:', err));

    console.log('✅ Notifications sent successfully');

    return {
      success: true,
      message: 'Successfully enrolled in training',
      enrollment
    };
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('❌ Enrollment error:', error);
    return {
      success: false,
      message: 'Failed to enroll in training. Please try again.',
      error: error.message
    };
  } finally {
    client.release();
  }
}

  async unenrollUserFromTraining(trainingId: string, userId: string): Promise<boolean> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(`
        DELETE FROM training_enrollments
        WHERE training_id = $1 AND user_id = $2 AND status IN ('enrolled', 'in_progress')
      `, [trainingId, userId]);
      if ((result.rowCount ?? 0) === 0) {
        await client.query('ROLLBACK');
        return false;
      }
      await client.query(`
        UPDATE trainings
        SET current_participants = current_participants - 1
        WHERE id = $1 AND current_participants > 0
      `, [trainingId]);
      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // ============================================
  // PROGRESS UPDATES
  // ============================================
  async updateTrainingProgress(trainingId: string, userId: string, progressData: any): Promise<any> {
    // First check if enrollment exists
    const enrollmentCheck = await this.db.query(`
      SELECT id FROM training_enrollments
      WHERE training_id = $1 AND user_id = $2
    `, [trainingId, userId]);
    if (enrollmentCheck.rows.length === 0) {
      throw new Error('Training enrollment not found');
    }
    const enrollmentId = enrollmentCheck.rows[0].id;
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      // Update only the columns that exist in your schema
      await client.query(`
        UPDATE training_enrollments
        SET
          progress_percentage = $1,
          status = CASE
            WHEN $1 = 100 THEN 'completed'
            WHEN $1 > 0 THEN 'in_progress'
            ELSE status
          END,
          completed_at = CASE WHEN $1 = 100 THEN CURRENT_TIMESTAMP ELSE completed_at END
        WHERE id = $2
      `, [progressData.progress_percentage, enrollmentId]);
      // Update individual video progress if provided
      if (progressData.video_progress && Array.isArray(progressData.video_progress)) {
        for (const videoData of progressData.video_progress) {
          // Check if training_video_progress table exists, if not skip this part
          try {
            await client.query(`
              INSERT INTO training_video_progress (enrollment_id, video_id, watch_time_minutes, is_completed, completed_at)
              VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT (enrollment_id, video_id)
              DO UPDATE SET
                watch_time_minutes = EXCLUDED.watch_time_minutes,
                is_completed = EXCLUDED.is_completed,
                completed_at = EXCLUDED.completed_at
            `, [
              enrollmentId,
              videoData.video_id,
              videoData.watch_time || 0,
              videoData.completed || false,
              videoData.completed_at
            ]);
          } catch (videoError: any) {
            // If video progress table doesn't exist, continue without failing
          }
        }
      }
      await client.query('COMMIT');
      // Return updated progress
      return await this.getUserTrainingProgress(trainingId, userId);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async updateUserProgress(trainingId: string, userId: string, progressData: any): Promise<any> {
    const enrollmentResult = await this.db.query(`
      SELECT id FROM training_enrollments
      WHERE training_id = $1 AND user_id = $2
    `, [trainingId, userId]);
    if (enrollmentResult.rows.length === 0) return null;
    const enrollmentId = enrollmentResult.rows[0].id;
    if (progressData.video_id) {
      const videoProgressResult = await this.db.query(`
        INSERT INTO training_video_progress (enrollment_id, video_id, watch_time_minutes, is_completed)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (enrollment_id, video_id)
        DO UPDATE SET
          watch_time_minutes = EXCLUDED.watch_time_minutes,
          is_completed = EXCLUDED.is_completed,
          completed_at = CASE WHEN EXCLUDED.is_completed AND NOT training_video_progress.is_completed
                            THEN CURRENT_TIMESTAMP
                            ELSE training_video_progress.completed_at END
        RETURNING *
      `, [enrollmentId, progressData.video_id, progressData.watch_time_minutes || 0, progressData.is_completed || false]);
      const progressCalculation = await this.db.query(`
        SELECT
          COUNT(*) as total_videos,
          COUNT(*) FILTER (WHERE tvp.is_completed = true) as completed_videos
        FROM training_videos tv
        LEFT JOIN training_video_progress tvp ON tv.id = tvp.video_id AND tvp.enrollment_id = $1
        WHERE tv.training_id = $2
      `, [enrollmentId, trainingId]);
      const { total_videos, completed_videos } = progressCalculation.rows[0];
      const progressPercentage = total_videos > 0 ? Math.round((completed_videos / total_videos) * 100) : 0;
      const enrollmentUpdate = await this.db.query(`
        UPDATE training_enrollments
        SET
          progress_percentage = $1,
          status = CASE
            WHEN $1 = 100 THEN 'completed'
            WHEN $1 > 0 THEN 'in_progress'
            ELSE status
          END,
          completed_at = CASE WHEN $1 = 100 THEN CURRENT_TIMESTAMP ELSE completed_at END
        WHERE id = $2
        RETURNING *
      `, [progressPercentage, enrollmentId]);
      return {
        video_progress: videoProgressResult.rows[0],
        enrollment: enrollmentUpdate.rows[0],
        overall_progress: progressPercentage
      };
    }
    return null;
  }

  async getUserTrainingProgress(trainingId: string, userId: string): Promise<any> {
    const query = `
      SELECT
        e.*,
        t.title as training_title,
        t.duration_hours
      FROM training_enrollments e
      JOIN trainings t ON e.training_id = t.id
      WHERE e.training_id = $1 AND e.user_id = $2
    `;
    const result = await this.db.query(query, [trainingId, userId]);
    if (result.rows.length === 0) {
      return null;
    }
    const enrollment = result.rows[0];
    // Try to get video progress from separate table if it exists
    let videoProgress = [];
    try {
      const videoQuery = `
        SELECT
          tv.id as video_id,
          tv.title as video_title,
          tv.duration_minutes as video_duration,
          tv.order_index,
          COALESCE(tvp.is_completed, false) as completed,
          COALESCE(tvp.watch_time_minutes, 0) as watch_time,
          tvp.completed_at
        FROM training_videos tv
        LEFT JOIN training_video_progress tvp ON tv.id = tvp.video_id AND tvp.enrollment_id = $1
        WHERE tv.training_id = $2
        ORDER BY tv.order_index
      `;
      const videoResult = await this.db.query(videoQuery, [enrollment.id, trainingId]);
      videoProgress = videoResult.rows;
    } catch (error) {
      // If video tables don't exist, use empty array
      videoProgress = [];
    }
    return {
      ...enrollment,
      video_progress: videoProgress
    };
  }

  // ============================================
  // REVIEW SUBMISSION
  // ============================================
  async submitTrainingReview(trainingId: string, userId: string, reviewData: { rating: number; review_text?: string }): Promise<any> {
    const enrollmentCheck = await this.db.query(`
      SELECT id FROM training_enrollments
      WHERE training_id = $1 AND user_id = $2
    `, [trainingId, userId]);
    if (enrollmentCheck.rows.length === 0) return null;
    const result = await this.db.query(`
      INSERT INTO training_reviews (training_id, user_id, rating, review_text)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (training_id, user_id)
      DO UPDATE SET
        rating = EXCLUDED.rating,
        review_text = EXCLUDED.review_text,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [trainingId, userId, reviewData.rating, reviewData.review_text]);
    await this.updateTrainingRating(trainingId);
    return result.rows[0];
  }

  // ============================================
  // JOBSEEKER STATS
  // ============================================
  async getJobseekerTrainingStats(params: { page: number; limit: number; sort_by: "created_at" | "title" | "rating" | "total_students" | "start_date"; sort_order: "asc" | "desc"; filters: { category: string; level: string[] | undefined; search: string; status: string[] | undefined; cost_type: string[] | undefined; mode: string[] | undefined; has_certificate: boolean | undefined; }; }, userId: string): Promise<any> {
    const query = `
      SELECT
        COUNT(*) as total_enrolled,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_count,
        COUNT(*) FILTER (WHERE certificate_issued = true) as certificates_earned,
        COALESCE(AVG(progress_percentage), 0) as avg_progress,
        SUM(CASE WHEN t.cost_type = 'Paid' THEN t.price ELSE 0 END) as total_spent
      FROM training_enrollments e
      JOIN trainings t ON e.training_id = t.id
      WHERE e.user_id = $1
    `;
    const result = await this.db.query(query, [userId]);
    const stats = result.rows[0];
    const trendQuery = `
      SELECT
        DATE_TRUNC('month', enrolled_at) as month,
        COUNT(*) as count
      FROM training_enrollments
      WHERE user_id = $1 AND enrolled_at >= CURRENT_DATE - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month', enrolled_at)
      ORDER BY month
    `;
    const trendResult = await this.db.query(trendQuery, [userId]);
    return {
      total_enrolled: parseInt(stats.total_enrolled),
      completed_count: parseInt(stats.completed_count),
      in_progress_count: parseInt(stats.in_progress_count),
      certificates_earned: parseInt(stats.certificates_earned),
      avg_progress: parseFloat(stats.avg_progress),
      total_spent: parseFloat(stats.total_spent || 0),
      monthly_enrollments: trendResult.rows.map(row => ({
        month: row.month,
        count: parseInt(row.count)
      }))
    };
  }
  // ✅ FIXED: Certificate issuance with proper notification
async issueCertificate(enrollmentId: string, employerId: string): Promise<any> {
  try {
    console.log('🎓 Issuing certificate:', { enrollmentId, employerId });
    
    // Get enrollment details
    const enrollmentRes = await this.db.query(
      `SELECT 
        en.*, 
        tr.title AS training_title, 
        tr.provider_id AS training_provider_id, 
        tr.has_certificate AS supports_certificate, 
        us.id AS jobseeker_id, 
        us.email AS jobseeker_email, 
        us.first_name, 
        us.last_name
       FROM training_enrollments en
       JOIN trainings tr ON en.training_id = tr.id
       JOIN users us ON en.user_id = us.id
       WHERE en.id = $1`,
      [enrollmentId]
    );

    if (enrollmentRes.rows.length === 0) {
      throw new Error('Enrollment not found');
    }

    const row = enrollmentRes.rows[0];

    // Verify employer ownership
    const profileCheck = await this.db.query(
      'SELECT id FROM employers WHERE user_id = $1',
      [employerId]
    );
    const profileId = profileCheck.rows.length > 0 ? profileCheck.rows[0].id : null;

    const ownerMatch = row.training_provider_id === employerId || 
                      row.training_provider_id === profileId;
    
    if (!ownerMatch) {
      throw new Error('Unauthorized: You can only issue certificates for your own trainings');
    }

    if (!row.supports_certificate) {
      throw new Error('This training does not provide certificates');
    }

    if (row.certificate_issued) {
      console.log('ℹ️ Certificate already issued');
      return { 
        success: true, 
        message: 'Certificate already issued', 
        certificate_url: row.certificate_url,
        enrollment_id: enrollmentId  // ✅ Return enrollment_id
      };
    }

    // Generate certificate PDF
    const cert = await this.generateCertificate(
      enrollmentId, 
      row.user_id, 
      row.training_id, 
      row.training_title
    );

    console.log('📄 Certificate generated:', cert.certificate_url);

    // Update database with certificate info
    await this.db.query(
      `UPDATE training_enrollments
       SET certificate_issued = true, 
           certificate_url = $1, 
           certificate_issued_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [cert.certificate_url, enrollmentId]
    );

    console.log('✅ Database updated with certificate URL');

    const jobseekerName = `${row.first_name || ''} ${row.last_name || ''}`.trim() || 
                          row.jobseeker_email;

    // ✅ CRITICAL: Notify jobseeker with ALL required metadata
    console.log('📬 Sending notification to jobseeker...');
    await this.createNotification(
      row.user_id,  // jobseeker user_id
      'certificate_issued',
      `🎉 Certificate issued for "${row.training_title}"! Click to download.`,
      {
        training_id: row.training_id,
        enrollment_id: enrollmentId,           // ✅ CRITICAL - This becomes related_id
        certificate_url: cert.certificate_url,
        training_title: row.training_title,
        issued_by: employerId,
        issued_at: new Date().toISOString()
      }
    );

    console.log('✅ Jobseeker notification sent');

    // Notify employer
    console.log('📬 Sending notification to employer...');
    await this.createNotification(
      employerId,
      'certificate_issued',
      `Certificate issued to ${jobseekerName} for "${row.training_title}".`,
      { 
        enrollment_id: enrollmentId,
        training_id: row.training_id,
        jobseeker_id: row.user_id,
        jobseeker_name: jobseekerName,
        training_title: row.training_title
      }
    );

    console.log('✅ Employer notification sent');
    console.log('✅ Certificate issuance complete');

    return { 
      success: true, 
      message: 'Certificate issued successfully', 
      certificate_url: cert.certificate_url,
      enrollment_id: enrollmentId  // ✅ Return enrollment_id
    };
  } catch (err: any) {
    console.error('❌ Error issuing certificate:', err);
    throw err;
  }
}


async debugNotifications(): Promise<void> {
  try {
    console.log('🔍 Debugging notifications...');
    
    // Check column types
    const columnInfo = await this.db.query(`
      SELECT 
        column_name, 
        data_type, 
        udt_name
      FROM information_schema.columns
      WHERE table_name = 'notifications'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Notifications table structure:');
    console.table(columnInfo.rows);
    
    // Check recent certificate notifications
    const recentNotifications = await this.db.query(`
      SELECT 
        id,
        user_id,
        type,
        related_id,
        metadata->>'enrollment_id' as enrollment_id_from_metadata,
        created_at
      FROM notifications
      WHERE type = 'certificate_issued'
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    console.log('📋 Recent certificate notifications:');
    console.table(recentNotifications.rows);
    
  } catch (error) {
    console.error('❌ Debug error:', error);
  }
}

  // In training.service.ts - ensure this exists
async manuallyIssueCertificate(enrollmentId: string, employerId: string): Promise<any> {
  console.log('📜 Manually issuing certificate:', { enrollmentId, employerId });

  // Get enrollment details
  const enrollmentResult = await this.db.query(`
    SELECT e.*, t.title, t.provider_id, t.has_certificate, u.id as user_id
    FROM training_enrollments e
    JOIN trainings t ON e.training_id = t.id
    JOIN users u ON e.user_id = u.id
    WHERE e.id = $1
  `, [enrollmentId]);

  if (enrollmentResult.rows.length === 0) {
    throw new Error('Enrollment not found');
  }

  const enrollment = enrollmentResult.rows[0];

  // Verify ownership
  const employerProfileCheck = await this.db.query(
    'SELECT id FROM employers WHERE user_id = $1',
    [employerId]
  );

  const employerProfileId = employerProfileCheck.rows.length > 0
    ? employerProfileCheck.rows[0].id
    : null;

  const isOwner = enrollment.provider_id === employerId || enrollment.provider_id === employerProfileId;

  if (!isOwner) {
    throw new Error('Unauthorized');
  }

  // Check if training offers certificate
  if (!enrollment.has_certificate) {
    throw new Error('This training does not offer certificates');
  }

  // Check if already issued
  if (enrollment.certificate_issued) {
    return {
      success: true,
      message: 'Certificate already issued',
      certificate_url: enrollment.certificate_url
    };
  }

  // Generate certificate
  const certResult = await this.generateCertificate(
    enrollmentId,
    enrollment.user_id,
    enrollment.training_id,
    enrollment.title
  );

  // Update enrollment
  await this.db.query(`
    UPDATE training_enrollments
    SET certificate_issued = true, certificate_url = $1, certificate_issued_at = CURRENT_TIMESTAMP
    WHERE id = $2
  `, [certResult.certificate_url, enrollmentId]);

  // Create notification for jobseeker
  await this.createNotification(
    enrollment.user_id,
    'certificate_issued',
    `Congratulations! You've earned a certificate for ${enrollment.title}`,
    {
      training_id: enrollment.training_id,
      enrollment_id: enrollmentId,
      certificate_url: certResult.certificate_url
    }
  );

  console.log('✅ Certificate issued successfully');

  return {
    success: true,
    message: 'Certificate issued successfully',
    certificate_url: certResult.certificate_url
  };
}

  /**
   * ✅ CRITICAL FIX: Add notification to publishTraining
   * Replace your existing publishTraining method
   */
  async publishTraining(trainingId: string, employerId: string): Promise<any> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
    
      // Get training details
      const trainingResult = await client.query(
        'SELECT * FROM trainings WHERE id = $1',
        [trainingId]
      );
    
      if (trainingResult.rows.length === 0) {
        throw new Error('Training not found');
      }
    
      const training = trainingResult.rows[0];
    
      // Update status to published
      await client.query(
        'UPDATE trainings SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['published', trainingId]
      );
    
      await client.query('COMMIT');
    
      // ✅ NEW: Notify jobseekers about the newly published training
      this.notifyJobseekersAboutNewTraining(
        trainingId,
        training.title,
        training.category,
        training.provider_name
      ).catch(err => console.error('Failed to notify jobseekers:', err));
    
      return { success: true, message: 'Training published successfully' };
    
    } catch (error: any) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // ============================================
  // RECOMMENDATIONS
  // ============================================
  async getRecommendedTrainings(userId: string, limit: number = 10): Promise<Training[]> {
    const query = `
      WITH user_categories AS (
        SELECT DISTINCT t.category, AVG(t.rating) as avg_category_rating
        FROM training_enrollments e
        JOIN trainings t ON e.training_id = t.id
        WHERE e.user_id = $1
        GROUP BY t.category
      ),
      recommended AS (
        SELECT DISTINCT t.*,
              CASE WHEN uc.category IS NOT NULL THEN 2 ELSE 1 END as relevance_score
        FROM trainings t
        LEFT JOIN user_categories uc ON t.category = uc.category
        LEFT JOIN training_enrollments e ON t.id = e.training_id AND e.user_id = $1
        WHERE t.status = 'published'
          AND e.id IS NULL
          AND t.rating >= 4.0
        ORDER BY relevance_score DESC, t.rating DESC, t.total_students DESC
        LIMIT $2
      )
      SELECT * FROM recommended
    `;
    const result = await this.db.query(query, [userId, limit]);
    return result.rows.map(this.mapTrainingFromDb);
  }

  // ============================================
  // CATEGORIES
  // ============================================
  async getTrainingCategories(): Promise<any[]> {
    const query = `
      SELECT
        category,
        COUNT(*) as training_count,
        AVG(rating) as avg_rating,
        COUNT(*) FILTER (WHERE cost_type = 'Free') as free_count,
        COUNT(*) FILTER (WHERE has_certificate = true) as certificate_count
      FROM trainings
      WHERE status = 'published'
      GROUP BY category
      ORDER BY training_count DESC
    `;
    const result = await this.db.query(query);
    return result.rows.map(row => ({
      name: row.category,
      training_count: parseInt(row.training_count),
      avg_rating: parseFloat(row.avg_rating),
      free_count: parseInt(row.free_count),
      certificate_count: parseInt(row.certificate_count)
    }));
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================
  private async getTrainingVideos(trainingId: string) {
    const result = await this.db.query(
      'SELECT * FROM training_videos WHERE training_id = $1 ORDER BY order_index',
      [trainingId]
    );
    return result.rows;
  }

  private async getTrainingOutcomes(trainingId: string) {
    const result = await this.db.query(
      'SELECT * FROM training_outcomes WHERE training_id = $1 ORDER BY order_index',
      [trainingId]
    );
    return result.rows;
  }

  private async updateTrainingRating(trainingId: string): Promise<void> {
    const ratingQuery = `
      SELECT AVG(rating) as avg_rating, COUNT(*) as review_count
      FROM training_reviews
      WHERE training_id = $1
    `;
    const ratingResult = await this.db.query(ratingQuery, [trainingId]);
    const { avg_rating, review_count } = ratingResult.rows[0];
    await this.db.query(`
      UPDATE trainings
      SET rating = $1
      WHERE id = $2
    `, [parseFloat(avg_rating) || 0, trainingId]);
  }

  private mapTrainingFromDb(row: any): Training {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      level: row.level,
      duration_hours: row.duration_hours,
      cost_type: row.cost_type,
      price: parseFloat(row.price),
      mode: row.mode,
      provider_id: row.provider_id,
      provider_name: row.provider_name,
      has_certificate: row.has_certificate,
      rating: parseFloat(row.rating),
      total_students: row.total_students,
      thumbnail_url: row.thumbnail_url,
      location: row.location,
      start_date: row.start_date,
      end_date: row.end_date,
      max_participants: row.max_participants,
      current_participants: row.current_participants,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
}