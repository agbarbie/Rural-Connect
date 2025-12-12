// src/services/gemini.service.ts - AUTO-DETECT WORKING MODEL
import { GoogleGenerativeAI } from '@google/generative-ai';
import pool from '../db/db.config';

interface UserProfile {
  experience_level: string;
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
  private genAI!: GoogleGenerativeAI;  // Add ! to tell TypeScript it will be initialized
  private model: any = null;
  private workingModelName: string | null = null;
  private schemaCache: { [key: string]: string[] } = {};
  private modelsTried: string[] = [];

  // List of all possible Gemini models to try
  private readonly MODEL_CANDIDATES = [
    'gemini-pro',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-pro-latest',
    'gemini-1.5-flash-8b',
    'gemini-1.0-pro',
    'gemini-1.0-pro-001',
    'gemini-1.0-pro-latest',
  ];

  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      console.error('❌ GEMINI_API_KEY not configured in .env file');
      console.log('💡 Get your API key from: https://aistudio.google.com/app/apikey');
      return;
    }
    
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    console.log('🔍 Gemini Service initializing - will auto-detect working model on first use');
    console.log('⚠️  If API key was just created, it may take 5-10 minutes to activate');
    console.log('💡 Using intelligent fallback responses until Gemini API is ready');
  }

  /**
   * Try to find a working Gemini model by testing each one
   */
  private async findWorkingModel(): Promise<boolean> {
    if (this.model && this.workingModelName) {
      return true; // Already found a working model
    }

    console.log('🔍 Searching for a working Gemini model...');
    console.log(`📋 Will try ${this.MODEL_CANDIDATES.length} different model names`);

    for (const modelName of this.MODEL_CANDIDATES) {
      try {
        console.log(`🧪 Testing model: ${modelName}...`);
        
        const testModel = this.genAI.getGenerativeModel({ 
          model: modelName,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 100, // Small for testing
          }
        });

        // Try a simple test prompt
        const result = await testModel.generateContent('Say "Hello" in one word');
        const response = result.response;
        const text = response.text();

        if (text && text.length > 0) {
          // Success! This model works
          this.model = this.genAI.getGenerativeModel({ 
            model: modelName,
            generationConfig: {
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 2048,
            }
          });
          this.workingModelName = modelName;
          console.log(`✅ SUCCESS! Found working model: ${modelName}`);
          console.log(`💬 Test response: "${text.substring(0, 50)}..."`);
          return true;
        }
      } catch (error: any) {
        this.modelsTried.push(modelName);
        console.log(`❌ ${modelName} failed: ${error.message?.substring(0, 100)}`);
        continue; // Try next model
      }
    }

    console.error('❌ No working Gemini models found after trying all options');
    console.log('📋 Models tried:', this.modelsTried.join(', '));
    console.log('');
    console.log('🔧 TROUBLESHOOTING STEPS:');
    console.log('1. Verify your API key is correct in .env file');
    console.log('2. Check if your API key is enabled at: https://aistudio.google.com/app/apikey');
    console.log('3. Try generating a new API key');
    console.log('4. Check if there are any API restrictions on your Google Cloud project');
    console.log('');
    return false;
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
        c === 'required_skills' || c === 'skills' || c === 'skill_requirements'
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

      const durationCol = trainingColumns.find(c =>
        c === 'duration' || c === 'length' || c === 'duration_hours'
      ) || null;

      const levelCol = trainingColumns.find(c =>
        c === 'level' || c === 'difficulty_level' || c === 'skill_level'
      ) || null;

      const priceCol = trainingColumns.find(c =>
        c === 'price' || c === 'cost' || c === 'fee'
      ) || null;

      const ratingCol = trainingColumns.find(c =>
        c === 'rating' || c === 'average_rating' || c === 'score'
      ) || null;

      const enrolledCol = trainingColumns.find(c =>
        c === 'enrolled_count' || c === 'enrollments' || c === 'students_count' || c === 'total_students' || c === 'current_participants'
      ) || null;

      const categoryCol = trainingColumns.find(c =>
        c === 'category' || c === 'training_category' || c === 'type'
      ) || null;

      const providerCol = trainingColumns.find(c =>
        c === 'provider' || c === 'instructor' || c === 'organization' || c === 'provider_name'
      ) || null;

      const videoCountCol = trainingColumns.find(c =>
        c === 'video_count' || c === 'videos_count' || c === 'total_videos'
      ) || null;

      const selectFields = [
        't.id',
        't.title',
        't.description',
        providerCol ? `t.${providerCol} as provider` : `'Online Platform' as provider`,
        durationCol ? `t.${durationCol}::text as duration` : `'4-8 weeks' as duration`,
        levelCol ? `t.${levelCol} as level` : `'Intermediate' as level`,
        skillsCol ? `t.${skillsCol}::text as skills_covered` : `t.category::text as skills_covered`,
        priceCol ? `t.${priceCol} as price` : `0 as price`,
        ratingCol ? `t.${ratingCol} as rating` : `4.5 as rating`,
        enrolledCol ? `t.${enrolledCol} as enrolled_count` : `0 as enrolled_count`,
        categoryCol ? `t.${categoryCol} as category` : `'General' as category`,
        videoCountCol ? `t.${videoCountCol} as video_count` : `0 as video_count`
      ];

      const query = `
        SELECT ${selectFields.join(',\n               ')}
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
              skillsArray = training.skills_covered
                .split(',')
                .map((s: string) => s.trim())
                .filter((s: string) => s);
            }
          } else if (Array.isArray(training.skills_covered)) {
            skillsArray = training.skills_covered;
          }
        }

        if (skillsArray.length === 0 && training.category) {
          skillsArray = [training.category];
        }

        training.skills_covered = skillsArray;

        if (training.duration && !isNaN(Number(training.duration))) {
          const hours = Number(training.duration);
          if (hours < 10) {
            training.duration = `${hours} hours`;
          } else if (hours < 40) {
            training.duration = `${Math.ceil(hours / 8)} days`;
          } else {
            training.duration = `${Math.ceil(hours / 40)} weeks`;
          }
        }

        if (training.video_count && training.video_count > 0) {
          training.duration = `${training.video_count} videos`;
        }

        return training;
      });
    } catch (error) {
      console.error('❌ Error fetching trainings:', error);
      return [];
    }
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
   - Type: ${job.job_type}
   - Required Skills: ${job.required_skills.join(', ')}
`).join('\n')}

