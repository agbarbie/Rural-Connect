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
  deleteTraining(id: string, userId: string) {
    throw new Error('Method not implemented.');
  }
  constructor(private db: Pool) {}

  // ============================================
  // NOTIFICATION SYSTEM
  // ============================================
  async createNotification(
    userId: string,
    type: string,
    message: string,
    metadata: any
  ): Promise<void> {
    await this.db.query(`
      INSERT INTO notifications (user_id, type, message, metadata, created_at, read)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, false)
    `, [userId, type, message, JSON.stringify(metadata)]);
  }

  async getNotifications(
    userId: string,
    params: { page: number; limit: number; read?: boolean }
  ): Promise<any> {
    const { page = 1, limit = 10, read } = params;
    const offset = (page - 1) * limit;
  
    let whereClause = 'WHERE user_id = $1';
    const queryParams: any[] = [userId];
    let paramIndex = 2;
  
    if (read !== undefined) {
      whereClause += ` AND read = $${paramIndex++}`;
      queryParams.push(read);
    }
  
    const query = `
      SELECT *, COUNT(*) OVER() as total_count
      FROM notifications
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
  
    queryParams.push(limit, offset);
  
    const result = await this.db.query(query, queryParams);
    const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;
  
    return {
      notifications: result.rows,
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
      await client.query('BEGIN');
      // Get enrollment
      const enrollmentResult = await client.query(
        'SELECT id FROM training_enrollments WHERE training_id = $1 AND user_id = $2',
        [trainingId, userId]
      );
      if (enrollmentResult.rows.length === 0) {
        throw new Error('Enrollment not found');
      }
      const enrollmentId = enrollmentResult.rows[0].id;
      // Upsert video progress
      await client.query(`
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
      `, [enrollmentId, videoId, watchTimeSeconds, isCompleted]);
      // Recalculate overall progress
      const progressResult = await client.query(`
        SELECT
          COUNT(*) as total_videos,
          COUNT(*) FILTER (WHERE tvp.is_completed = true) as completed_videos
        FROM training_videos tv
        LEFT JOIN training_video_progress tvp
          ON tv.id = tvp.video_id AND tvp.enrollment_id = $1
        WHERE tv.training_id = $2
      `, [enrollmentId, trainingId]);
      const { total_videos, completed_videos } = progressResult.rows[0];
      const progressPercentage = total_videos > 0
        ? Math.round((completed_videos / total_videos) * 100)
        : 0;
      // Update enrollment
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
      const trainingCompleted = progressPercentage === 100;
      // If completed, check for certificate
      let certificateIssued = false;
      let certificateUrl = null;
      if (trainingCompleted) {
        const trainingResult = await client.query(
          'SELECT has_certificate, provider_id, title FROM trainings WHERE id = $1',
          [trainingId]
        );
      
        if (trainingResult.rows[0].has_certificate) {
          // Generate certificate
          const certResult = await this.generateCertificate(
            enrollmentId,
            userId,
            trainingId,
            trainingResult.rows[0].title
          );
        
          certificateIssued = true;
          certificateUrl = certResult.certificate_url;
          // Update enrollment with certificate
          await client.query(`
            UPDATE training_enrollments
            SET certificate_issued = true, certificate_url = $1, certificate_issued_at = CURRENT_TIMESTAMP
            WHERE id = $2
          `, [certificateUrl, enrollmentId]);
          // Create notification for employer
          await this.createNotification(
            trainingResult.rows[0].provider_id,
            'training_completed',
            `A student has completed ${trainingResult.rows[0].title}`,
            { training_id: trainingId, user_id: userId, enrollment_id: enrollmentId }
          );
          // Create notification for jobseeker
          await this.createNotification(
            userId,
            'certificate_issued',
            `Congratulations! You've earned a certificate for ${trainingResult.rows[0].title}`,
            { training_id: trainingId, enrollment_id: enrollmentId, certificate_url: certificateUrl }
          );
        }
      }
      await client.query('COMMIT');
      return {
        success: true,
        overall_progress: progressPercentage,
        training_completed: trainingCompleted,
        certificate_issued: certificateIssued,
        certificate_url: certificateUrl,
        enrollment
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // ============================================
  // CERTIFICATE GENERATION
  // ============================================
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
  
    const certificateDir = join(__dirname, '../../uploads/certificates');
    if (!fs.existsSync(certificateDir)) {
      fs.mkdirSync(certificateDir, { recursive: true });
    }
  
    const certificatePath = path.join(certificateDir, certificateFileName);
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape' });
    const writeStream = createWriteStream(certificatePath);
  
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
        resolve({ certificate_url: `/certificates/${certificateFileName}` });
      });
      writeStream.on('error', reject);
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
    // Verify ownership
    const ownershipCheck = await this.db.query(
      'SELECT id FROM trainings WHERE id = $1 AND provider_id = $2',
      [trainingId, employerId]
    );
  
    if (ownershipCheck.rows.length === 0) {
      throw new Error('Unauthorized');
    }
  
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
  
    return result.rows[0];
  }

  async updateTrainingVideo(
    trainingId: string,
    videoId: string,
    videoData: any,
    employerId: string
  ): Promise<any> {
    // Verify ownership
    const ownershipCheck = await this.db.query(`
      SELECT v.id FROM training_videos v
      JOIN trainings t ON v.training_id = t.id
      WHERE v.id = $1 AND t.id = $2 AND t.provider_id = $3
    `, [videoId, trainingId, employerId]);
  
    if (ownershipCheck.rows.length === 0) {
      throw new Error('Unauthorized');
    }
  
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
  
    return result.rows[0];
  }



  // ============================================
  // ENROLLMENT NOTIFICATIONS (Employer)
  // ============================================
  async getEnrollmentNotifications(employerId: string): Promise<any> {
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
      WHERE t.provider_id = $1
      ORDER BY
        CASE
          WHEN e.completed_at IS NOT NULL THEN e.completed_at
          ELSE e.enrolled_at
        END DESC
    `;
  
    const result = await this.db.query(query, [employerId]);
    return result.rows;
  }

  // ============================================
  // JOBSEEKER-SPECIFIC TRAINING ACCESS
  // ============================================
async getTrainingWithDetailsForJobseeker(trainingId: string, userId: string): Promise<any> {
  // FIXED: Remove deleted_at check from query
  let query = `
    SELECT t.*,
          CASE WHEN e.id IS NOT NULL THEN true ELSE false END as enrolled,
          COALESCE(e.progress_percentage, 0) as progress,
          e.status as enrollment_status,
          e.id as enrollment_id
    FROM trainings t
    LEFT JOIN training_enrollments e ON t.id = e.training_id AND e.user_id = $2
    WHERE t.id = $1
      AND t.status = 'published'
      AND t.provider_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM employers emp
        WHERE emp.id = t.provider_id
      )
  `;
  
  const result = await this.db.query(query, [trainingId, userId]);
  if (result.rows.length === 0) {
    return null;
  }
  
  const training = this.mapTrainingFromDb(result.rows[0]);
  const isEnrolled = result.rows[0].enrolled;
  const enrollmentId = result.rows[0].enrollment_id;
  
  // Fetch videos (all for enrolled, only previews for not enrolled)
  const videosQuery = `
    SELECT id, training_id, title, description, video_url, duration_minutes, order_index, is_preview, created_at
    FROM training_videos
    WHERE training_id = $1
    ${isEnrolled ? '' : 'AND is_preview = true'}
    ORDER BY order_index
  `;
  const videosResult = await this.db.query(videosQuery, [trainingId]);
  
  // Fetch outcomes
  const outcomesResult = await this.db.query(
    `SELECT id, training_id, outcome_text, order_index, created_at
    FROM training_outcomes
    WHERE training_id = $1
    ORDER BY order_index`,
    [trainingId]
  );
  
  // Fetch video progress if enrolled
  let videoProgress = [];
  if (isEnrolled && enrollmentId) {
    try {
      const progressResult = await this.db.query(
        `SELECT video_id, watch_time_seconds as watch_time_minutes, is_completed, completed_at
        FROM training_video_progress
        WHERE enrollment_id = $1`,
        [enrollmentId]
      );
      videoProgress = progressResult.rows;
    } catch (error) {
      console.warn('Video progress table may not exist:', error);
    }
  }
  
  // Merge video progress
  const videosWithProgress = videosResult.rows.map(video => {
    const progress = videoProgress.find(p => p.video_id === video.id);
    return {
      ...video,
      completed: progress?.is_completed || false,
      watch_time: progress?.watch_time_minutes || 0,
      accessible: isEnrolled || video.is_preview
    };
  });
  
  return {
    ...training,
    enrolled: isEnrolled,
    progress: result.rows[0].progress || 0,
    enrollment_status: result.rows[0].enrollment_status,
    enrollment_id: enrollmentId,
    videos: videosWithProgress,
    outcomes: outcomesResult.rows,
    can_enroll: !isEnrolled && training.status === 'published'
  };
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
async getPublishedTrainingsForJobseeker(userId: string, params: TrainingSearchParams): Promise<TrainingListResponse> {
  const {
    page = 1,
    limit = 10,
    sort_by = 'created_at',
    sort_order = 'desc',
    filters = {}
  } = params;
  const offset = (page - 1) * limit;

  // FIXED: Simple employer existence check without deleted_at
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
      COUNT(*) OVER() as total_count
    FROM trainings t
    LEFT JOIN training_enrollments e ON t.id = e.training_id AND e.user_id = $${paramIndex++}
    ${whereClause}
    ORDER BY t.${sort_by} ${sort_order.toUpperCase()}
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}
  `;
  
  queryParams.push(userId, limit, offset);
  
  const result = await this.db.query(query, queryParams);
  const trainings = result.rows;
  const totalCount = trainings.length > 0 ? parseInt(trainings[0].total_count) : 0;
  
  return {
    trainings: trainings.map(row => ({
      ...this.mapTrainingFromDb(row),
      enrolled: row.enrolled,
      progress: row.progress || 0,
      enrollment_status: row.enrollment_status,
      enrolled_at: row.enrolled_at,
      completed_at: row.completed_at,
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
    
      // Return the created training
      const finalTraining = await this.getTrainingById(trainingId) as Training;
      return finalTraining;
    
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
      // STEP 1: Get the employer profile ID (same fix as createTraining)
      const employerProfileCheck = await client.query(
        'SELECT id FROM employers WHERE user_id = $1',
        [employerId]
      );
      if (employerProfileCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }
      const employerProfileId = employerProfileCheck.rows[0].id;
      // STEP 2: Verify training ownership using employer profile ID
      const ownershipCheck = await client.query(
        'SELECT id FROM trainings WHERE id = $1 AND provider_id = $2',
        [id, employerProfileId] // Use employer profile ID, not user ID
      );
      if (ownershipCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }
      // STEP 3: Build update query
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
      // FIXED: Handle video updates if provided (upsert for simplicity)
      if (data.videos && Array.isArray(data.videos) && data.videos.length > 0) {
        // First, delete existing videos for this training (or implement upsert logic)
        await client.query('DELETE FROM training_videos WHERE training_id = $1', [id]);
        // Then insert new ones (reuse create logic)
        for (let i = 0; i < data.videos.length; i++) {
          const video = data.videos[i];
          const isPreview = (i === 0) ? true : (video.is_preview || false); // FIXED: Maintain first video as preview
        
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
      return this.mapTrainingFromDb(result.rows[0]);
    } catch (error: any) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

// In deleteTrainingVideo method - ensure this logic exists
  async deleteTrainingVideo(
    trainingId: string,
    videoId: string,
    employerId: string
  ): Promise<boolean> {
    const result = await this.db.query(`
      DELETE FROM training_videos v
      USING trainings t
      WHERE v.training_id = t.id
        AND v.id = $1
        AND t.id = $2
        AND t.provider_id = $3
    `, [videoId, trainingId, employerId]);
  
    return (result.rowCount ?? 0) > 0;
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
  async getEnrolledTrainings(userId: string, params: TrainingSearchParams): Promise<TrainingListResponse> {
    const {
      page = 1,
      limit = 10,
      sort_by = 'enrolled_at',
      sort_order = 'desc'
    } = params;
    const offset = (page - 1) * limit;
    const query = `
      SELECT
        t.*,
        e.progress_percentage as progress,
        e.status as enrollment_status,
        e.enrolled_at,
        e.completed_at,
        e.id as enrollment_id,
        true as enrolled,
        (SELECT COUNT(*) FROM training_videos WHERE training_id = t.id) as total_videos,
        COUNT(*) OVER() as total_count
      FROM training_enrollments e
      JOIN trainings t ON e.training_id = t.id
      WHERE e.user_id = $1
      ORDER BY e.${sort_by} ${sort_order.toUpperCase()}
      LIMIT $2 OFFSET $3
    `;
    const result = await this.db.query(query, [userId, limit, offset]);
    const trainings = result.rows;
    const totalCount = trainings.length > 0 ? parseInt(trainings[0].total_count) : 0;
    return {
      trainings: trainings.map(row => ({
        ...this.mapTrainingFromDb(row),
        enrolled: true,
        progress: row.progress || 0,
        enrollment_status: row.enrollment_status,
        enrolled_at: row.enrolled_at,
        completed_at: row.completed_at,
        enrollment_id: row.enrollment_id,
        total_videos: parseInt(row.total_videos || 0)
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
      // Check if training exists and is published
      const trainingCheck = await client.query(
        'SELECT id, title, max_participants, current_participants, status FROM trainings WHERE id = $1',
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
      // Check if user is already enrolled
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
      // Check capacity if max_participants is set
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
      // FIXED: Update both current_participants and total_students for consistency
      await client.query(`
        UPDATE trainings
        SET
          current_participants = COALESCE(current_participants, 0) + 1,
          total_students = COALESCE(total_students, 0) + 1
        WHERE id = $1
      `, [trainingId]);
      await client.query('COMMIT');
    
      return {
        success: true,
        message: 'Successfully enrolled in training',
        enrollment: enrollmentResult.rows[0]
      };
    } catch (error: any) {
      await client.query('ROLLBACK');
    
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