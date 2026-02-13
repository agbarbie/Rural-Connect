import { Response } from 'express';
import pool from '../db/db.config';
import cloudflareService from '../services/cloudflareRealtime.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

class MeetingController {
  /**
   * CREATE MEETING
   * @route POST /api/meetings/create
   * @desc Create a new meeting when employer creates training
   * @access Private (Employer only)
   */
  async createMeeting(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { trainingId, title } = req.body;
      
      // Get employer details from authenticated user
      const employerId = req.user!.id;
      const employerName = req.user!.first_name && req.user!.last_name 
        ? `${req.user!.first_name} ${req.user!.last_name}`
        : req.user!.email || 'Employer';

      // Validate required fields
      if (!trainingId || !title) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: trainingId and title are required'
        });
        return;
      }

      console.log('📹 Creating Cloudflare meeting:', { trainingId, title, employerId });

      // 1. Create meeting in Cloudflare
      const meeting = await cloudflareService.createMeeting(title);
      
      // 2. Add employer as host to get auth token
      const participant = await cloudflareService.addParticipant(
        meeting.data.id,
        employerName,
        employerId,
        'employer'
      );

      // 3. Update training with meeting ID in PostgreSQL
      const updateQuery = `
        UPDATE trainings 
        SET meeting_id = $1, 
            meeting_title = $2, 
            meeting_created_at = NOW(),
            status = 'scheduled',
            updated_at = NOW()
        WHERE id = $3 AND employer_id = $4
        RETURNING id, title, description, meeting_id, meeting_title, status, created_at
      `;
      
      const result = await pool.query(updateQuery, [
        meeting.data.id,
        meeting.data.title,
        trainingId,
        employerId
      ]);

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Training not found or you do not have permission to update it'
        });
        return;
      }

      const training = result.rows[0];

      console.log('✅ Meeting created successfully:', {
        meetingId: meeting.data.id,
        trainingId: training.id
      });

      // 4. Return response with meeting details and employer token
      res.status(201).json({
        success: true,
        meetingId: meeting.data.id,
        meetingTitle: meeting.data.title,
        roomName: meeting.data.room_name,
        authToken: participant.data.token, // Employer's token to start meeting
        createdAt: meeting.data.created_at,
        training: {
          id: training.id,
          title: training.title,
          description: training.description,
          status: training.status
        }
      });

    } catch (error: any) {
      console.error('❌ Create meeting error:', error);
      
      // Check if training exists but meeting creation failed
      if (error.response?.status === 401) {
        res.status(500).json({
          success: false,
          error: 'Cloudflare API authentication failed. Please check your credentials.',
          details: error.message
        });
      } else if (error.response?.status === 429) {
        res.status(429).json({
          success: false,
          error: 'Rate limit exceeded. Please try again later.',
          details: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to create meeting',
          details: error.message
        });
      }
    }
  }

  /**
   * JOIN MEETING
   * @route GET /api/meetings/:meetingId/join
   * @desc Join an existing meeting (both employer and jobseeker)
   * @access Private
   */
  async joinMeeting(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { meetingId } = req.params;
      
      // Get user details from authenticated user
      const userId = req.user!.id;
      const userName = req.user!.first_name && req.user!.last_name
        ? `${req.user!.first_name} ${req.user!.last_name}`
        : req.user!.email || 'User';
      const userRole = req.user!.user_type; // 'employer' or 'jobseeker'

      if (!meetingId) {
        res.status(400).json({
          success: false,
          error: 'Meeting ID is required'
        });
        return;
      }

      console.log('📹 Joining meeting:', { meetingId, userId, userRole });

      // Check if training exists with this meeting ID
      const trainingQuery = `
        SELECT t.*, 
               u.id as employer_id,
               u.name as employer_name, 
               u.email as employer_email,
               u.first_name as employer_first_name,
               u.last_name as employer_last_name
        FROM trainings t 
        LEFT JOIN users u ON t.employer_id = u.id 
        WHERE t.meeting_id = $1
      `;
      
      const trainingResult = await pool.query(trainingQuery, [meetingId]);

      if (trainingResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Training not found for this meeting'
        });
        return;
      }

      const training = trainingResult.rows[0];

      // Check if training is active/scheduled
      if (training.status === 'completed' || training.status === 'cancelled') {
        res.status(400).json({
          success: false,
          error: `This training is already ${training.status}`,
          status: training.status
        });
        return;
      }

      // For jobseekers, check if they are enrolled
      if (userRole === 'jobseeker') {
        const enrollmentQuery = `
          SELECT * FROM training_enrollments 
          WHERE training_id = $1 AND jobseeker_id = $2 AND status = 'enrolled'
        `;
        const enrollmentResult = await pool.query(enrollmentQuery, [training.id, userId]);
        
        if (enrollmentResult.rows.length === 0) {
          res.status(403).json({
            success: false,
            error: 'You are not enrolled in this training',
            details: 'Only enrolled jobseekers can join the meeting'
          });
          return;
        }
      }

      // Add participant to Cloudflare meeting and get token
      // Map application role to Cloudflare role (Cloudflare expects 'employer' | 'jobseeker')
      const roleForCloudflare: 'employer' | 'jobseeker' = userRole === 'employer' ? 'employer' : 'jobseeker';
      const participant = await cloudflareService.addParticipant(
      // @ts-ignore
        meetingId,
        userName,
        userId,
        roleForCloudflare
      );

      // Log attendance for jobseekers
      if (userRole === 'jobseeker') {
        try {
          await pool.query(
            `INSERT INTO training_attendance (training_id, jobseeker_id, meeting_id, joined_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (training_id, jobseeker_id, meeting_id) 
             DO UPDATE SET joined_at = NOW(), left_at = NULL`,
            [training.id, userId, meetingId]
          );
        } catch (attendanceError) {
          console.error('Failed to log attendance:', attendanceError);
          // Don't block the meeting join if attendance logging fails
        }
      }

      console.log('✅ Successfully joined meeting:', {
        meetingId,
        userId,
        role: userRole === 'employer' ? 'host' : 'participant'
      });

      res.json({
        success: true,
        meetingId: meetingId,
        authToken: participant.data.token,
        participantId: participant.data.id,
        role: userRole === 'employer' ? 'host' : 'participant',
        training: {
          id: training.id,
          title: training.title,
          description: training.description,
          employerId: training.employer_id,
          employerName: training.employer_name || training.employer_email,
          status: training.status,
          meetingTitle: training.meeting_title
        }
      });

    } catch (error: any) {
      console.error('❌ Join meeting error:', error);
      
      if (error.response?.status === 404) {
        res.status(404).json({
          success: false,
          error: 'Meeting not found in Cloudflare',
          details: 'The meeting may have expired or been deleted'
        });
      } else if (error.response?.status === 401) {
        res.status(500).json({
          success: false,
          error: 'Cloudflare API authentication failed',
          details: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to join meeting',
          details: error.message
        });
      }
    }
  }

  /**
   * GET MEETING DETAILS
   * @route GET /api/meetings/:meetingId
   * @desc Get meeting and training details
   * @access Private
   */
  async getMeetingDetails(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { meetingId } = req.params;
      const userId = req.user!.id;
      const userRole = req.user!.user_type;

      if (!meetingId) {
        res.status(400).json({
          success: false,
          error: 'Meeting ID is required'
        });
        return;
      }

      console.log('📹 Fetching meeting details:', { meetingId, userId, userRole });

      // Get meeting details from Cloudflare
      let meetingData = null;
      try {
      // @ts-ignore
        const meeting = await cloudflareService.getMeeting(meetingId);
        meetingData = meeting.data;
      } catch (cloudflareError) {
        console.warn('Could not fetch meeting from Cloudflare:', cloudflareError);
        // Continue with local data even if Cloudflare fails
      }

      // Get training details from database
      const trainingQuery = `
        SELECT t.*, 
               u.id as employer_id,
               u.name as employer_name,
               u.email as employer_email,
               u.first_name as employer_first_name,
               u.last_name as employer_last_name,
               (SELECT COUNT(*) FROM training_enrollments WHERE training_id = t.id AND status = 'enrolled') as enrolled_count,
               (SELECT COUNT(*) FROM training_applications WHERE training_id = t.id) as applications_count
        FROM trainings t 
        LEFT JOIN users u ON t.employer_id = u.id 
        WHERE t.meeting_id = $1
      `;
      
      const trainingResult = await pool.query(trainingQuery, [meetingId]);

      if (trainingResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Training not found for this meeting'
        });
        return;
      }

      const training = trainingResult.rows[0];

      // Check if user has access to this meeting
      let hasAccess = false;
      let accessRole = null;

      if (userRole === 'admin') {
        hasAccess = true;
        accessRole = 'admin';
      } else if (userRole === 'employer' && training.employer_id == userId) {
        hasAccess = true;
        accessRole = 'host';
      } else if (userRole === 'jobseeker') {
        const enrollmentCheck = await pool.query(
          'SELECT status FROM training_enrollments WHERE training_id = $1 AND jobseeker_id = $2',
          [training.id, userId]
        );
        if (enrollmentCheck.rows.length > 0) {
          hasAccess = true;
          accessRole = 'participant';
        }
      }

      res.json({
        success: true,
        meeting: meetingData,
        training: {
          id: training.id,
          title: training.title,
          description: training.description,
          status: training.status,
          createdAt: training.created_at,
          meetingTitle: training.meeting_title,
          meetingCreatedAt: training.meeting_created_at,
          employer: {
            id: training.employer_id,
            name: training.employer_name || `${training.employer_first_name || ''} ${training.employer_last_name || ''}`.trim() || training.employer_email,
            email: training.employer_email
          },
          stats: {
            enrolledCount: parseInt(training.enrolled_count) || 0,
            applicationsCount: parseInt(training.applications_count) || 0
          }
        },
        access: {
          hasAccess,
          role: accessRole
        }
      });

    } catch (error: any) {
      console.error('❌ Get meeting details error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get meeting details',
        details: error.message
      });
    }
  }

  /**
   * END MEETING
   * @route POST /api/meetings/:meetingId/end
   * @desc End a meeting and update training status
   * @access Private (Employer only)
   */
  async endMeeting(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { meetingId } = req.params;
      const employerId = req.user!.id;

      if (!meetingId) {
        res.status(400).json({
          success: false,
          error: 'Meeting ID is required'
        });
        return;
      }

      console.log('📹 Ending meeting:', { meetingId, employerId });

      // Update training status to completed
      const updateQuery = `
        UPDATE trainings 
        SET status = 'completed', 
            ended_at = NOW(),
            updated_at = NOW()
        WHERE meeting_id = $1 AND employer_id = $2
        RETURNING id, title, status, ended_at
      `;
      
      const result = await pool.query(updateQuery, [meetingId, employerId]);

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Training not found or you do not have permission to end it'
        });
        return;
      }

      const training = result.rows[0];

      // Update attendance records - mark when jobseekers left
      try {
        await pool.query(
          `UPDATE training_attendance 
           SET left_at = NOW() 
           WHERE training_id = $1 AND left_at IS NULL`,
          [training.id]
        );
      } catch (attendanceError) {
        console.error('Failed to update attendance:', attendanceError);
      }

      console.log('✅ Meeting ended successfully:', {
        meetingId,
        trainingId: training.id,
        status: training.status
      });

      res.json({
        success: true,
        message: 'Meeting ended successfully',
        training: {
          id: training.id,
          title: training.title,
          status: training.status,
          endedAt: training.ended_at
        }
      });

    } catch (error: any) {
      console.error('❌ End meeting error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to end meeting',
        details: error.message
      });
    }
  }

  /**
   * GET ACTIVE MEETINGS FOR EMPLOYER
   * @route GET /api/meetings/employer/active
   * @desc Get all active meetings for an employer
   * @access Private (Employer only)
   */
  async getActiveMeetings(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const employerId = req.user!.id;

      const query = `
        SELECT id, title, meeting_id, meeting_title, meeting_created_at, status, created_at
        FROM trainings 
        WHERE employer_id = $1 
          AND meeting_id IS NOT NULL 
          AND status IN ('scheduled', 'live')
        ORDER BY meeting_created_at DESC
      `;
      
      const result = await pool.query(query, [employerId]);

      res.json({
        success: true,
        count: result.rows.length,
        meetings: result.rows
      });

    } catch (error: any) {
      console.error('❌ Get active meetings error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get active meetings',
        details: error.message
      });
    }
  }

  /**
   * GET UPCOMING MEETINGS FOR JOBSEEKER
   * @route GET /api/meetings/jobseeker/upcoming
   * @desc Get all upcoming meetings for a jobseeker
   * @access Private (Jobseeker only)
   */
  async getUpcomingMeetings(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const jobseekerId = req.user!.id;

      const query = `
        SELECT t.id, t.title, t.meeting_id, t.meeting_title, t.meeting_created_at, t.status,
               u.name as employer_name, u.email as employer_email,
               te.enrolled_at
        FROM trainings t
        INNER JOIN training_enrollments te ON t.id = te.training_id
        LEFT JOIN users u ON t.employer_id = u.id
        WHERE te.jobseeker_id = $1 
          AND t.meeting_id IS NOT NULL 
          AND t.status = 'scheduled'
        ORDER BY t.meeting_created_at DESC
      `;
      
      const result = await pool.query(query, [jobseekerId]);

      res.json({
        success: true,
        count: result.rows.length,
        meetings: result.rows
      });

    } catch (error: any) {
      console.error('❌ Get upcoming meetings error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get upcoming meetings',
        details: error.message
      });
    }
  }
}

export default new MeetingController();
