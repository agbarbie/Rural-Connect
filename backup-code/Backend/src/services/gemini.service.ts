// src/services/gemini.service.ts - COMPLETE FIXED VERSION
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
  matchScore?: number;
}

interface Training {
  id: string;
  title: string;
  description: string;
  provider: string;
  duration: string;
  level: string;
  skills_covered: string[];
  price: number | null;
  rating: number | null;
  enrolled_count: number;
  category: string;
  matchScore?: number;
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
    matchedTrainings: Training[];
    skillGaps: string[];
    learningPaths: string[];
    careerAdvice: string;
  };
}

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: any = null;
  private workingModelName: string | null = null;
  private schemaCache: { [key: string]: string[] } = {};

  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      console.error('❌ GEMINI_API_KEY not configured in .env file');
      throw new Error('GEMINI_API_KEY is required');
    }
    
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // Use the working model directly - no auto-detection needed
    this.model = this.genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        topK: 64,
        maxOutputTokens: 2048,
      }
    });
    this.workingModelName = 'gemini-2.5-flash';
    
    console.log('✅ Gemini Service initialized with model: gemini-2.5-flash');
  }

  private async getTableColumns(tableName: string): Promise<string[]> {
    if (this.schemaCache[tableName]) {
      return this.schemaCache[tableName];
    }

    try {
      const query = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1
        ORDER BY ordinal_position
      `;
      const { rows } = await pool.query(query, [tableName]);
      const columns = rows.map(row => row.column_name);
      this.schemaCache[tableName] = columns;
      return columns;
    } catch (error) {
      console.error(`Error fetching columns for ${tableName}:`, error);
      return [];
    }
  }

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

  private async fetchAvailableJobs(limit: number = 50): Promise<Job[]> {
    try {
      const jobColumns = await this.getTableColumns('jobs');
      const companyColumns = await this.getTableColumns('companies');

      const jobTypeCol = jobColumns.find(c => 
        c === 'job_type' || c === 'employment_type' || c === 'type'
      ) || null;

      const skillsCol = jobColumns.find(c => 
        c === 'required_skills' || c === 'skills' || c === 'skill_requirements' || c === 'skills_required'
      ) || null;

      const experienceCol = jobColumns.find(c =>
        c === 'experience_level' || c === 'experience' || c === 'experience_required'
      ) || null;

      const categoryCol = jobColumns.find(c =>
        c === 'category' || c === 'job_category' || c === 'industry'
      ) || null;

      const companyNameCol = companyColumns.find(c =>
        c === 'company_name' || c === 'name'
      ) || 'name';

      const selectFields = [
        'j.id',
        'j.title',
        'j.description',
        'j.location',
        jobTypeCol ? `j.${jobTypeCol} as job_type` : `'full-time' as job_type`,
        'j.salary_min',
        'j.salary_max',
        skillsCol ? `j.${skillsCol} as required_skills` : `'[]'::json as required_skills`,
        experienceCol ? `j.${experienceCol} as experience_level` : `'mid-level' as experience_level`,
        categoryCol ? `j.${categoryCol} as category` : `'General' as category`,
        `c.${companyNameCol} as company`
      ];

      const query = `
        SELECT ${selectFields.join(',\n               ')}
        FROM jobs j
        LEFT JOIN companies c ON j.company_id = c.id
        WHERE j.status = 'active' 
          AND (j.application_deadline IS NULL OR j.application_deadline > NOW())
        ORDER BY j.created_at DESC
        LIMIT $1
      `;

      const { rows } = await pool.query(query, [limit]);

      return rows.map((job) => {
        if (typeof job.required_skills === 'string') {
          try {
            job.required_skills = JSON.parse(job.required_skills);
          } catch {
            job.required_skills = [];
          }
        }

        if (!Array.isArray(job.required_skills)) {
          job.required_skills = [];
        }

        if (!job.job_type) {
          job.job_type = 'full-time';
        }

        return job;
      });
    } catch (error) {
      console.error('❌ Error fetching jobs:', error);
      return [];
    }
  }

  private async fetchAvailableTrainings(limit: number = 50): Promise<Training[]> {
  try {
    const trainingColumns = await this.getTableColumns('trainings');
    
    const skillsCol = trainingColumns.find(c => 
      c === 'skills_covered' || c === 'skills' || c === 'topics' || c === 'category'
    ) || null;

    // Check what enrollment-related columns exist
    const enrollmentCountCol = trainingColumns.find(c =>
      c === 'enrolled_count' || c === 'enrollment_count' || 
      c === 'current_participants' || c === 'participants_count'
    );

    const selectFields = [
      't.id',
      't.title',
      't.description',
      `'Online Platform' as provider`,
      `COALESCE(t.duration::text, '4-8 weeks') as duration`,
      `COALESCE(t.level, 'Intermediate') as level`,
      skillsCol ? `t.${skillsCol}::text as skills_covered` : `t.category::text as skills_covered`,
      `COALESCE(t.price, 0) as price`,
      `COALESCE(t.rating, 4.5) as rating`,
      // Fixed: Use subquery to count actual enrollments instead of relying on a column
      enrollmentCountCol 
        ? `COALESCE(t.${enrollmentCountCol}, 0) as enrolled_count`
        : `(SELECT COUNT(*) FROM training_enrollments WHERE training_id = t.id) as enrolled_count`,
      `COALESCE(t.category, 'General') as category`
    ];

    const query = `
      SELECT ${selectFields.join(',\n             ')}
      FROM trainings t
      WHERE t.status = 'published'
      ORDER BY t.created_at DESC
      LIMIT $1
    `;

    const { rows } = await pool.query(query, [limit]);

    return rows.map((training) => {
      let skillsArray: string[] = [];
      
      if (training.skills_covered) {
        if (typeof training.skills_covered === 'string') {
          try {
            skillsArray = JSON.parse(training.skills_covered);
          } catch {
            skillsArray = [training.skills_covered];
          }
        } else if (Array.isArray(training.skills_covered)) {
          skillsArray = training.skills_covered;
        }
      }

      if (skillsArray.length === 0 && training.category) {
        skillsArray = [training.category];
      }

      training.skills_covered = skillsArray;
      return training;
    });
  } catch (error) {
    console.error('❌ Error fetching trainings:', error);
    return [];
  }
}


  private calculateJobMatch(profile: UserProfile, job: Job): number {
    let score = 0;
    const userSkills = profile.skills || [];
    const requiredSkills = job.required_skills || [];

    if (requiredSkills.length > 0 && userSkills.length > 0) {
      const matchedSkills = userSkills.filter(skill =>
        requiredSkills.some(req => 
          req.toLowerCase().includes(skill.toLowerCase()) ||
          skill.toLowerCase().includes(req.toLowerCase())
        )
      );
      score += (matchedSkills.length / requiredSkills.length) * 40;
    } else {
      score += 20;
    }

    const expLevelScore = this.matchExperienceLevel(
      profile.years_of_experience,
      job.experience_level
    );
    score += expLevelScore * 30;

    if (profile.preferred_locations && profile.preferred_locations.length > 0) {
      const locationMatch = profile.preferred_locations.some(loc =>
        job.location.toLowerCase().includes(loc.toLowerCase())
      );
      score += locationMatch ? 15 : 0;
    } else {
      score += 7.5;
    }

    if (profile.preferred_job_types && profile.preferred_job_types.length > 0) {
      const typeMatch = profile.preferred_job_types.some(type =>
        job.job_type.toLowerCase().includes(type.toLowerCase())
      );
      score += typeMatch ? 15 : 0;
    } else {
      score += 7.5;
    }

    return Math.round(score);
  }

  private matchExperienceLevel(userExp: number, jobLevel: string): number {
    const level = jobLevel.toLowerCase();
    if (level.includes('entry') && userExp <= 2) return 1;
    if (level.includes('junior') && userExp >= 1 && userExp <= 3) return 1;
    if (level.includes('mid') && userExp >= 2 && userExp <= 5) return 1;
    if (level.includes('senior') && userExp >= 5) return 1;
    if (level.includes('lead') && userExp >= 7) return 1;
    return 0.5;
  }

  private calculateTrainingMatch(profile: UserProfile, training: Training, skillGaps: string[]): number {
    let score = 0;
    const trainingSkills = training.skills_covered || [];
    
    if (skillGaps.length > 0 && trainingSkills.length > 0) {
      const gapsCovered = skillGaps.filter(gap =>
        trainingSkills.some(skill => 
          skill.toLowerCase().includes(gap.toLowerCase()) ||
          gap.toLowerCase().includes(skill.toLowerCase())
        )
      );
      score += (gapsCovered.length / Math.max(skillGaps.length, 1)) * 50;
    }

    const userSkills = profile.skills || [];
    if (userSkills.length > 0 && trainingSkills.length > 0) {
      const relatedSkills = userSkills.filter(userSkill =>
        trainingSkills.some(skill => 
          skill.toLowerCase().includes(userSkill.toLowerCase()) ||
          userSkill.toLowerCase().includes(skill.toLowerCase())
        )
      );
      score += (relatedSkills.length / userSkills.length) * 20;
    }

    const trainingLevel = training.level.toLowerCase();
    const userExp = profile.years_of_experience;
    
    if (trainingLevel.includes('beginner') && userExp <= 2) score += 20;
    else if (trainingLevel.includes('intermediate') && userExp >= 1 && userExp <= 5) score += 20;
    else if (trainingLevel.includes('advanced') && userExp >= 3) score += 20;
    else score += 10;

    if (training.rating) {
      score += (training.rating / 5) * 10;
    }

    return Math.round(score);
  }

  private identifySkillGaps(profile: UserProfile, topJobs: Job[]): string[] {
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

  private generateSystemPrompt(
    profile: UserProfile,
    matchedJobs: Job[],
    matchedTrainings: Training[],
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

TOP MATCHED JOBS (${matchedJobs.length}):
${matchedJobs.slice(0, 5).map((job, idx) => `
${idx + 1}. ${job.title} at ${job.company} (${job.matchScore}% match)
   - Location: ${job.location}
   - Salary: KSh ${job.salary_min?.toLocaleString()} - ${job.salary_max?.toLocaleString()}
   - Type: ${job.job_type}
   - Required Skills: ${job.required_skills.slice(0, 5).join(', ')}
`).join('\n')}

RECOMMENDED TRAINING COURSES (${matchedTrainings.length}):
${matchedTrainings.slice(0, 5).map((training, idx) => `
${idx + 1}. ${training.title} by ${training.provider} (${training.matchScore}% match)
   - Level: ${training.level}
   - Duration: ${training.duration}
   - Skills: ${training.skills_covered.slice(0, 3).join(', ')}
`).join('\n')}

IDENTIFIED SKILL GAPS:
${skillGaps.length > 0 ? skillGaps.slice(0, 10).join(', ') : 'No significant gaps identified'}

YOUR ROLE:
1. Have natural, conversational interactions with the user
2. Recommend specific jobs and training courses from the lists above
3. Suggest learning paths for skill gaps
4. Provide personalized career advice
5. Answer ANY question the user asks in a friendly, helpful way

Be conversational, supportive, and actionable. Respond naturally to greetings and questions.`;
  }

  async chat(
    userId: string,
    userMessage: string,
    conversationHistory: ChatMessage[] = []
  ): Promise<GeminiResponse> {
    try {
      const profile = await this.fetchUserProfile(userId);
      if (!profile) {
        return {
          success: false,
          message: 'Unable to fetch user profile. Please complete your profile first.',
        };
      }

      const jobs = await this.fetchAvailableJobs();
      const trainings = await this.fetchAvailableTrainings();
      
      const jobsWithScores = jobs.map(job => ({
        ...job,
        matchScore: this.calculateJobMatch(profile, job),
      }));

      const matchedJobs = jobsWithScores
        .filter(j => j.matchScore >= 30)
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 10);

      const skillGaps = this.identifySkillGaps(profile, matchedJobs);

      const trainingsWithScores = trainings.map(training => ({
        ...training,
        matchScore: this.calculateTrainingMatch(profile, training, skillGaps),
      }));

      const matchedTrainings = trainingsWithScores
        .filter(t => t.matchScore >= 20)
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 10);

      console.log(`💼 Matched ${matchedJobs.length} jobs for user ${profile.name}`);
      console.log(`📚 Matched ${matchedTrainings.length} trainings for user ${profile.name}`);

      try {
        const systemPrompt = this.generateSystemPrompt(profile, matchedJobs, matchedTrainings, skillGaps);
        const conversationContext = conversationHistory
          .slice(-6) // Only keep last 3 exchanges to stay within token limits
          .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
          .join('\n\n');

        const fullPrompt = `${systemPrompt}

RECENT CONVERSATION:
${conversationContext}

USER MESSAGE:
${userMessage}

Please provide a helpful, conversational response. Keep it concise but informative.`;

        console.log(`🤖 Sending request to Gemini AI...`);
        const result = await this.model.generateContent(fullPrompt);
        const response = result.response;
        const text = response.text();

        console.log(`✅ Gemini AI responded successfully!`);

        return {
          success: true,
          message: text,
          recommendations: {
            matchedJobs: matchedJobs.slice(0, 5),
            matchedTrainings: matchedTrainings.slice(0, 5),
            skillGaps: skillGaps.slice(0, 10),
            learningPaths: this.generateLearningPaths(skillGaps),
            careerAdvice: this.generateCareerAdvice(profile, matchedJobs),
          },
        };
      } catch (aiError: any) {
        console.error(`❌ Gemini API error:`, aiError.message);
        console.error(`   Status: ${aiError.status}`);
        
        // Fallback response
        return this.generateFallbackResponse(profile, userMessage, matchedJobs, matchedTrainings, skillGaps);
      }

    } catch (error: any) {
      console.error('❌ Error in chat:', error);
      return {
        success: false,
        message: 'Sorry, I encountered an error. Please try again.',
      };
    }
  }

  private generateFallbackResponse(
    profile: UserProfile,
    userMessage: string,
    matchedJobs: Job[],
    matchedTrainings: Training[],
    skillGaps: string[]
  ): GeminiResponse {
    let responseMessage = `Hi ${profile.name}! 👋\n\n`;
    const messageLower = userMessage.toLowerCase();
    
    if (messageLower.includes('job') || messageLower.includes('opportunit') || messageLower.includes('recommend')) {
      responseMessage += `**Job Recommendations:**\n\n`;
      responseMessage += `Based on your ${profile.years_of_experience} years of experience, I've found ${matchedJobs.length} matching opportunities.\n\n`;
      
      if (matchedJobs.length > 0) {
        responseMessage += `**Top Matches:**\n`;
        matchedJobs.slice(0, 3).forEach((job, idx) => {
          responseMessage += `\n${idx + 1}. **${job.title}** at ${job.company}\n`;
          responseMessage += `   📍 ${job.location} | 💼 ${job.job_type} | 💰 KSh ${job.salary_min?.toLocaleString()}\n`;
          responseMessage += `   Match Score: ${job.matchScore}%\n`;
        });
        responseMessage += `\n💡 **Tip:** Apply quickly to high-match roles!\n\n`;
      }
    } else {
      responseMessage += `I'm here to help! I can assist with:\n\n`;
      responseMessage += `💼 **Job Matching** - ${matchedJobs.length} opportunities available\n`;
      responseMessage += `📚 **Training Courses** - ${matchedTrainings.length} courses matched\n`;
      responseMessage += `🎯 **Skill Development** - ${skillGaps.length} skill gaps identified\n\n`;
    }
    
    return {
      success: true,
      message: responseMessage,
      recommendations: {
        matchedJobs: matchedJobs.slice(0, 5),
        matchedTrainings: matchedTrainings.slice(0, 5),
        skillGaps: skillGaps.slice(0, 10),
        learningPaths: this.generateLearningPaths(skillGaps),
        careerAdvice: this.generateCareerAdvice(profile, matchedJobs)
      }
    };
  }

  private generateLearningPaths(skillGaps: string[]): string[] {
    const learningResources: { [key: string]: string } = {
      javascript: 'Complete JavaScript courses on freeCodeCamp',
      typescript: 'Learn TypeScript through official documentation',
      react: 'Build projects with React tutorial',
      angular: 'Follow Angular University courses',
      'node.js': 'Master Node.js Design Patterns',
      python: 'Learn Python from Python.org',
      'machine learning': 'Take ML course on Coursera',
      aws: 'Get AWS Certified',
      docker: 'Learn Docker documentation',
      kubernetes: 'Master Kubernetes',
    };

    return skillGaps.slice(0, 5).map(skill => {
      const normalizedSkill = skill.toLowerCase();
      return learningResources[normalizedSkill] || 
        `Explore ${skill} through online courses`;
    });
  }

  private generateCareerAdvice(profile: UserProfile, matchedJobs: Job[]): string {
    const advicePoints: string[] = [];

    if (!profile.bio || profile.bio.length < 50) {
      advicePoints.push('Enhance your bio');
    }
    if (!profile.skills || profile.skills.length < 5) {
      advicePoints.push('Add more skills');
    }
    if (!profile.linkedin_url && !profile.github_url) {
      advicePoints.push('Connect LinkedIn or GitHub');
    }

    if (matchedJobs.length === 0) {
      advicePoints.push('Broaden job preferences');
    } else if (matchedJobs.length < 5) {
      advicePoints.push('Expand skill set');
    }

    return advicePoints.join('. ') || 'Profile looks great!';
  }

  async getCareerRecommendations(userId: string): Promise<GeminiResponse> {
    return this.chat(
      userId,
      'Please analyze my profile and provide career recommendations, including jobs, training courses, skill gaps, and learning paths.',
      []
    );
  }
}

export default new GeminiService();