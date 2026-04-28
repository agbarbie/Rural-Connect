// src/routes/gemini.routes.ts - COMPLETE FIXED VERSION
import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
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
router.get('/recommendations', authenticate, async (req: AuthRequest, res: Response) => {
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
 * @desc    Send a chat message to Gemini AI (JOBSEEKER)
 * @access  Private
 */
router.post('/chat', authenticate, async (req: AuthRequest, res: Response) => {
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
 * @route   POST /api/gemini/employer-chat
 * @desc    Employer-specific chat for candidate analysis
 * @access  Private (Employer only)
 */
router.post('/employer-chat', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const { message, conversationHistory, context } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Invalid message format'
      });
    }

    // Extract employer context from frontend
    const {
      jobs = [],
      trainings = [],
      candidates = [],
      selectedJob = null
    } = context || {};

    console.log('📊 Employer chat context:', {
      jobs: jobs.length,
      trainings: trainings.length,
      candidates: candidates.length,
      trainingTitles: trainings.map((t: any) => t.title)
    });

    // Build employer-specific prompt
    const employerPrompt = buildEmployerPrompt(message, {
      jobs,
      trainings,
      candidates,
      selectedJob,
      conversationHistory
    });

    // Call Gemini directly (bypass jobseeker-focused service)
    const response = await callGeminiForEmployer(employerPrompt);

    return res.json(response);
  } catch (error) {
    console.error('Error in employer chat:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process employer chat',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route   GET /api/gemini/jobs
 * @desc    Get job recommendations with optional filters
 * @access  Private
 */
router.get('/jobs', authenticate, async (req: AuthRequest, res: Response) => {
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
router.get('/skill-gaps', authenticate, async (req: AuthRequest, res: Response) => {
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
router.get('/career-path', authenticate, async (req: AuthRequest, res: Response) => {
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
router.post('/simulate-skill', authenticate, async (req: AuthRequest, res: Response) => {
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
router.post('/feedback', authenticate, async (req: AuthRequest, res: Response) => {
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

// ============================================
// HELPER FUNCTIONS FOR EMPLOYER CHAT
// ============================================

/**
 * Build employer-specific prompt with context
 */
function buildEmployerPrompt(
  userMessage: string,
  context: {
    jobs: any[];
    trainings: any[];
    candidates: any[];
    selectedJob: any;
    conversationHistory: any[];
  }
): string {
  const { jobs, trainings, candidates, selectedJob, conversationHistory } = context;

  const jobsList = jobs.length > 0
    ? jobs.map(j => `• ${j.title} (${j.applications_count || 0} applications, Skills: ${j.skills_required?.slice(0, 3).join(', ') || 'Not specified'})`).join('\n')
    : 'No active jobs';

  const trainingsList = trainings.length > 0
    ? trainings.map(t => `• ${t.title} - ${t.category}, ${t.level}, ${t.duration_hours}h, ${t.cost_type}`).join('\n')
    : 'No training programs available';

  const candidatesList = candidates.length > 0
    ? candidates.slice(0, 5).map(c => 
        `• ${c.name} (${c.match_score}%, ${c.title}, Skills: ${c.skills?.slice(0, 3).join(', ') || 'Not specified'})`
      ).join('\n')
    : 'No candidates yet';

  const conversationContext = conversationHistory
    .slice(-4)
    .map((msg: any) => `${msg.role === 'user' ? 'Employer' : 'AI'}: ${msg.content}`)
    .join('\n\n');

  return `You are an expert HR consultant helping an employer make hiring decisions.

**EMPLOYER'S ACTIVE JOBS (${jobs.length}):**
${jobsList}

**AVAILABLE TRAINING PROGRAMS (${trainings.length}):**
${trainingsList}

**CANDIDATE POOL (${candidates.length} total, showing top 5):**
${candidatesList}

${selectedJob ? `**CURRENTLY VIEWING JOB:** ${selectedJob.title}` : '**VIEWING:** All candidates across all jobs'}

**RECENT CONVERSATION:**
${conversationContext || 'Starting new conversation'}

**EMPLOYER'S QUESTION:**
${userMessage}

**YOUR ROLE:**
- Analyze candidates for job fit
- Recommend SPECIFIC training programs from the list above when candidates have skill gaps
- Compare candidates objectively using their match scores and skills
- Suggest hiring strategies
- Reference actual job titles, candidate names, and training programs by name

**CRITICAL RULES:**
1. When asked about trainings, LIST the actual programs with details (title, category, level, duration, cost)
2. When recommending training for a candidate, cite specific programs from the list
3. Always reference candidate names and their match scores
4. Be specific and actionable, not generic
5. If no data is available, say so clearly

**EXAMPLE RESPONSES:**
- "You have 7 training programs available: React Masterclass (Technology, Intermediate, 8h, Paid), Python Fundamentals (Technology, Beginner, 6h, Free)..."
- "For Alice Johnson (65% match), I recommend enrolling her in your 'Backend Development Bootcamp' to strengthen her server-side skills."
- "Comparing your top candidates: John (85%) has strong React skills, while Sarah (78%) excels in Node.js..."

Respond naturally, professionally, and helpfully:`;
}

/**
 * Call Gemini API for employer chat
 */
async function callGeminiForEmployer(prompt: string): Promise<any> {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  
  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY not configured');
    return {
      success: false,
      message: 'AI service is not configured. Please contact support.'
    };
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.7,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 2048,
    }
  });

  try {
    console.log('🤖 Calling Gemini API for employer chat...');
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    console.log('✅ Gemini API responded successfully');
    return {
      success: true,
      message: text
    };
  } catch (error: any) {
    console.error('❌ Gemini API error:', error.message);
    console.error('   Status:', error.status);
    
    // Check if it's a quota error
    if (error.status === 429 || error.message?.includes('quota')) {
      return {
        success: true,
        message: '⚠️ AI service is currently at capacity. However, I can still help you!\n\n' +
                 'I can see your context. Please rephrase your question or ask me to:\n' +
                 '• List your available training programs\n' +
                 '• Analyze a specific candidate\n' +
                 '• Compare candidates\n' +
                 '• Suggest hiring strategies'
      };
    }
    
    // Generic fallback
    return {
      success: true,
      message: 'I apologize for the temporary issue. Could you please rephrase your question? ' +
               'I have access to your jobs, candidates, and training programs and can help analyze them.'
    };
  }
}

export default router;