RECOMMENDED TRAINING COURSES (${matchedTrainings.length}):
${matchedTrainings.slice(0, 5).map((training, idx) => `
${idx + 1}. ${training.title} by ${training.provider} (${training.matchScore}% match)
   - Level: ${training.level}
   - Duration: ${training.duration}
   - Skills: ${training.skills_covered.join(', ')}
`).join('\n')}

IDENTIFIED SKILL GAPS:
${skillGaps.length > 0 ? skillGaps.join(', ') : 'No significant gaps identified'}

YOUR ROLE:
1. Have natural, conversational interactions with the user
2. Recommend specific jobs and training courses
3. Suggest learning paths for skill gaps
4. Provide personalized career advice
5. Answer ANY question the user asks in a friendly, helpful way

Be conversational, supportive, and actionable. Respond naturally to greetings, thanks, and casual questions.`;
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
        .filter(t => t.matchScore >= 20) // Lower threshold for more results
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 10);

      console.log(`💼 Matched ${matchedJobs.length} jobs for user ${profile.name}`);
      console.log(`📚 Matched ${matchedTrainings.length} trainings for user ${profile.name}`);

      // Try to find and use Gemini API (but only once)
      if (!this.workingModelName && !this.modelsTried.length) {
        const hasWorkingModel = await this.findWorkingModel();
        
        if (hasWorkingModel && this.model) {
          try {
            const systemPrompt = this.generateSystemPrompt(profile, matchedJobs, matchedTrainings, skillGaps);
            const conversationContext = conversationHistory
              .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
              .join('\n\n');

            const fullPrompt = `${systemPrompt}

CONVERSATION HISTORY:
${conversationContext}

USER MESSAGE:
${userMessage}

