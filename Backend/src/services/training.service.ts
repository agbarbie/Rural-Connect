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

export class TrainingService {
  constructor(private db: Pool) {}

  async getTrainingById(id: string): Promise<any | null> {
    const result = await this.db.query(
      'SELECT * FROM trainings WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }
  
  // Add these methods to your TrainingService class

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
  let queryParams = [trainingId];
  let paramIndex = 2;

  if (status) {
    whereConditions.push(`e.status = $${paramIndex++}`);
    queryParams.push(status);
  }

  const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

  const query = `
    SELECT 
      e.*,
      u.first_name,
      u.last_name,
      u.email,
      u.profile_image,
      COUNT(*) OVER() as total_count
    FROM training_enrollments e
    JOIN users u ON e.user_id = u.id
    ${whereClause}
    ORDER BY e.enrolled_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}
  `;

  queryParams.push(String(limit), String(offset));

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
        first_name: row.first_name,
        last_name: row.last_name,
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

async getTrainingAnalytics(trainingId: string, employerId: string, timeRange: string): Promise<any | null> {
  // First verify the training belongs to this employer
  const trainingCheck = await this.db.query(
    'SELECT * FROM trainings WHERE id = $1 AND provider_id = $2',
    [trainingId, employerId]
  );

  if (trainingCheck.rows.length === 0) return null;

  const training = trainingCheck.rows[0];

  // Calculate date range
  let dateFilter = '';
  const params = [trainingId];
  
  if (timeRange === '7days') {
    dateFilter = 'AND e.enrolled_at >= CURRENT_DATE - INTERVAL \'7 days\'';
  } else if (timeRange === '30days') {
    dateFilter = 'AND e.enrolled_at >= CURRENT_DATE - INTERVAL \'30 days\'';
  } else if (timeRange === '90days') {
    dateFilter = 'AND e.enrolled_at >= CURRENT_DATE - INTERVAL \'90 days\'';
  }

  // Get enrollment analytics
  const enrollmentQuery = `
    SELECT 
      COUNT(*) as total_enrollments,
      COUNT(*) FILTER (WHERE status = 'completed') as completed_enrollments,
      COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_enrollments,
      COUNT(*) FILTER (WHERE status = 'dropped') as dropped_enrollments,
      AVG(progress_percentage) as avg_progress,
      COUNT(*) FILTER (WHERE certificate_issued = true) as certificates_issued
    FROM training_enrollments e
    WHERE e.training_id = $1 ${dateFilter}
  `;

  const enrollmentResult = await this.db.query(enrollmentQuery, params);
  const enrollmentStats = enrollmentResult.rows[0];

  // Get daily enrollment trend
  const trendQuery = `
    SELECT 
      DATE(enrolled_at) as date,
      COUNT(*) as enrollments,
      COUNT(*) FILTER (WHERE status = 'completed') as completions
    FROM training_enrollments
    WHERE training_id = $1 ${dateFilter}
    GROUP BY DATE(enrolled_at)
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

    if (employerId) {
      whereConditions.push(`t.provider_id = $${paramIndex++}`);
      queryParams.push(employerId);
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

    const query = `
      SELECT 
        t.*,
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
        enrollment_status: undefined
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


// Fix for getTrainingCategories method in TrainingService
// (Removed duplicate implementation)

  async createTraining(data: CreateTrainingRequest, employerId: string): Promise<Training> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      const trainingQuery = `
        INSERT INTO trainings (
          title, description, category, level, duration_hours, cost_type, price,
          mode, provider_id, provider_name, has_certificate, thumbnail_url,
          location, start_date, end_date, max_participants
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
        ) RETURNING *
      `;

      const trainingResult = await client.query(trainingQuery, [
        data.title, data.description, data.category, data.level,
        data.duration_hours, data.cost_type, data.price || 0,
        data.mode, employerId, data.provider_name, data.has_certificate,
        data.thumbnail_url, data.location, data.start_date, data.end_date,
        data.max_participants
      ]);

      const trainingId = trainingResult.rows[0].id;

      if (data.videos?.length > 0) {
        for (const video of data.videos) {
          await client.query(`
            INSERT INTO training_videos (training_id, title, description, duration_minutes, order_index, is_preview)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [trainingId, video.title, video.description, video.duration_minutes, video.order_index, video.is_preview]);
        }
      }

      if (data.outcomes?.length > 0) {
        for (const outcome of data.outcomes) {
          await client.query(`
            INSERT INTO training_outcomes (training_id, outcome_text, order_index)
            VALUES ($1, $2, $3)
          `, [trainingId, outcome.outcome_text, outcome.order_index]);
        }
      }

      await client.query('COMMIT');
      return await this.getTrainingById(trainingId) as Training;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async updateTraining(id: string, data: UpdateTrainingRequest, employerId: string): Promise<Training | null> {
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && !['videos', 'outcomes'].includes(key)) {
        updateFields.push(`${key} = $${paramIndex++}`);
        updateValues.push(value);
      }
    });

    if (updateFields.length === 0) return null;

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(id, employerId);

    const query = `
      UPDATE trainings 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex++} AND provider_id = $${paramIndex++}
      RETURNING *
    `;

    const result = await this.db.query(query, updateValues);
    return result.rows.length > 0 ? this.mapTrainingFromDb(result.rows[0]) : null;
  }

  async deleteTraining(id: string, employerId: string): Promise<boolean> {
    const result = await this.db.query(
      'DELETE FROM trainings WHERE id = $1 AND provider_id = $2',
      [id, employerId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async getTrainingStats(employerId: string): Promise<TrainingStatsResponse> {
    const query = `
      SELECT 
        COUNT(*) as total_trainings,
        COUNT(*) FILTER (WHERE status = 'published') as published_trainings,
        COUNT(*) FILTER (WHERE status = 'draft') as draft_trainings,
        COALESCE(AVG(rating), 0) as avg_rating
      FROM trainings 
      WHERE provider_id = $1
    `;

    const result = await this.db.query(query, [employerId]);
    const stats = result.rows[0];

    return {
      total_trainings: parseInt(stats.total_trainings),
      published_trainings: parseInt(stats.published_trainings),
      draft_trainings: parseInt(stats.draft_trainings),
      suspended_trainings: 0,
      total_enrollments: 0,
      total_revenue: 0,
      avg_rating: parseFloat(stats.avg_rating),
      completion_rate: 0,
      categories_breakdown: [],
      monthly_enrollments: []
    };
  }

  async getJobseekerTrainings(params: TrainingSearchParams, userId?: string): Promise<TrainingListResponse> {
    const {
      page = 1,
      limit = 10,
      sort_by = 'created_at',
      sort_order = 'desc',
      filters = {}
    } = params;

    const offset = (page - 1) * limit;
    let whereConditions: string[] = ['t.status = \'published\''];
    let queryParams: any[] = [];
    let paramIndex = 1;

    if (filters.category) {
      whereConditions.push(`t.category = $${paramIndex++}`);
      queryParams.push(filters.category);
    }

    if (filters.level && filters.level.length > 0) {
      whereConditions.push(`t.level = ANY($${paramIndex++})`);
      queryParams.push(filters.level);
    }

    if (filters.cost_type && filters.cost_type.length > 0) {
      whereConditions.push(`t.cost_type = ANY($${paramIndex++})`);
      queryParams.push(filters.cost_type);
    }

    if (filters.mode && filters.mode.length > 0) {
      whereConditions.push(`t.mode = ANY($${paramIndex++})`);
      queryParams.push(filters.mode);
    }

    if (filters.has_certificate !== undefined) {
      whereConditions.push(`t.has_certificate = $${paramIndex++}`);
      queryParams.push(filters.has_certificate);
    }

    if (filters.search) {
      whereConditions.push(`(t.title ILIKE $${paramIndex++} OR t.description ILIKE $${paramIndex++} OR t.category ILIKE $${paramIndex++})`);
      const searchTerm = `%${filters.search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    const query = `
      SELECT 
        t.*,
        ${userId ? `e.id IS NOT NULL as enrolled,
        e.progress_percentage as progress,
        e.status as enrollment_status,` : 'false as enrolled, 0 as progress, null as enrollment_status,'}
        COUNT(*) OVER() as total_count
      FROM trainings t
      ${userId ? `LEFT JOIN training_enrollments e ON t.id = e.training_id AND e.user_id = $${paramIndex++}` : ''}
      ${whereClause}
      ORDER BY t.${sort_by} ${sort_order.toUpperCase()}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    if (userId) {
      queryParams.push(userId);
    }
    queryParams.push(limit, offset);

    const result = await this.db.query(query, queryParams);
    const trainings = result.rows;
    const totalCount = trainings.length > 0 ? parseInt(trainings[0].total_count) : 0;

    return {
      trainings: trainings.map(row => ({
        ...this.mapTrainingFromDb(row),
        enrolled: row.enrolled,
        progress: row.progress || 0,
        enrollment_status: row.enrollment_status
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
        true as enrolled,
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
        completed_at: row.completed_at
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

  async enrollUserInTraining(trainingId: string, userId: string): Promise<TrainingEnrollment | null> {
    const trainingCheck = await this.db.query(
      'SELECT id, max_participants, current_participants FROM trainings WHERE id = $1 AND status = $2',
      [trainingId, 'published']
    );

    if (trainingCheck.rows.length === 0) return null;

    const training = trainingCheck.rows[0];

    const enrollmentCheck = await this.db.query(
      'SELECT id FROM training_enrollments WHERE training_id = $1 AND user_id = $2',
      [trainingId, userId]
    );

    if (enrollmentCheck.rows.length > 0) return null;

    if (training.max_participants && training.current_participants >= training.max_participants) {
      return null;
    }

    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      const enrollmentResult = await client.query(`
        INSERT INTO training_enrollments (training_id, user_id, status)
        VALUES ($1, $2, 'enrolled')
        RETURNING *
      `, [trainingId, userId]);

      await client.query(`
        UPDATE trainings 
        SET current_participants = current_participants + 1
        WHERE id = $1
      `, [trainingId]);

      await client.query('COMMIT');
      return enrollmentResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
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
        t.duration_hours,
        json_agg(
          json_build_object(
            'video_id', tv.id,
            'video_title', tv.title,
            'video_duration', tv.duration_minutes,
            'order_index', tv.order_index,
            'completed', COALESCE(tvp.is_completed, false),
            'watch_time', COALESCE(tvp.watch_time_minutes, 0),
            'completed_at', tvp.completed_at
          ) ORDER BY tv.order_index
        ) as video_progress
      FROM training_enrollments e
      JOIN trainings t ON e.training_id = t.id
      LEFT JOIN training_videos tv ON t.id = tv.training_id
      LEFT JOIN training_video_progress tvp ON tv.id = tvp.video_id AND tvp.enrollment_id = e.id
      WHERE e.training_id = $1 AND e.user_id = $2
      GROUP BY e.id, t.title, t.duration_hours
    `;

    const result = await this.db.query(query, [trainingId, userId]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

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

  async getJobseekerTrainingStats(userId: string): Promise<any> {
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