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
import { promises as fs } from 'fs';
import { join } from 'path';

interface GenerateCertificateParams {
  enrollmentId: string;
  jobseekerName: string;
  trainingTitle: string;
  completionDate: Date;
  companyName: string;
  issuerName: string;
}

export class TrainingService {
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
    try {
      const title = this.generateNotificationTitle(type, message);

      console.log('📬 Creating notification:', {
        userId,
        type,
        title,
        messagePreview: message.substring(0, 50),
        metadata
      });

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

      let relatedId: string | null = null;
      if (metadata?.enrollment_id) relatedId = metadata.enrollment_id;
      else if (metadata?.training_id) relatedId = metadata.training_id;
      else if (metadata?.certificate_id) relatedId = metadata.certificate_id;

      if (!relatedId) {
        console.warn('⚠️ No related_id found in metadata:', metadata);
      }

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
        relatedId
      ];

      await this.db.query(query, values);
      console.log('✅ Notification created successfully with related_id:', relatedId);
    } catch (error: any) {
      console.error('❌ Error creating notification:', error);
      console.error('Error code:', error.code);
      console.error('Error detail:', error.detail);
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
      console.log('📢 Notifying enrolled jobseekers:', { trainingId, type: notificationType });
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
              training_id: trainingId
            }
          )
        )
      );

      console.log('✅ All enrolled users notified successfully');
    } catch (error: any) {
      console.error('❌ Error notifying enrolled jobseekers:', error);
    }
  }

  async notifyJobseekersAboutNewTraining(
    trainingId: string,
    trainingTitle: string,
    category: string,
    employerName: string
  ): Promise<void> {
    try {
      console.log('📢 Notifying jobseekers about new training:', trainingTitle);
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

        await Promise.all(
          jobseekers.rows.map(jobseeker =>
            this.createNotification(jobseeker.id, 'new_training', message, metadata)
          )
        );

        offset += BATCH_SIZE;
        if (jobseekers.rows.length < BATCH_SIZE) hasMore = false;
      }

      console.log(`✅ All jobseekers notified about new training`);
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
    }
  }

  async getNotifications(
    userId: string,
    params: { page?: number; limit?: number; read?: boolean | string }
  ): Promise<any> {
    const { page = 1, limit = 10, read } = params;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE user_id = $1';
    const queryParams: any[] = [userId];
    let paramIndex = 2;

    if (read !== undefined) {
      const readBool = (read === true || read === 'true');
      whereClause += ` AND read = $${paramIndex++}`;
      queryParams.push(readBool);
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

    const result = await this.db.query(query, queryParams);

    const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;

    return {
      notifications: result.rows.map(row => ({
        id: row.id,
        user_id: row.user_id,
        type: row.type,
        title: row.title,
        message: row.message,
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
  // VIDEO PROGRESS & COMPLETION
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

      const enrollmentResult = await client.query(
        'SELECT id FROM training_enrollments WHERE training_id = $1 AND user_id = $2',
        [trainingId, userId]
      );

      if (enrollmentResult.rows.length === 0) {
        await client.query('ROLLBACK');
        throw new Error('User is not enrolled in this training');
      }

      const enrollmentId = enrollmentResult.rows[0].id;

      const videoCheck = await client.query(
        'SELECT id, title FROM training_videos WHERE id = $1 AND training_id = $2',
        [videoId, trainingId]
      );

      if (videoCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        throw new Error('Video not found in this training');
      }

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

      if (trainingCompleted) {
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

        await this.createNotification(
          trainingRow.provider_id,
          'training_completed',
          `${userName} completed "${trainingTitle}"! Ready to issue certificate.`,
          {
            training_id: trainingId,
            enrollment_id: enrollmentId,
            jobseeker_id: userId,
            jobseeker_name: userName,
            jobseeker_email: userRow.email,
            training_title: trainingTitle,
            completed_at: new Date().toISOString(),
            action_required: 'issue_certificate'
          }
        );

        await this.createNotification(
          userId,
          'training_completed',
          `🎉 Congratulations! You completed "${trainingTitle}". Awaiting certificate issuance from employer.`,
          {
            training_id: trainingId,
            enrollment_id: enrollmentId,
            training_title: trainingTitle,
            completed_at: new Date().toISOString(),
            awaiting_certificate: true
          }
        );
      }

      await client.query('COMMIT');

      return {
        success: true,
        overall_progress: progressPercentage,
        training_completed: trainingCompleted,
        certificate_issued: false,
        certificate_url: null,
        enrollment,
        video_progress: progressResult.rows[0]
      };
    } catch (error: any) {
      await client.query('ROLLBACK');
      console.error('❌ Error in updateVideoProgress:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // ============================================
  // CERTIFICATE GENERATION & ISSUANCE
  // ============================================

  async manuallyIssueCertificate(enrollmentId: string, employerId: string): Promise<any> {
    console.log('📜 Manually issuing certificate:', { enrollmentId, employerId });

    const enrollmentResult = await this.db.query(`
      SELECT
        e.*,
        t.title AS training_title,
        t.provider_id,
        t.has_certificate,
        u.id AS user_id,
        u.first_name,
        u.last_name,
        u.email AS user_email,
        e.completed_at
      FROM training_enrollments e
      JOIN trainings t ON e.training_id = t.id
      JOIN users u ON e.user_id = u.id
      WHERE e.id = $1
    `, [enrollmentId]);

    if (enrollmentResult.rows.length === 0) {
      throw new Error('Enrollment not found');
    }

    const enrollment = enrollmentResult.rows[0];

    const profileCheck = await this.db.query(
      'SELECT id FROM employers WHERE user_id = $1',
      [employerId]
    );
    const profileId = profileCheck.rows.length > 0 ? profileCheck.rows[0].id : null;

    const isOwner = enrollment.provider_id === employerId || enrollment.provider_id === profileId;
    if (!isOwner) {
      throw new Error('Unauthorized: You can only issue certificates for your own trainings');
    }

    if (!enrollment.has_certificate) {
      throw new Error('This training does not offer certificates');
    }

    if (enrollment.certificate_issued) {
      return {
        success: true,
        message: 'Certificate already issued',
        certificate_url: enrollment.certificate_url,
        enrollment_id: enrollmentId
      };
    }

    const jobseekerName = `${(enrollment.first_name || '').trim()} ${(enrollment.last_name || '').trim()}`.trim()
      || enrollment.user_email || 'Student';

    const completionDate = enrollment.completed_at ? new Date(enrollment.completed_at) : new Date();

    const employerQuery = await this.db.query(`
      SELECT
        u.name AS employer_name,
        u.email AS employer_email,
        e.company_name,
        c.name AS company_full_name
      FROM users u
      LEFT JOIN employers e ON u.id = e.user_id
      LEFT JOIN companies c ON e.company_id = c.id
      WHERE u.id = $1
    `, [employerId]);

    if (employerQuery.rows.length === 0) {
      throw new Error('Employer not found');
    }

    const emp = employerQuery.rows[0];
    const companyName = emp.company_full_name || emp.company_name || emp.employer_name || 'Training Provider';
    const issuerName = emp.employer_name || emp.employer_email?.split('@')[0] || 'Authorized Representative';

    console.log('✅ Using real names on certificate:', { companyName, issuerName });

    const cert = await this.generateCertificate({
      enrollmentId,
      jobseekerName,
      trainingTitle: enrollment.training_title,
      completionDate,
      companyName,
      issuerName
    });

    await this.db.query(`
      UPDATE training_enrollments
      SET certificate_issued = true,
          certificate_url = $1,
          certificate_issued_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [cert.certificate_url, enrollmentId]);

    await this.createNotification(
      enrollment.user_id,
      'certificate_issued',
      `🎉 Certificate issued for "${enrollment.training_title}"! Click to download.`,
      {
        training_id: enrollment.training_id,
        enrollment_id: enrollmentId,
        certificate_url: cert.certificate_url,
        training_title: enrollment.training_title,
        issued_by_company: companyName,
        issued_by_person: issuerName,
        issued_at: new Date().toISOString()
      }
    );

    await this.createNotification(
      employerId,
      'certificate_issued',
      `Certificate issued to ${jobseekerName} for "${enrollment.training_title}".`,
      {
        enrollment_id: enrollmentId,
        jobseeker_name: jobseekerName,
        training_title: enrollment.training_title,
      }
    );

    return {
      success: true,
      message: 'Certificate issued successfully',
      certificate_url: cert.certificate_url,
      enrollment_id: enrollmentId
    };
  }

  async generateCertificate(params: GenerateCertificateParams): Promise<{ certificate_url: string }> {
    const {
      enrollmentId,
      jobseekerName,
      trainingTitle,
      completionDate,
      companyName,
      issuerName
    } = params;

    const finalCompanyName = (companyName || 'Training Provider').trim();
    const finalIssuerName = (issuerName || 'Authorized Representative').trim();

    const formattedDate = completionDate.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margins: { top: 50, bottom: 50, left: 50, right: 50 }
    });

    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));

    doc.lineWidth(4).rect(30, 30, doc.page.width - 60, doc.page.height - 60).stroke('#000000');

    doc.fontSize(36).font('Helvetica-Bold').text('Certificate of Completion', 0, 120, { align: 'center' });

    doc.fontSize(20).font('Helvetica').text('This is to certify that', 0, 200, { align: 'center' });

    doc.fontSize(34).font('Helvetica-Bold').text(jobseekerName, 0, 250, { align: 'center' });

    doc.fontSize(20).font('Helvetica').text('has successfully completed the training', 0, 310, { align: 'center' });

    doc.fontSize(24).font('Helvetica-Bold').text(trainingTitle, 0, 360, { align: 'center', width: 650, lineGap: 8 });

    doc.fontSize(18).font('Helvetica').text(`Date of Completion: ${formattedDate}`, 0, 460, { align: 'center' });

    doc.moveTo(200, 520).lineTo(doc.page.width - 200, 520).lineWidth(1).stroke();

    doc.fontSize(16).font('Helvetica').text('Issued by:', 0, 540, { align: 'center' });

    doc.fontSize(26).font('Helvetica-Bold').text(finalCompanyName, 0, 570, { align: 'center' });

    doc.fontSize(20).font('Helvetica').text(finalIssuerName, 0, 620, { align: 'center' });

    doc.end();

    const pdfBuffer: Buffer = await new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)));
    });

    const certDir = join(__dirname, '..', '..', 'public', 'certificates');
    await fs.mkdir(certDir, { recursive: true });

    const fileName = `certificate_${enrollmentId}_${Date.now()}.pdf`;
    const filePath = join(certDir, fileName);
    await fs.writeFile(filePath, pdfBuffer);

    const certificate_url = `/public/certificates/${fileName}`;
    console.log('✅ Certificate generated and saved:', certificate_url);

    return { certificate_url };
  }

  // ============================================
  // VIDEO MANAGEMENT (Employer)
  // ============================================

  async addVideoToTraining(
    trainingId: string,
    videoData: any,
    employerId: string
  ): Promise<any> {
    const employerProfileCheck = await this.db.query(
      'SELECT id FROM employers WHERE user_id = $1',
      [employerId]
    );
    const employerProfileId = employerProfileCheck.rows.length > 0 ? employerProfileCheck.rows[0].id : null;

    const ownershipCheck = await this.db.query(
      'SELECT id, title, provider_name FROM trainings WHERE id = $1 AND (provider_id = $2 OR provider_id = $3)',
      [trainingId, employerId, employerProfileId]
    );
    if (ownershipCheck.rows.length === 0) {
      throw new Error('Unauthorized');
    }

    const training = ownershipCheck.rows[0];

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
    const employerProfileCheck = await this.db.query(
      'SELECT id FROM employers WHERE user_id = $1',
      [employerId]
    );
    const employerProfileId = employerProfileCheck.rows.length > 0 ? employerProfileCheck.rows[0].id : null;

    const ownershipCheck = await this.db.query(`
      SELECT v.id, t.provider_id, t.title
      FROM training_videos v
      JOIN trainings t ON v.training_id = t.id
      WHERE v.id = $1
        AND t.id = $2
        AND (t.provider_id = $3 OR t.provider_id = $4)
    `, [videoId, trainingId, employerId, employerProfileId]);

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

  async deleteTrainingVideo(
    trainingId: string,
    videoId: string,
    employerId: string
  ): Promise<boolean> {
    const employerProfileCheck = await this.db.query(
      'SELECT id FROM employers WHERE user_id = $1',
      [employerId]
    );
    const employerProfileId = employerProfileCheck.rows.length > 0 ? employerProfileCheck.rows[0].id : null;

    const result = await this.db.query(`
      DELETE FROM training_videos v
      USING trainings t
      WHERE v.training_id = t.id
        AND v.id = $1
        AND t.id = $2
        AND (t.provider_id = $3 OR t.provider_id = $4)
      RETURNING v.id
    `, [videoId, trainingId, employerId, employerProfileId]);

    return (result.rowCount ?? 0) > 0;
  }

  // ============================================
  // ENROLLMENT NOTIFICATIONS (Employer)
  // ============================================

  async getEnrollmentNotifications(employerId: string): Promise<any> {
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
        CASE
          WHEN COALESCE(TRIM(CONCAT(u.first_name, ' ', u.last_name)), '') != ''
          THEN TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')))
          WHEN u.email IS NOT NULL
          THEN INITCAP(REGEXP_REPLACE(SPLIT_PART(u.email, '@', 1), '[_.-]', ' ', 'g'))
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
    return result.rows;
  }

  // ============================================
  // JOBSEEKER TRAINING ACCESS
  // ============================================

  async getTrainingWithDetailsForJobseeker(
    trainingId: string,
    userId: string
  ): Promise<any> {
    const trainingResult = await this.db.query(`
      SELECT
        t.*,
        e.id as enrollment_id,
        e.enrolled_at,
        e.status as enrollment_status,
        e.progress_percentage,
        e.completed_at,
        e.certificate_issued,
        e.certificate_url,
        CASE WHEN e.id IS NOT NULL THEN true ELSE false END as is_enrolled
      FROM trainings t
      LEFT JOIN training_enrollments e ON t.id = e.training_id AND e.user_id = $2
      WHERE t.id = $1 AND t.status = 'published'
    `, [trainingId, userId]);

    if (trainingResult.rows.length === 0) {
      throw new Error('Training not found or not published');
    }

    const training = trainingResult.rows[0];

    const videosResult = await this.db.query(`
      SELECT
        v.id, v.title, v.description, v.video_url, v.duration_minutes,
        v.order_index, v.is_preview
      FROM training_videos v
      WHERE v.training_id = $1
      ORDER BY v.order_index
    `, [trainingId]);

    training.videos = videosResult.rows;

    try {
      const outcomesResult = await this.db.query(`
        SELECT id, outcome_text, order_index
        FROM learning_outcomes
        WHERE training_id = $1
        ORDER BY order_index
      `, [trainingId]);
      training.learning_outcomes = outcomesResult.rows;
    } catch {
      training.learning_outcomes = [];
    }

    return training;
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

    let whereConditions: string[] = ["t.status = 'published'"];
    let queryParams: any[] = [];
    let paramIndex = 1;

    if (filters.category) {
      whereConditions.push(`t.category = $${paramIndex++}`);
      queryParams.push(filters.category);
    }
    if (params.search) {
      whereConditions.push(`(t.title ILIKE $${paramIndex} OR t.description ILIKE $${paramIndex})`);
      queryParams.push(`%${params.search}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const query = `
      SELECT
        t.*,
        CASE WHEN e.id IS NOT NULL THEN true ELSE false END as enrolled,
        COALESCE(e.progress_percentage, 0) as progress,
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
    const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;

    return {
      trainings: result.rows.map(row => {
        const mapped = this.mapTrainingFromDb(row);
        return {
          ...mapped,
          enrolled: !!row.enrolled,
          progress: typeof row.progress !== 'undefined' ? Number(row.progress) : 0
        };
      }),
      pagination: {
        current_page: page,
        total_pages: Math.ceil(totalCount / limit),
        total_count: totalCount,
        page_size: 0,
        has_next: false,
        has_previous: false
      },
      filters_applied: filters
    };
  }

  // ============================================
  // CRUD, ENROLLMENT, ANALYTICS, REVIEWS, RECOMMENDATIONS, ETC.
  // ============================================

  async createTraining(data: CreateTrainingRequest, employerId: string): Promise<Training> {
    // ... (full implementation from your code)
    // This is a placeholder — you already have this method
    throw new Error('createTraining not shown for brevity — include your full version');
  }

  async updateTraining(id: string, data: UpdateTrainingRequest, employerId: string): Promise<Training | null> {
    // ... full implementation
    throw new Error('updateTraining not shown — include your version');
  }

  async deleteTraining(id: string, employerId: string): Promise<boolean> {
    // ... full implementation
    throw new Error('deleteTraining not shown');
  }

  async publishTraining(trainingId: string, employerId: string): Promise<any> {
    // ... with notifyJobseekersAboutNewTraining
    throw new Error('publishTraining not shown');
  }

  async enrollUserInTraining(trainingId: string, userId: string): Promise<any> {
    // ... full implementation
    throw new Error('enrollUserInTraining not shown');
  }

  async getTrainingAnalytics(trainingId: string, employerId: string, timeRange: string): Promise<any> {
    // ... full analytics
    throw new Error('getTrainingAnalytics not shown');
  }

  async getTrainingReviews(trainingId: string, params: any): Promise<any> {
    // ... reviews
    throw new Error('getTrainingReviews not shown');
  }

  async getAllTrainings(params: TrainingSearchParams, employerId?: string): Promise<TrainingListResponse> {
    // ... employer dashboard list
    throw new Error('getAllTrainings not shown');
  }

  async getEnrolledTrainings(userId: string, params: TrainingSearchParams): Promise<TrainingListResponse> {
    // ... jobseeker enrolled list
    throw new Error('getEnrolledTrainings not shown');
  }

  async getRecommendedTrainings(userId: string, limit: number = 10): Promise<Training[]> {
    // ... recommendations
    throw new Error('getRecommendedTrainings not shown');
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