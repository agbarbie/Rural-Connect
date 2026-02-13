import express from 'express';
import meetingController from '../controllers/meeting.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';

const router = express.Router();

/**
 * @route POST /api/meetings/create
 * @desc Create a new meeting for training (Employer only)
 * @access Private (Employer)
 */
router.post(
  '/create',
  authenticate,
  requireRole('employer'),
  meetingController.createMeeting
);

/**
 * @route GET /api/meetings/:meetingId/join
 * @desc Join an existing meeting (Both Employer & Jobseeker)
 * @access Private
 */
router.get(
  '/:meetingId/join',
  authenticate,
  meetingController.joinMeeting
);

/**
 * @route GET /api/meetings/:meetingId
 * @desc Get meeting details
 * @access Private
 */
router.get(
  '/:meetingId',
  authenticate,
  meetingController.getMeetingDetails
);

/**
 * @route POST /api/meetings/:meetingId/end
 * @desc End a meeting (Employer only)
 * @access Private (Employer)
 */
router.post(
  '/:meetingId/end',
  authenticate,
  requireRole('employer'),
  meetingController.endMeeting
);
/**
 * @route GET /api/meetings/employer/active
 * @desc Get all active meetings for employer
 * @access Private (Employer only)
 */
router.get(
  '/employer/active',
  authenticate,
  requireRole('employer'),
  meetingController.getActiveMeetings
);

/**
 * @route GET /api/meetings/jobseeker/upcoming
 * @desc Get all upcoming meetings for jobseeker
 * @access Private (Jobseeker only)
 */
router.get(
  '/jobseeker/upcoming',
  authenticate,
  requireRole('jobseeker'),
  meetingController.getUpcomingMeetings
);

export default router;