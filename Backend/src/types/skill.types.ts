export interface Skill {
  id: string;
  name: string;
  category?: string;
  description?: string;
  is_active: boolean;
  created_at: Date;
}

export interface CreateSkillRequest {
  name: string;
  category?: string;
  description?: string;
  is_active?: boolean;
}

export interface UpdateSkillRequest extends Partial<CreateSkillRequest> {}

export interface SkillStats {
  total_skills: number;
  popular_skills: Array<{
    skill: string;
    count: number;
  }>;
  skills_by_category: Array<{
    category: string;
    count: number;
  }>;
}

export interface SkillQuery {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
  is_active?: boolean;
}