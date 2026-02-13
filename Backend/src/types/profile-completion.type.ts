// src/types/profile-completion.type.ts

export interface ProfileCompletionResult {
  completion: number;
  missingFields: string[];
  completedSections: CompletedSection[];
  recommendations: string[];
}

export interface CompletedSection {
  name: string;
  completed: boolean;
  weight: number;
  fields?: FieldStatus[];
}

export interface FieldStatus {
  field: string;
  completed: boolean;
  required: boolean;
}

export interface ProfileCompletionResponse {
  success: boolean;
  message?: string;
  data?: ProfileCompletionResult;
}

