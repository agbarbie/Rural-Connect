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

// ---------------------------------------------------------------------------
// Helper – generate a human-readable verification code
// Format: CERT-XXXX-XXXX-XXXX  (hex, upper-cased)
// ---------------------------------------------------------------------------
function generateVerificationCode(): string {
  const hex = crypto.randomBytes(6).toString('hex').toUpperCase();
  return `CERT-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
}

export class TrainingService {
  constructor(private db: Pool) {}

  // ==========================================================================
  // 1.  NOTIFICATION SYSTEM
  // ==========================================================================

  async createNotification(
    userId: string,
    type: string,
    message: string,
    metadata: Record<string, any>
  ): Promise<void> {
    try {
      const title = this.generateNotificationTitle(type, message);

      // Derive related_id from metadata (enrollment > training > application)
      const relatedId: string | null =
        metadata?.enrollment_id ?? metadata?.training_id ?? metadata?.application_id ?? null;

      const tableExists = await this.db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'notifications'
        );
      `);
      if (!tableExists.rows[0]?.exists) return;

      await this.db.query(
        `INSERT INTO notifications (user_id, type, title, message, metadata, related_id, created_at, read)
         VALUES ($1, $2, $3, $4, $5, $6::UUID, CURRENT_TIMESTAMP, false)`,
        [userId, type, title, message, JSON.stringify(metadata), relatedId]
      );
    } catch (err: any) {
      // Notifications are non-critical – log and continue
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

  /** Notify every *enrolled* trainee of a training about an event */
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

  /** Notify ALL job-seekers about a newly published training */
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

  // ---------- Read notifications ----------
  async getNotifications(
    userId: string,
    params: { page?: number; limit?: number; read?: boolean | string }
  ): Promise<any> {
    const { page = 1, limit = 10, read } = params;
    const offset = (page - 1) * limit;

    let where = 'WHERE user_id = $1';
    const qp: any[] = [userId];
    let idx = 2;

    if (read !== undefined) {
      where += ` AND read = $${idx++}`;
      qp.push(read === true || read === 'true');
    }

    qp.push(limit, offset);
    const result = await this.db.query(
      `SELECT id, user_id, type, title, message, metadata, read, created_at,
              COUNT(*) OVER() as total_count
       FROM notifications ${where}
       ORDER BY created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      qp
    );

    const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;
    return {
      notifications: result.rows.map(r => ({
        ...r,
        metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata,
      })),
      pagination: { current_page: page, total_pages: Math.ceil(totalCount / limit), total_count: totalCount },
    };
  }

  async markNotificationRead(notificationId: string, userId: string): Promise<void> {
    await this.db.query(
      'UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2',
      [notificationId, userId]
    );
  }

  // ==========================================================================
  // 2.  TRAINING CRUD
  // ==========================================================================

  async createTraining(data: CreateTrainingRequest, employerId: string): Promise<Training> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // -- verify user exists and is an employer --
      const userRow = await client.query('SELECT id, email, user_type FROM users WHERE id = $1', [employerId]);
      if (userRow.rows.length === 0) throw new Error(`User ${employerId} does not exist`);
      if (userRow.rows[0].user_type !== 'employer') throw new Error('Only employers can create trainings');

      // -- resolve employer-profile ID (FK target) --
      const epRow = await client.query('SELECT id FROM employers WHERE user_id = $1', [employerId]);
      if (epRow.rows.length === 0) throw new Error('Employer profile not found for this user');
      const employerProfileId = epRow.rows[0].id;

      // -- insert training --
      const tResult = await client.query(
        `INSERT INTO trainings (
           title, description, category, level, duration_hours, cost_type, price, mode,
           provider_id, provider_name, has_certificate, eligibility_requirements,
           application_deadline, thumbnail_url, location, start_date, end_date,
           max_participants, status, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'draft',NOW(),NOW())
         RETURNING *`,
        [
          data.title?.trim(), data.description?.trim(), data.category?.trim(), data.level,
          data.duration_hours, data.cost_type, data.price ?? 0, data.mode,
          employerProfileId, data.provider_name?.trim(), data.has_certificate ?? false,
          data.eligibility_requirements ?? null, data.application_deadline ?? null,
          data.thumbnail_url ?? null, data.location ?? null,
          data.start_date ?? null, data.end_date ?? null, data.max_participants ?? null,
        ]
      );
      const trainingId = tResult.rows[0].id;

      // -- insert sessions --
      if (data.sessions && data.sessions.length > 0) {
        for (let i = 0; i < data.sessions.length; i++) {
          const s = data.sessions[i];
          await client.query(
            `INSERT INTO training_sessions (training_id, title, description, scheduled_at, duration_minutes, meeting_url, order_index, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())`,
            [trainingId, s.title?.trim(), s.description?.trim() ?? null,
             s.scheduled_at, s.duration_minutes, s.meeting_url?.trim(), s.order_index ?? i + 1]
          );
        }
      }

      // -- insert outcomes --
      if (data.outcomes && data.outcomes.length > 0) {
        for (const o of data.outcomes) {
          await client.query(
            `INSERT INTO training_outcomes (training_id, outcome_text, order_index) VALUES ($1,$2,$3)`,
            [trainingId, o.outcome_text?.trim(), o.order_index]
          );
        }
      }

      await client.query('COMMIT');
      return (await this.getTrainingById(trainingId)) as Training;
    } catch (err: any) {
      await client.query('ROLLBACK');
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
      if (epRow.rows.length === 0) { await client.query('ROLLBACK'); return null; }
      const employerProfileId = epRow.rows[0].id;

      // ownership check
      const own = await client.query(
        'SELECT id, title, status FROM trainings WHERE id = $1 AND provider_id = $2',
        [id, employerProfileId]
      );
      if (own.rows.length === 0) { await client.query('ROLLBACK'); return null; }
      const oldTitle  = own.rows[0].title;
      const oldStatus = own.rows[0].status;

      // dynamic SET
      const sets: string[] = [];
      const vals: any[] = [];
      let pi = 1;
      const skip = ['sessions', 'outcomes'];
      for (const [key, value] of Object.entries(data)) {
        if (value === undefined || skip.includes(key)) continue;
        sets.push(`${key} = $${pi++}`);
        vals.push(value);
      }
      if (sets.length === 0) { await client.query('ROLLBACK'); return null; }
      sets.push('updated_at = CURRENT_TIMESTAMP');
      vals.push(id);

      await client.query(`UPDATE trainings SET ${sets.join(', ')} WHERE id = $${pi}`, vals);

      // replace sessions wholesale if provided
      if (data.sessions && Array.isArray(data.sessions)) {
        await client.query('DELETE FROM training_sessions WHERE training_id = $1', [id]);
        for (let i = 0; i < data.sessions.length; i++) {
          const s = data.sessions[i];
          await client.query(
            `INSERT INTO training_sessions (training_id, title, description, scheduled_at, duration_minutes, meeting_url, order_index, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())`,
            [id, s.title?.trim(), (s as any).description?.trim() ?? null,
             (s as any).scheduled_at, (s as any).duration_minutes, (s as any).meeting_url?.trim(), s.order_index ?? i + 1]
          );
        }
      }

      await client.query('COMMIT');

      // notify enrolled trainees if training was already published
      if (oldStatus === 'published' || oldStatus === 'in_progress') {
        this.notifyEnrolledTrainees(id, 'training_updated', `Training "${oldTitle}" has been updated`, { training_id: id });
      }

      return (await this.getTrainingById(id)) as Training;
    } catch (err: any) {
      await client.query('ROLLBACK');
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

  // ---------- Status transitions (publish / unpublish / suspend / close-applications / start / end) ----------
  async updateTrainingStatus(trainingId: string, employerId: string, newStatus: string): Promise<Training | null> {
    const epRow = await this.db.query('SELECT id FROM employers WHERE user_id = $1', [employerId]);
    if (epRow.rows.length === 0) return null;

    const result = await this.db.query(
      `UPDATE trainings SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND provider_id = $3 RETURNING *`,
      [newStatus, trainingId, epRow.rows[0].id]
    );
    if (result.rows.length === 0) return null;

    // If just published, notify all jobseekers
    if (newStatus === 'published') {
      const t = result.rows[0];
      this.notifyJobseekersAboutNewTraining(trainingId, t.title, t.category, t.provider_name);
    }
    // If suspended, notify enrolled trainees
    if (newStatus === 'suspended') {
      this.notifyEnrolledTrainees(trainingId, 'training_suspended', `Training "${result.rows[0].title}" has been suspended`);
    }

    return (await this.getTrainingById(trainingId)) as Training;
  }

  // ==========================================================================
  // 3.  TRAINING RETRIEVAL
  // ==========================================================================

  async getTrainingById(id: string): Promise<any | null> {
    const result = await this.db.query('SELECT * FROM trainings WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;

    const training = result.rows[0];

    // attach sessions
    const sessions = await this.db.query(
      'SELECT * FROM training_sessions WHERE training_id = $1 ORDER BY order_index',
      [id]
    );
    training.sessions = sessions.rows;

    // attach outcomes
    const outcomes = await this.db.query(
      'SELECT * FROM training_outcomes WHERE training_id = $1 ORDER BY order_index',
      [id]
    );
    training.outcomes = outcomes.rows;

    return training;
  }

  /** Full detail view for a specific user (adds my_application / my_enrollment flags) */
  async getTrainingByIdForUser(id: string, userId: string, userType: string): Promise<any | null> {
    const training = await this.getTrainingById(id);
    if (!training) return null;

    // jobseekers only see published (or trainings they already applied/enrolled in)
    if (userType === 'jobseeker') {
      const hasRelation = await this.db.query(
        `SELECT 1 FROM training_applications WHERE training_id = $1 AND user_id = $2
         UNION
         SELECT 1 FROM training_enrollments WHERE training_id = $1 AND user_id = $2`,
        [id, userId]
      );
      if (training.status !== 'published' && training.status !== 'applications_closed' && training.status !== 'in_progress' && training.status !== 'completed' && hasRelation.rows.length === 0) {
        return null;
      }

      // attach user's application
      const appRow = await this.db.query(
        'SELECT * FROM training_applications WHERE training_id = $1 AND user_id = $2 ORDER BY applied_at DESC LIMIT 1',
        [id, userId]
      );
      training.my_application = appRow.rows[0] || null;
      training.has_applied    = appRow.rows.length > 0;

      // attach user's enrollment
      const enrRow = await this.db.query(
        'SELECT * FROM training_enrollments WHERE training_id = $1 AND user_id = $2 ORDER BY enrolled_at DESC LIMIT 1',
        [id, userId]
      );
      training.my_enrollment = enrRow.rows[0] || null;
      training.is_enrolled   = enrRow.rows.length > 0;
    }

    // employers only see their own trainings
    if (userType === 'employer') {
      const epRow = await this.db.query('SELECT id FROM employers WHERE user_id = $1', [userId]);
      const epId = epRow.rows.length > 0 ? epRow.rows[0].id : null;
      if (training.provider_id !== userId && training.provider_id !== epId) return null;
    }

    return training;
  }

  /** Paginated listing for job-seekers (published trainings only) */
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

    // user context: LEFT JOIN on applications & enrollments
    const userIdx = pi++;
    qp.push(userId);
    const limitIdx = pi++;  qp.push(limit);
    const offIdx  = pi++;   qp.push(offset);

    const query = `
      SELECT
        t.*,
        CASE WHEN a.id IS NOT NULL THEN true ELSE false END AS has_applied,
        a.status AS application_status,
        a.applied_at,
        CASE WHEN e.id IS NOT NULL THEN true ELSE false END AS is_enrolled,
        e.status AS enrollment_status,
        e.enrolled_at,
        e.completed_at,
        e.certificate_issued,
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

  /** Employer's own trainings */
  async getAllTrainings(params: TrainingSearchParams, employerId?: string): Promise<TrainingListResponse> {
    const { page = 1, limit = 10, sort_by = 'created_at', sort_order = 'desc', filters = {} } = params;
    const offset = (page - 1) * limit;
    const conds: string[] = [];
    const qp: any[]       = [];
    let pi = 1;

    if (employerId) {
      const epRow = await this.db.query('SELECT id FROM employers WHERE user_id = $1', [employerId]);
      if (epRow.rows.length > 0) {
        conds.push(`(t.provider_id = $${pi++} OR t.provider_id = $${pi++})`);
        qp.push(employerId, epRow.rows[0].id);
      } else {
        conds.push(`t.provider_id = $${pi++}`);
        qp.push(employerId);
      }
    }
    if (filters.category) { conds.push(`t.category = $${pi++}`); qp.push(filters.category); }
    if (filters.search)   { conds.push(`(t.title ILIKE $${pi++} OR t.description ILIKE $${pi - 1})`); qp.push(`%${filters.search}%`); }

    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    qp.push(limit, offset);
    const result = await this.db.query(
      `SELECT t.*,
              (SELECT COUNT(*) FROM training_applications WHERE training_id = t.id) AS application_count,
              (SELECT COUNT(*) FROM training_enrollments  WHERE training_id = t.id) AS enrollment_count,
              COUNT(*) OVER() AS total_count
       FROM trainings t ${where}
       ORDER BY t.${sort_by} ${sort_order.toUpperCase()}
       LIMIT $${pi++} OFFSET $${pi++}`,
      qp
    );
    const rows  = result.rows;
    const total = rows.length > 0 ? parseInt(rows[0].total_count) : 0;

    return {
      trainings: rows.map(r => ({
        ...this.mapTrainingFromDb(r),
        has_applied: false,
        is_enrolled: false,
        application_count: parseInt(r.application_count || 0),
        enrollment_count:  parseInt(r.enrollment_count || 0),
      })),
      pagination: { current_page: page, total_pages: Math.ceil(total / limit), page_size: limit, total_count: total, has_next: page * limit < total, has_previous: page > 1 },
      filters_applied: filters,
    };
  }

  /** Trainings the job-seeker has enrolled in */
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
  // 4.  APPLICATION FLOW  (job-seeker submits → employer reviews)
  // ==========================================================================

  /** Job-seeker applies for a training */
  async submitApplication(trainingId: string, userId: string, body: SubmitApplicationRequest): Promise<any> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // training must exist and be in 'published' (open) state
      const tRow = await client.query(
        `SELECT id, title, status, application_deadline, provider_id, provider_name FROM trainings WHERE id = $1`,
        [trainingId]
      );
      if (tRow.rows.length === 0) throw new Error('Training not found');

      const training = tRow.rows[0];
      if (training.status !== 'published') {
        throw new Error('Training is not currently accepting applications');
      }
      if (training.application_deadline && new Date(training.application_deadline) < new Date()) {
        throw new Error('The application deadline has passed');
      }

      // duplicate check
      const dup = await client.query(
        `SELECT id, status FROM training_applications WHERE training_id = $1 AND user_id = $2`,
        [trainingId, userId]
      );
      if (dup.rows.length > 0) {
        return { success: false, message: 'You have already applied for this training', application: dup.rows[0] };
      }

      // fetch user name for notification
      const uRow = await client.query('SELECT first_name, last_name, email FROM users WHERE id = $1', [userId]);
      const userName = `${uRow.rows[0]?.first_name || ''} ${uRow.rows[0]?.last_name || ''}`.trim() || uRow.rows[0]?.email || 'Applicant';

      // insert application
      const appResult = await client.query(
        `INSERT INTO training_applications (training_id, user_id, motivation, status, applied_at, created_at, updated_at)
         VALUES ($1, $2, $3, 'pending', NOW(), NOW(), NOW()) RETURNING *`,
        [trainingId, userId, body.motivation?.trim() ?? null]
      );

      await client.query('COMMIT');
      const application = appResult.rows[0];

      // notify employer
      this.createNotification(
        training.provider_id, 'application_submitted',
        `${userName} has applied for "${training.title}"`,
        { training_id: trainingId, application_id: application.id, user_id: userId, applicant_name: userName }
      );
      // confirm to applicant
      this.createNotification(
        userId, 'application_submitted',
        `Your application for "${training.title}" has been submitted. You will be notified once reviewed.`,
        { training_id: trainingId, application_id: application.id }
      );

      return { success: true, message: 'Application submitted successfully', application };
    } catch (err: any) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /** Employer retrieves all applications for a training */
  async getApplications(trainingId: string, employerId: string, params: { page?: number; limit?: number; status?: string }): Promise<any> {
    // ownership check
    const epRow = await this.db.query('SELECT id FROM employers WHERE user_id = $1', [employerId]);
    const epId = epRow.rows.length > 0 ? epRow.rows[0].id : null;

    const own = await this.db.query(
      `SELECT id FROM trainings WHERE id = $1 AND (provider_id = $2 OR provider_id = $3)`,
      [trainingId, employerId, epId ?? '']
    );
    if (own.rows.length === 0) return null; // not found / unauthorized

    const { page = 1, limit = 20, status } = params;
    const offset = (page - 1) * limit;

    let where = 'WHERE a.training_id = $1';
    const qp: any[] = [trainingId];
    let pi = 2;
    if (status) { where += ` AND a.status = $${pi++}`; qp.push(status); }

    qp.push(limit, offset);
    const result = await this.db.query(
      `SELECT a.*,
              u.first_name, u.last_name, u.email, u.profile_image,
              COUNT(*) OVER() AS total_count
       FROM training_applications a
       JOIN users u ON a.user_id = u.id
       ${where}
       ORDER BY a.applied_at DESC
       LIMIT $${pi++} OFFSET $${pi++}`,
      qp
    );

    const rows  = result.rows;
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
        user: { id: r.user_id, first_name: r.first_name, last_name: r.last_name, email: r.email, profile_image: r.profile_image },
      })),
      pagination: { current_page: page, total_pages: Math.ceil(total / limit), page_size: limit, total_count: total, has_next: page * limit < total, has_previous: page > 1 },
    };
  }

  // ==========================================================================
  // 5.  SHORTLISTING & ENROLLMENT
  // ==========================================================================

  /** Employer shortlists or rejects an applicant.
   *  If shortlisted → an enrollment row is automatically created. */
  async shortlistApplicant(applicationId: string, employerId: string, body: ShortlistDecisionRequest): Promise<any> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // fetch application + training
      const appRow = await client.query(
        `SELECT a.*, t.title AS training_title, t.provider_id, t.max_participants
         FROM training_applications a
         JOIN trainings t ON a.training_id = t.id
         WHERE a.id = $1`,
        [applicationId]
      );
      if (appRow.rows.length === 0) throw new Error('Application not found');

      const app = appRow.rows[0];

      // employer ownership
      const epRow = await this.db.query('SELECT id FROM employers WHERE user_id = $1', [employerId]);
      const epId = epRow.rows.length > 0 ? epRow.rows[0].id : null;
      if (app.provider_id !== employerId && app.provider_id !== epId) {
        throw new Error('Unauthorized');
      }

      if (app.status !== 'pending') {
        throw new Error(`Application is already ${app.status}`);
      }

      // capacity guard for shortlisting
      if (body.decision === 'shortlisted' && app.max_participants) {
        const enrolled = await client.query(
          `SELECT COUNT(*) AS cnt FROM training_enrollments WHERE training_id = $1 AND status = 'enrolled'`,
          [app.training_id]
        );
        if (parseInt(enrolled.rows[0].cnt) >= app.max_participants) {
          throw new Error('Training is at full capacity');
        }
      }

      // update application
      await client.query(
        `UPDATE training_applications SET status = $1, employer_notes = $2, reviewed_at = NOW(), updated_at = NOW() WHERE id = $3`,
        [body.decision, body.employer_notes ?? null, applicationId]
      );

      let enrollment: any = null;

      if (body.decision === 'shortlisted') {
        // create enrollment
        const enrResult = await client.query(
          `INSERT INTO training_enrollments (training_id, user_id, application_id, status, enrolled_at, completion_marked, certificate_issued, created_at, updated_at)
           VALUES ($1, $2, $3, 'enrolled', NOW(), false, false, NOW(), NOW()) RETURNING *`,
          [app.training_id, app.user_id, applicationId]
        );
        enrollment = enrResult.rows[0];

        // bump participant count
        await client.query(
          `UPDATE trainings SET current_participants = COALESCE(current_participants, 0) + 1, total_students = COALESCE(total_students, 0) + 1 WHERE id = $1`,
          [app.training_id]
        );
      }

      await client.query('COMMIT');

      // --- notifications (fire-and-forget) ---
      const uRow = await this.db.query('SELECT first_name, last_name, email FROM users WHERE id = $1', [app.user_id]);
      const name = `${uRow.rows[0]?.first_name || ''} ${uRow.rows[0]?.last_name || ''}`.trim() || uRow.rows[0]?.email;

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
  // 6.  COMPLETION MARKING  (employer evaluates each trainee)
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

      // ownership
      const epRow = await this.db.query('SELECT id FROM employers WHERE user_id = $1', [employerId]);
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

      // notifications
      const uRow = await this.db.query('SELECT first_name, last_name, email FROM users WHERE id = $1', [enr.user_id]);
      const name = `${uRow.rows[0]?.first_name || ''} ${uRow.rows[0]?.last_name || ''}`.trim() || uRow.rows[0]?.email;

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

  // ==========================================================================
  // 7.  CERTIFICATE GENERATION & ISSUANCE
  // ==========================================================================

  /** Employer issues a certificate for a *completed* enrollment */
  async issueCertificate(enrollmentId: string, employerId: string): Promise<any> {
    // fetch enrollment
    const enrRow = await this.db.query(
      `SELECT e.*, t.title AS training_title, t.provider_id, t.has_certificate, t.duration_hours
       FROM training_enrollments e
       JOIN trainings t ON e.training_id = t.id
       WHERE e.id = $1`,
      [enrollmentId]
    );
    if (enrRow.rows.length === 0) throw new Error('Enrollment not found');

    const enr = enrRow.rows[0];

    // ownership
    const epRow = await this.db.query('SELECT id FROM employers WHERE user_id = $1', [employerId]);
    const epId = epRow.rows.length > 0 ? epRow.rows[0].id : null;
    if (enr.provider_id !== employerId && enr.provider_id !== epId) {
      throw new Error('Unauthorized: You can only issue certificates for your own trainings');
    }
    if (!enr.has_certificate) throw new Error('This training does not provide certificates');
    if (enr.status !== 'completed') throw new Error('Certificate can only be issued for completed enrollments');
    if (enr.certificate_issued) {
      return { success: true, message: 'Certificate already issued', certificate_url: enr.certificate_url, enrollment_id: enrollmentId };
    }

    // generate PDF
    const cert = await this.generateCertificatePDF(enrollmentId, enr.user_id, enr.training_id, enr.training_title, enr.duration_hours);

    // persist
    await this.db.query(
      `UPDATE training_enrollments SET certificate_issued = true, certificate_url = $1, certificate_issued_at = NOW() WHERE id = $2`,
      [cert.certificate_url, enrollmentId]
    );

    // store verification record
    await this.db.query(
      `INSERT INTO certificate_verifications (enrollment_id, verification_code, certificate_url, issued_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (enrollment_id) DO NOTHING`,
      [enrollmentId, cert.verification_code, cert.certificate_url]
    );

    // notifications
    const uRow = await this.db.query('SELECT first_name, last_name, email FROM users WHERE id = $1', [enr.user_id]);
    const name = `${uRow.rows[0]?.first_name || ''} ${uRow.rows[0]?.last_name || ''}`.trim() || uRow.rows[0]?.email;

    this.createNotification(enr.user_id, 'certificate_issued',
      `🎉 Your certificate for "${enr.training_title}" is ready! Click to download.`,
      { training_id: enr.training_id, enrollment_id: enrollmentId, certificate_url: cert.certificate_url }
    );
    this.createNotification(enr.provider_id, 'certificate_issued',
      `Certificate issued to ${name} for "${enr.training_title}".`,
      { training_id: enr.training_id, enrollment_id: enrollmentId, user_id: enr.user_id }
    );

    return { success: true, message: 'Certificate issued successfully', certificate_url: cert.certificate_url, verification_code: cert.verification_code, enrollment_id: enrollmentId };
  }

  /** Verify a certificate by its verification code */
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

  // ---------- PDF generation ----------
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

    // -- trainee name --
    const uRow = await this.db.query('SELECT first_name, last_name, email FROM users WHERE id = $1', [userId]);
    const u    = uRow.rows[0] || {};
    const trainee = `${u.first_name || ''} ${u.last_name || ''}`.trim() || (u.email || '').split('@')[0];

    // -- provider name (company > provider_name fallback) --
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

    // -- verification code --
    const verificationCode = generateVerificationCode();

    // -- file paths --
    const baseUpload    = path.join(__dirname, '../../uploads');
    const certDir       = path.join(baseUpload, 'certificates');
    if (!fs.existsSync(certDir)) fs.mkdirSync(certDir, { recursive: true });

    const fileName = `certificate-${enrollmentId}-${Date.now()}.pdf`;
    const filePath = path.join(certDir, fileName);

    // -- layout constants --
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape' });
    const W   = doc.page.width;
    const H   = doc.page.height;
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Outer border
    doc.rect(40, 40, W - 80, H - 80).stroke('#2c3e50');
    doc.rect(46, 46, W - 92, H - 92).stroke('#2c3e50');

    // Title
    doc.fontSize(36).font('Helvetica-Bold').fillColor('#2c3e50')
       .text('Certificate of Completion', 0, 70, { align: 'center', width: W });

    // Sub-header
    doc.fontSize(15).font('Helvetica').fillColor('#555555')
       .text('This is to certify that', 0, 140, { align: 'center', width: W });

    // Trainee name
    doc.fontSize(30).font('Helvetica-Bold').fillColor('#1a5276')
       .text(trainee, 0, 180, { align: 'center', width: W });

    // Body text
    doc.fontSize(15).font('Helvetica').fillColor('#555555')
       .text('has successfully completed the training programme', 0, 240, { align: 'center', width: W });

    // Training title
    doc.fontSize(24).font('Helvetica-Bold').fillColor('#2c3e50')
       .text(trainingTitle, 0, 278, { align: 'center', width: W });

    // Duration
    doc.fontSize(13).font('Helvetica').fillColor('#666666')
       .text(`Total Duration: ${durationHours} hours`, 0, 325, { align: 'center', width: W });

    // Completion date
    const completionDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    doc.fontSize(13).font('Helvetica').fillColor('#666666')
       .text(`Date of Completion: ${completionDate}`, 0, 348, { align: 'center', width: W });

    // Divider
    doc.moveTo(180, 390).lineTo(W - 180, 390).strokeColor('#aaaaaa').stroke();

    // Issued by
    doc.fontSize(12).font('Helvetica-Oblique').fillColor('#888888')
       .text('Issued by:', 0, 400, { align: 'center', width: W });
    doc.fontSize(18).font('Helvetica-Bold').fillColor('#2c3e50')
       .text(provider, 0, 422, { align: 'center', width: W });

    // Signature line
    doc.moveTo(W / 2 - 80, 465).lineTo(W / 2 + 80, 465).strokeColor('#888888').stroke();
    doc.fontSize(10).font('Helvetica-Oblique').fillColor('#888888')
       .text('Authorised Signature', 0, 468, { align: 'center', width: W });

    // Verification code at bottom
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
  // 8.  EMPLOYER STATS
  // ==========================================================================

  async getTrainingStats(employerId: string): Promise<TrainingStatsResponse> {
    const epRow = await this.db.query('SELECT id FROM employers WHERE user_id = $1', [employerId]);
    let cond = 'provider_id = $1';
    const qp: any[] = [employerId];
    if (epRow.rows.length > 0) {
      cond = '(provider_id = $1 OR provider_id = $2)';
      qp.push(epRow.rows[0].id);
    }

    const stats = await this.db.query(
      `SELECT
         COUNT(*)                                          AS total_trainings,
         COUNT(*) FILTER (WHERE status = 'published')     AS published_trainings,
         COUNT(*) FILTER (WHERE status = 'draft')         AS draft_trainings,
         COUNT(*) FILTER (WHERE status = 'suspended')     AS suspended_trainings,
         COALESCE(SUM(app_cnt.cnt), 0)                    AS total_applications,
         COALESCE(SUM(enr_cnt.cnt), 0)                    AS total_enrollments,
         COALESCE(SUM(comp_cnt.cnt), 0)                   AS total_completions,
         COALESCE(AVG(rating), 0)                         AS avg_rating
       FROM trainings t
       LEFT JOIN LATERAL (SELECT COUNT(*) AS cnt FROM training_applications  WHERE training_id = t.id) app_cnt  ON true
       LEFT JOIN LATERAL (SELECT COUNT(*) AS cnt FROM training_enrollments   WHERE training_id = t.id) enr_cnt  ON true
       LEFT JOIN LATERAL (SELECT COUNT(*) AS cnt FROM training_enrollments   WHERE training_id = t.id AND status = 'completed') comp_cnt ON true
       WHERE ${cond}`,
      qp
    );

    const s = stats.rows[0];
    const totalEnr = parseInt(s.total_enrollments || 0);
    const totalComp = parseInt(s.total_completions || 0);

    return {
      total_trainings:      parseInt(s.total_trainings),
      published_trainings:  parseInt(s.published_trainings),
      draft_trainings:      parseInt(s.draft_trainings),
      suspended_trainings:  parseInt(s.suspended_trainings),
      total_applications:   parseInt(s.total_applications),
      total_enrollments:    totalEnr,
      total_completions:    totalComp,
      total_revenue:        0, // extend when payments are added
      avg_rating:           parseFloat(s.avg_rating) || 0,
      completion_rate:      totalEnr > 0 ? Math.round((totalComp / totalEnr) * 10000) / 100 : 0,
      categories_breakdown: [],
      monthly_enrollments:  [],
    };
  }

  // ==========================================================================
  // 9.  JOBSEEKER STATS
  // ==========================================================================

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

  // ==========================================================================
  // 10. REVIEWS
  // ==========================================================================

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
    // must be enrolled
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

  // ==========================================================================
  // 11. ANALYTICS (employer per-training)
  // ==========================================================================

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

  // Employer: list enrollments for a training (for completion-marking UI)
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

    const result = await this.db.query(
      `SELECT e.*, u.first_name, u.last_name, u.email, u.profile_image, COUNT(*) OVER() AS total_count
       FROM training_enrollments e
       JOIN users u ON e.user_id = u.id
       ${where}
       ORDER BY e.enrolled_at DESC
       LIMIT $${pi++} OFFSET $${pi++}`,
      qp
    );
    const rows  = result.rows;
    const total = rows.length > 0 ? parseInt(rows[0].total_count) : 0;

    return {
      enrollments: rows.map(r => ({
        id: r.id, training_id: r.training_id, user_id: r.user_id,
        status: r.status, enrolled_at: r.enrolled_at, completed_at: r.completed_at,
        completion_marked: r.completion_marked, certificate_issued: r.certificate_issued,
        user: { id: r.user_id, first_name: r.first_name, last_name: r.last_name, email: r.email, profile_image: r.profile_image },
      })),
      pagination: { current_page: page, total_pages: Math.ceil(total / limit), page_size: limit, total_count: total, has_next: page * limit < total, has_previous: page > 1 },
    };
  }

  // ==========================================================================
  // 12. CATEGORIES / POPULAR / RECOMMENDED
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

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

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
      is_enrolled: row.is_enrolled === true || row.is_enrolled === 'true',
      application_status: row.application_status || null,
      enrollment_status:  row.enrollment_status  || null,
      applied_at:  row.applied_at  || null,
      enrolled_at: row.enrolled_at || null,
      completed_at: row.completed_at || null,
      certificate_issued: Boolean(row.certificate_issued),
    };
  }
}