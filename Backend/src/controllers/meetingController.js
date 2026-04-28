const cloudflareService = require('../services/cloudflareRealtime.service');
const prisma = require('../config/prisma'); // or your DB connection

class MeetingController {
  // Create meeting when training is created
  async createMeeting(req, res) {
    try {
      const { trainingId, title } = req.body;
      const employerId = req.user.id; // from auth middleware
      const employerName = req.user.name || req.user.email;

      // 1. Create meeting in Cloudflare
      const meeting = await cloudflareService.createMeeting(title);
      
      // 2. Add employer as host
      const participant = await cloudflareService.addParticipant(
        meeting.data.id,
        employerName,
        employerId,
        'employer'
      );

      // 3. Save meeting to your database
      const training = await prisma.training.update({
        where: { id: parseInt(trainingId) },
        data: {
          meetingId: meeting.data.id,
          meetingTitle: meeting.data.title,
          meetingCreatedAt: new Date()
        }
      });

      // 4. Return response
      res.json({
        success: true,
        meetingId: meeting.data.id,
        meetingTitle: meeting.data.title,
        roomName: meeting.data.room_name,
        authToken: participant.data.token,
        createdAt: meeting.data.created_at
      });

    } catch (error) {
      console.error('Create meeting error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create meeting'
      });
    }
  }

  // Join meeting (employer or jobseeker)
  async joinMeeting(req, res) {
    try {
      const { meetingId } = req.params;
      const userId = req.user.id;
      const userName = req.user.name || req.user.email;
      const userRole = req.user.role; // 'employer' or 'jobseeker'

      // Check if training exists
      const training = await prisma.training.findFirst({
        where: { meetingId: meetingId }
      });

      if (!training) {
        return res.status(404).json({
          success: false,
          error: 'Training not found'
        });
      }

      // Add participant and get token
      const participant = await cloudflareService.addParticipant(
        meetingId,
        userName,
        userId,
        userRole
      );

      res.json({
        success: true,
        meetingId: meetingId,
        authToken: participant.data.token,
        participantId: participant.data.id,
        role: userRole === 'employer' ? 'host' : 'participant',
        training: {
          id: training.id,
          title: training.title,
          description: training.description
        }
      });

    } catch (error) {
      console.error('Join meeting error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to join meeting'
      });
    }
  }

  // Get meeting details
  async getMeetingDetails(req, res) {
    try {
      const { meetingId } = req.params;
      
      const meeting = await cloudflareService.getMeeting(meetingId);
      const training = await prisma.training.findFirst({
        where: { meetingId: meetingId }
      });

      res.json({
        success: true,
        meeting: meeting.data,
        training: training
      });

    } catch (error) {
      console.error('Get meeting error:', error);
      res.status(404).json({
        success: false,
        error: 'Meeting not found'
      });
    }
  }

  // End meeting (employer only)
  async endMeeting(req, res) {
    try {
      const { meetingId } = req.params;
      
      // Update training status
      await prisma.training.update({
        where: { meetingId: meetingId },
        data: {
          status: 'completed',
          endedAt: new Date()
        }
      });

      res.json({
        success: true,
        message: 'Meeting ended successfully'
      });

    } catch (error) {
      console.error('End meeting error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to end meeting'
      });
    }
  }
}

module.exports = new MeetingController();