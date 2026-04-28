interface JobOpportunity {
  type: 'Remote' | 'Training' | 'Online';
  title: string;
  description: string;
  company: string;
  level: string;
  timeCommitment: string;
  compensation: string | number;
  isFree?: boolean;
  rating: number;  
}
