// src/routes/gemini.routes.ts
import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import geminiService from '../services/gemini.service';

const router = Router();

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

/**
 * @route   GET /api/gemini/recommendations
 * @desc    Get initial career recommendations
 * @access  Private
 */
router.get('/recommendations', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const userId = req.user.id;
    const recommendations = await geminiService.getCareerRecommendations(userId);

    return res.json(recommendations);
  } catch (error) {
    console.error('Error getting recommendations:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get career recommendations',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route   POST /api/gemini/chat
 * @desc    Send a chat message to Gemini AI
 * @access  Private
 */
router.post('/chat', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const { message, conversationHistory } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Invalid message format'
      });
    }

    const userId = req.user.id;
    
    // Convert conversation history to format expected by Gemini service
    const history = Array.isArray(conversationHistory) ? conversationHistory : [];

    const response = await geminiService.chat(userId, message, history);

    return res.json(response);
  } catch (error) {
    console.error('Error in chat:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process chat message',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route   GET /api/gemini/jobs
 * @desc    Get job recommendations with optional filters
 * @access  Private
 */
router.get('/jobs', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const userId = req.user.id;
    const { skillFocus, location, jobType } = req.query;

    // Build a query message based on filters
    let queryMessage = 'Show me relevant job opportunities';
    
    if (skillFocus) {
      queryMessage += ` focusing on ${skillFocus}`;
    }
    if (location) {
      queryMessage += ` in ${location}`;
    }
    if (jobType) {
      queryMessage += ` for ${jobType} positions`;
    }

    const response = await geminiService.chat(userId, queryMessage, []);

    return res.json(response);
  } catch (error) {
    console.error('Error getting job recommendations:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get job recommendations',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route   GET /api/gemini/skill-gaps
 * @desc    Get skill gap analysis
 * @access  Private
 */
router.get('/skill-gaps', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const userId = req.user.id;
    
    const response = await geminiService.chat(
      userId,
      'Analyze my skill gaps and provide detailed learning recommendations to improve my career prospects',
      []
    );

    return res.json(response);
  } catch (error) {
    console.error('Error getting skill gaps:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to analyze skill gaps',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route   GET /api/gemini/career-path
 * @desc    Get career path recommendations
 * @access  Private
 */
router.get('/career-path', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const userId = req.user.id;
    
    const response = await geminiService.chat(
      userId,
      'Based on my current profile and market trends, what career paths should I consider? Provide a detailed roadmap.',
      []
    );

    return res.json(response);
  } catch (error) {
    console.error('Error getting career path:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get career path advice',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route   POST /api/gemini/simulate-skill
 * @desc    Simulate adding a skill to see potential impact
 * @access  Private
 */
router.post('/simulate-skill', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const { skill } = req.body;

    if (!skill || typeof skill !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Invalid skill parameter'
      });
    }

    const userId = req.user.id;
    
    const response = await geminiService.chat(
      userId,
      `If I were to add ${skill} to my skill set, how would it impact my job opportunities? Show me specific jobs that would become available and estimate salary improvements.`,
      []
    );

    return res.json(response);
  } catch (error) {
    console.error('Error simulating skill:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to simulate skill addition',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route   POST /api/gemini/feedback
 * @desc    Submit feedback on AI recommendations
 * @access  Private
 */
router.post('/feedback', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const { messageId, rating, comment } = req.body;

    // Store feedback for improving recommendations
    // You can implement feedback storage logic here

    return res.json({
      success: true,
      message: 'Thank you for your feedback!'
    });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit feedback',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;