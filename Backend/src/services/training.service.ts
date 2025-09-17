// services/training.service.ts
import { Pool } from 'pg';
import { 
  Training, 
  CreateTrainingRequest, 
  UpdateTrainingRequest,
  TrainingSearchParams,
  TrainingListResponse,
  TrainingStatsResponse
} from '../types/training.type';

export class TrainingService {
  constructor(private db: Pool) {}

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
      trainings: trainings.map(this.mapTrainingFromDb),
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

  async getTrainingById(id: string): Promise<Training | null> {
    const query = 'SELECT * FROM trainings WHERE id = $1';
    const result = await this.db.query(query, [id]);
    
    if (result.rows.length === 0) return null;
    
    const training = this.mapTrainingFromDb(result.rows[0]);
    
    // Get videos and outcomes
    training.videos = await this.getTrainingVideos(id);
    training.outcomes = await this.getTrainingOutcomes(id);
    
    return training;
  }

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

      // Insert videos
      if (data.videos?.length > 0) {
        for (const video of data.videos) {
          await client.query(`
            INSERT INTO training_videos (training_id, title, description, duration_minutes, order_index, is_preview)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [trainingId, video.title, video.description, video.duration_minutes, video.order_index, video.is_preview]);
        }
      }

      // Insert outcomes
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