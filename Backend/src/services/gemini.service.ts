// src/services/gemini.service.ts
import { GoogleGenerativeAI } from '@google/generative-ai';
import pool from '../db/db.config';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  profile_picture: string | null;
  bio: string;
  skills: string[];
  location: string | null;
  phone: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  portfolio_url: string | null;
  years_of_experience: number;
  current_position: string | null;
  availability_status: string;
  preferred_job_types: string[] | null;
  preferred_locations: string[] | null;
  salary_expectation_min: number | null;
  salary_expectation_max: number | null;
}

interface Job {
  id: string;
  title: string;
  description: string;
  company: string;
  location: string;
  job_type: string;
  salary_min: number | null;
  salary_max: number | null;
  required_skills: string[];
  experience_level: string;
  category: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface GeminiResponse {
  success: boolean;
  message: string;
  recommendations?: {
    matchedJobs: Job[];
    skillGaps: string[];
    learningPaths: string[];
    careerAdvice: string;
  };
}

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
    }
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  }

  /**
   * Fetch user profile from database
   */
  private async fetchUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const query = `
        SELECT u.id, u.name, u.email, u.profile_picture,
               p.bio, p.skills, p.location, p.phone, p.linkedin_url, 
               p.github_url, p.portfolio_url, p.resume_url,
               p.years_of_experience, p.current_position, p.availability_status,
               p.preferred_job_types, p.preferred_locations,
               p.salary_expectation_min, p.salary_expectation_max
        FROM users u
        LEFT JOIN jobseeker_profiles p ON u.id = p.user_id
        WHERE u.id = $1
      `;
      const { rows } = await pool.query(query, [userId]);
      
      if (!rows.length) return null;

      const profile = rows[0];
      
      // Parse skills if they're stored as JSON string
      if (typeof profile.skills === 'string') {
        try {
          profile.skills = JSON.parse(profile.skills);
        } catch {
          profile.skills = [];
        }
      }

      return profile;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  }

  /**
   * Fetch available jobs from database
   */
  private async fetchAvailableJobs(limit: number = 50): Promise<Job[]> {
    try {
      const query = `
        SELECT j.id, j.title, j.description, j.location, j.job_type,
               j.salary_min, j.salary_max, j.required_skills, 
               j.experience_level, j.category,
               c.company_name as company
        FROM jobs j
        LEFT JOIN companies c ON j.company_id = c.id
        WHERE j.status = 'active' AND j.application_deadline > NOW()
        ORDER BY j.created_at DESC
        LIMIT $1
      `;
      const { rows } = await pool.query(query, [limit]);

      return rows.map((job) => {
        // Parse required_skills if stored as JSON string
        if (typeof job.required_skills === 'string') {
          try {
            job.required_skills = JSON.parse(job.required_skills);
          } catch {
            job.required_skills = [];
          }
        }
        return job;
      });
    } catch (error) {
      console.error('Error fetching jobs:', error);
      return [];
    }
  }

  /**
   * Calculate job match score based on user profile and job requirements
   */
  private calculateJobMatch(profile: UserProfile, job: Job): number {
    let score = 0;
    const userSkills = profile.skills || [];
    const requiredSkills = job.required_skills || [];

    // Skill match (40% weight)
    if (requiredSkills.length > 0) {
      const matchedSkills = userSkills.filter(skill =>
        requiredSkills.some(req => req.toLowerCase().includes(skill.toLowerCase()))
      );
      score += (matchedSkills.length / requiredSkills.length) * 40;
    }

    // Experience level match (30% weight)
    const expLevelScore = this.matchExperienceLevel(
      profile.years_of_experience,
      job.experience_level
    );
    score += expLevelScore * 30;

    // Location preference (15% weight)
    if (profile.preferred_locations && profile.preferred_locations.length > 0) {
      const locationMatch = profile.preferred_locations.some(loc =>
        job.location.toLowerCase().includes(loc.toLowerCase())
      );
      score += locationMatch ? 15 : 0;
    } else {
      score += 7.5; // Neutral if no preference
    }

    // Job type preference (15% weight)
    if (profile.preferred_job_types && profile.preferred_job_types.length > 0) {
      const typeMatch = profile.preferred_job_types.some(type =>
        job.job_type.toLowerCase().includes(type.toLowerCase())
      );
      score += typeMatch ? 15 : 0;
    } else {
      score += 7.5; // Neutral if no preference
    }

    return Math.round(score);
  }

  /**
   * Match experience level
   */
  private matchExperienceLevel(userExp: number, jobLevel: string): number {
    const level = jobLevel.toLowerCase();
    if (level.includes('entry') && userExp <= 2) return 1;
    if (level.includes('junior') && userExp >= 1 && userExp <= 3) return 1;
    if (level.includes('mid') && userExp >= 2 && userExp <= 5) return 1;
    if (level.includes('senior') && userExp >= 5) return 1;
    if (level.includes('lead') && userExp >= 7) return 1;
    return 0.5; // Partial match
  }

  /**
   * Identify skill gaps based on matched jobs
   */
  private identifySkillGaps(
    profile: UserProfile,
    topJobs: Job[]
  ): string[] {
    const userSkills = profile.skills || [];
    const allRequiredSkills = new Set<string>();

    topJobs.forEach(job => {
      (job.required_skills || []).forEach(skill => {
        allRequiredSkills.add(skill.toLowerCase());
      });
    });

    const skillGaps = Array.from(allRequiredSkills).filter(
      skill => !userSkills.some(us => us.toLowerCase() === skill)
    );

    return skillGaps;
  }

  /**
   * Generate system prompt for Gemini
   */
  private generateSystemPrompt(
    profile: UserProfile,
    matchedJobs: Job[],
    skillGaps: string[]
  ): string {
    return `You are an AI Career Advisor helping ${profile.name}, a ${profile.current_position || 'professional'} with ${profile.years_of_experience} years of experience.

USER PROFILE:
- Name: ${profile.name}
- Current Position: ${profile.current_position || 'Not specified'}
- Experience: ${profile.years_of_experience} years
- Skills: ${profile.skills?.join(', ') || 'None listed'}
- Location: ${profile.location || 'Not specified'}
- Availability: ${profile.availability_status}
- Bio: ${profile.bio || 'No bio provided'}

TOP MATCHED JOBS (${matchedJobs.length}):
${matchedJobs.slice(0, 5).map((job, idx) => `
${idx + 1}. ${job.title} at ${job.company}
   - Location: ${job.location}
   - Type: ${job.job_type}
   - Experience: ${job.experience_level}
   - Required Skills: ${job.required_skills.join(', ')}
`).join('\n')}

IDENTIFIED SKILL GAPS:
${skillGaps.length > 0 ? skillGaps.join(', ') : 'No significant gaps identified'}

YOUR ROLE:
1. Provide personalized career advice based on the user's profile
2. Recommend specific jobs from the matched list that align with their goals
3. Suggest learning paths to address skill gaps
4. Offer constructive feedback on profile completeness
5. Answer questions about career development and job search strategies

Be conversational, supportive, and actionable in your responses. Focus on helping the user advance their career.`;
  }

  /**
   * Main chat function with context-aware responses
   */
  async chat(
    userId: string,
    userMessage: string,
    conversationHistory: ChatMessage[] = []
  ): Promise<GeminiResponse> {
    try {
      // Fetch user profile and jobs
      const profile = await this.fetchUserProfile(userId);
      if (!profile) {
        return {
          success: false,
          message: 'Unable to fetch user profile. Please complete your profile first.',
        };
      }

      const jobs = await this.fetchAvailableJobs();
      
      // Calculate job matches
      const jobsWithScores = jobs.map(job => ({
        ...job,
        matchScore: this.calculateJobMatch(profile, job),
      }));

      // Sort by match score and get top matches
      const matchedJobs = jobsWithScores
        .filter(j => j.matchScore >= 30)
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 10);

      // Identify skill gaps
      const skillGaps = this.identifySkillGaps(profile, matchedJobs);

      // Generate system prompt
      const systemPrompt = this.generateSystemPrompt(profile, matchedJobs, skillGaps);

      // Build conversation context
      const conversationContext = conversationHistory
        .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
        .join('\n\n');

      // Create full prompt
      const fullPrompt = `${systemPrompt}

CONVERSATION HISTORY:
${conversationContext}

USER MESSAGE:
${userMessage}

Please provide a helpful, personalized response.`;

      // Generate response with Gemini
      const result = await this.model.generateContent(fullPrompt);
      const response = result.response;
      const text = response.text();

      return {
        success: true,
        message: text,
        recommendations: {
          matchedJobs: matchedJobs.slice(0, 5),
          skillGaps: skillGaps.slice(0, 10),
          learningPaths: this.generateLearningPaths(skillGaps),
          careerAdvice: this.generateCareerAdvice(profile, matchedJobs),
        },
      };
    } catch (error) {
      console.error('Error in Gemini chat:', error);
      return {
        success: false,
        message: 'Sorry, I encountered an error processing your request. Please try again.',
      };
    }
  }

  /**
   * Generate learning paths based on skill gaps
   */
  private generateLearningPaths(skillGaps: string[]): string[] {
    const learningResources: { [key: string]: string } = {
      javascript: 'Complete JavaScript courses on freeCodeCamp or Codecademy',
      typescript: 'Learn TypeScript through the official documentation and TypeScript Deep Dive',
      react: 'Build projects with React using the official React tutorial',
      angular: 'Follow Angular University courses and official documentation',
      'node.js': 'Master Node.js with Node.js Design Patterns book',
      python: 'Learn Python from Python.org tutorial and Real Python',
      'machine learning': 'Take Andrew Ng\'s Machine Learning course on Coursera',
      aws: 'Get AWS Certified through AWS Training and Certification',
      docker: 'Learn Docker with the official Docker documentation and courses',
      kubernetes: 'Master Kubernetes with Kubernetes Documentation and CNCF courses',
    };

    return skillGaps.slice(0, 5).map(skill => {
      const normalizedSkill = skill.toLowerCase();
      return learningResources[normalizedSkill] || 
        `Explore ${skill} through online courses on Udemy, Coursera, or YouTube`;
    });
  }

  /**
   * Generate career advice summary
   */
  private generateCareerAdvice(profile: UserProfile, matchedJobs: Job[]): string {
    const advicePoints: string[] = [];

    // Profile completeness
    if (!profile.bio || profile.bio.length < 50) {
      advicePoints.push('Enhance your bio with more details about your professional journey');
    }
    if (!profile.skills || profile.skills.length < 5) {
      advicePoints.push('Add more skills to increase your visibility to employers');
    }
    if (!profile.linkedin_url && !profile.github_url) {
      advicePoints.push('Connect your LinkedIn or GitHub profile for better networking');
    }

    // Job match insights
    if (matchedJobs.length === 0) {
      advicePoints.push('Consider broadening your job preferences or updating your skills');
    } else if (matchedJobs.length < 5) {
      advicePoints.push('Expand your skill set to match more opportunities');
    }

    return advicePoints.join('. ') || 'Your profile looks great! Keep applying to matched opportunities.';
  }

  /**
   * Get initial career recommendations without chat
   */
  async getCareerRecommendations(userId: string): Promise<GeminiResponse> {
    return this.chat(
      userId,
      'Please analyze my profile and provide career recommendations, including matched jobs, skill gaps, and learning paths.',
      []
    );
  }
}

export default new GeminiService();