Please provide a helpful, conversational response.`;

            console.log(`🤖 Sending request to Gemini (${this.workingModelName})...`);
            const result = await this.model.generateContent(fullPrompt);
            const response = result.response;
            const text = response.text();

            console.log(`✅ Gemini API success with ${this.workingModelName}!`);

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
            console.log(`⚠️ Gemini API call failed: ${aiError.message}`);
          }
        }
      }

      // Use intelligent fallback (skip Gemini detection after first try)
      console.log('💡 Using intelligent fallback response');
      return this.generateFallbackResponse(userId, userMessage, profile, matchedJobs, matchedTrainings, skillGaps);

    } catch (error: any) {
      console.error('❌ Error in chat:', error);
      return {
        success: false,
        message: 'Sorry, I encountered an error. Please try again.',
      };
    }
  }

  private calculateProfileCompleteness(profile: UserProfile): number {
    let score = 0;
    const totalFields = 10;

    if (profile.bio && profile.bio.length > 50) score++;
    if (profile.skills && profile.skills.length >= 3) score++;
    if (profile.skills && profile.skills.length >= 5) score++;
    if (profile.location) score++;
    if (profile.phone) score++;
    if (profile.linkedin_url) score++;
    if (profile.github_url) score++;
    if (profile.current_position) score++;
    if (profile.years_of_experience > 0) score++;
    if (profile.preferred_job_types && profile.preferred_job_types.length > 0) score++;

    return Math.round((score / totalFields) * 100);
  }

  private async generateFallbackResponse(
    userId: string, 
    userMessage: string,
    profile?: UserProfile,
    matchedJobs?: Job[],
    matchedTrainings?: Training[],
    skillGaps?: string[]
  ): Promise<GeminiResponse> {
    if (!profile) {
      const fetchedProfile = await this.fetchUserProfile(userId);
      if (!fetchedProfile) {
        return {
          success: false,
          message: 'Unable to fetch user profile.',
        };
      }
      profile = fetchedProfile;
    }

    if (!matchedJobs) {
      const jobs = await this.fetchAvailableJobs();
      const jobsWithScores = jobs.map(job => ({
        ...job,
        matchScore: this.calculateJobMatch(profile!, job),
      }));
      matchedJobs = jobsWithScores
        .filter(j => j.matchScore >= 30)
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 10);
    }

    if (!skillGaps) {
      skillGaps = this.identifySkillGaps(profile, matchedJobs);
    }

    if (!matchedTrainings) {
      const trainings = await this.fetchAvailableTrainings();
      const trainingsWithScores = trainings.map(training => ({
        ...training,
        matchScore: this.calculateTrainingMatch(profile!, training, skillGaps!),
      }));
      matchedTrainings = trainingsWithScores
        .filter(t => t.matchScore >= 20)
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 10);
    }
    
    const completeness = this.calculateProfileCompleteness(profile);
    const messageLower = userMessage.toLowerCase();
    
    let responseMessage = `Hi ${profile.name}! 👋\n\n`;
    
    if (messageLower.includes('job') || messageLower.includes('opportunit') || messageLower.includes('recommend')) {
      responseMessage += `**Job Recommendations:**\n\n`;
      responseMessage += `Based on your ${profile.years_of_experience} years of experience in ${profile.current_position || 'your field'} and skills in ${profile.skills?.slice(0, 3).join(', ')}, I've found ${matchedJobs.length} matching opportunities.\n\n`;
      
      if (matchedJobs.length > 0) {
        responseMessage += `**Top Matches:**\n`;
        matchedJobs.slice(0, 3).forEach((job, idx) => {
          responseMessage += `\n${idx + 1}. **${job.title}** at ${job.company}\n`;
          responseMessage += `   📍 ${job.location} | 💼 ${job.job_type} | 💰 KSh ${job.salary_min?.toLocaleString() || 'Competitive'}\n`;
          responseMessage += `   Match Score: ${job.matchScore}%\n`;
        });
        responseMessage += `\n💡 **Tip:** Apply quickly to high-match roles to increase your chances!\n\n`;
      }

      if (matchedTrainings.length > 0 && skillGaps.length > 0) {
        responseMessage += `**📚 Boost Your Skills:**\n`;
        responseMessage += `I found ${matchedTrainings.length} training courses to help you qualify for even more roles:\n\n`;
        matchedTrainings.slice(0, 2).forEach((training, idx) => {
          responseMessage += `${idx + 1}. **${training.title}**\n`;
          responseMessage += `   by ${training.provider} | ${training.duration} | ${training.level}\n`;
          responseMessage += `   Match Score: ${training.matchScore}%\n`;
        });
        responseMessage += `\n`;
      }
    } else if (messageLower.includes('training') || messageLower.includes('course') || messageLower.includes('learn')) {
      responseMessage += `**Training Recommendations:**\n\n`;
      responseMessage += `Based on your skill gaps and career goals, I've found ${matchedTrainings.length} relevant training courses.\n\n`;
      
      if (matchedTrainings.length > 0) {
        responseMessage += `**Top Training Matches:**\n`;
        matchedTrainings.slice(0, 3).forEach((training, idx) => {
          responseMessage += `\n${idx + 1}. **${training.title}**\n`;
          responseMessage += `   👨‍🏫 ${training.provider} | ⏱️ ${training.duration} | 📊 ${training.level}\n`;
          responseMessage += `   Skills: ${training.skills_covered.slice(0, 3).join(', ')}\n`;
          responseMessage += `   ${training.price ? `💰 KSh ${training.price.toLocaleString()}` : '🆓 Free'} | ⭐ ${training.rating}/5 | 👥 ${training.enrolled_count} enrolled\n`;
          responseMessage += `   Match Score: ${training.matchScore}%\n`;
        });
        responseMessage += `\n💡 **Tip:** Start with high-match courses to quickly fill your skill gaps!\n\n`;
      } else {
        responseMessage += `No specific training courses found yet. Check back soon!\n\n`;
        if (skillGaps.length > 0) {
          responseMessage += `**Skills to Learn:**\n`;
          skillGaps.slice(0, 5).forEach((skill, idx) => {
            responseMessage += `${idx + 1}. ${this.capitalizeSkill(skill)}\n`;
          });
        }
      }
    } else if (messageLower.includes('skill') || messageLower.includes('gap')) {
      responseMessage += `**Skill Gap Analysis:**\n\n`;
      responseMessage += `Your current skills: ${profile.skills?.join(', ') || 'None listed'}\n\n`;
      
      if (skillGaps.length > 0) {
        responseMessage += `**Skills to Learn:**\n`;
        skillGaps.slice(0, 5).forEach((skill, idx) => {
          responseMessage += `${idx + 1}. ${this.capitalizeSkill(skill)}\n`;
        });
        responseMessage += `\n`;

        if (matchedTrainings.length > 0) {
          responseMessage += `**📚 Recommended Training:**\n`;
          matchedTrainings.slice(0, 3).forEach((training, idx) => {
            responseMessage += `${idx + 1}. ${training.title} (${training.duration})\n`;
          });
        }
      } else {
        responseMessage += `✅ Great news! You have all the skills needed for your target roles.\n\n`;
      }
    } else if (messageLower.includes('career') || messageLower.includes('advice') || messageLower.includes('insight') || messageLower.includes('trend')) {
      responseMessage += `**Career Development Insights:**\n\n`;
      responseMessage += `With ${profile.years_of_experience} years as a ${profile.current_position || 'professional'}, here's your personalized roadmap:\n\n`;
      responseMessage += `**📊 Current Market Position:**\n`;
      responseMessage += `• ${matchedJobs.length} job opportunities match your profile\n`;
      responseMessage += `• ${matchedTrainings.length} training courses available for upskilling\n`;
      responseMessage += `• Your profile is ${completeness}% complete\n\n`;
      
      responseMessage += `**🎯 Immediate Actions:**\n`;
      responseMessage += `1. Apply to your top ${Math.min(3, matchedJobs.length)} job matches (70%+ match score)\n`;
      if (matchedTrainings.length > 0) {
        responseMessage += `2. Enroll in ${Math.min(2, matchedTrainings.length)} high-priority training courses\n`;
      }
      if (completeness < 100) {
        responseMessage += `3. Complete your profile to increase visibility (currently ${completeness}%)\n`;
      }
      
      responseMessage += `\n**💼 Market Trends:**\n`;
      if (profile.skills && profile.skills.length > 0) {
        responseMessage += `• Your skills in ${profile.skills.slice(0, 2).join(' and ')} are in demand\n`;
      }
      if (skillGaps.length > 0) {
        responseMessage += `• Emerging skills needed: ${skillGaps.slice(0, 3).map(s => this.capitalizeSkill(s)).join(', ')}\n`;
      }
      responseMessage += `• ${profile.experience_level || 'Mid-level'} roles are actively hiring\n\n`;
      
      responseMessage += `**🚀 Growth Strategy:**\n`;
      responseMessage += `• Build expertise in your core skills\n`;
      responseMessage += `• Expand into complementary areas\n`;
      responseMessage += `• Network with industry professionals\n`;
      responseMessage += `• Keep portfolio and LinkedIn updated\n`;
    } else {
      responseMessage += `I'm here to help with your career journey! I can assist with:\n\n`;
      responseMessage += `💼 **Job Matching** - ${matchedJobs.length} opportunities available\n`;
      responseMessage += `📚 **Training Courses** - ${matchedTrainings.length} courses matched to your needs\n`;
      responseMessage += `🎯 **Skill Development** - ${skillGaps.length} skill gaps identified\n`;
      responseMessage += `📝 **Profile** - ${completeness}% complete\n\n`;
      responseMessage += `**Try asking:**\n`;
      responseMessage += `• "Show me job recommendations"\n`;
      responseMessage += `• "What training courses should I take?"\n`;
      responseMessage += `• "Analyze my skill gaps"\n`;
      responseMessage += `• "Provide career insights for my profile"\n\n`;
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
        `Explore ${this.capitalizeSkill(skill)} online`;
    });
  }

  private capitalizeSkill(skill: string): string {
    return skill.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
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