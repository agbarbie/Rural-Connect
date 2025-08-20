import { Routes } from '@angular/router';
import { LandingComponent } from './components/landing/landing.component';
import { AuthComponent } from './components/auth/auth.component';
import { ResetPasswordComponent } from './components/reset-password/reset-password.component';
import { DashboardComponent } from './components/jobseeker/dashboard/dashboard.component';
import { JobExplorerComponent } from './components/jobseeker/job-explorer/job-explorer.component';
import { TrainingComponent as JobseekerTrainingComponent } from './components/jobseeker/training/training.component';
import { EmployerDashboardComponent } from './components/employer/employer-dashboard/employer-dashboard.component';
import { TrainingComponent as EmployerTrainingComponent } from './components/employer/training/training.component';
import { AiAssistantComponent as EmployerAiAssistantComponent } from './components/employer/ai-assistant/ai-assistant.component';
import { CandidatesComponent } from './components/employer/candidates/candidates.component';
import { InterviewsComponent } from './components/employer/interviews/interviews.component';
import { SettingsComponent } from './components/employer/settings/settings.component';
import { CvBuilderComponent } from './components/jobseeker/cv-builder/cv-builder.component';
import { PortfolioComponent } from './components/jobseeker/portfolio/portfolio.component';
import { AiAssistantComponent as JobseekerAiAssistantComponent } from './components/jobseeker/ai-assistant/ai-assistant.component';
import { PostJobComponent } from './components/employer/post-job/post-job.component';
import { DashboardComponent as AdminDashboardComponent } from './components/admin/dashboard/dashboard.component';

export const routes: Routes = [
  { path: '', component: LandingComponent },
  { path: 'auth', component: AuthComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: 'jobseeker', redirectTo: 'jobseeker/dashboard' },
  { path: 'jobseeker/dashboard', component: DashboardComponent },
  { path: 'jobseeker/job-explorer', component: JobExplorerComponent },
  { path: 'job-explorer', redirectTo: 'jobseeker/job-explorer' },
  { path: 'jobseeker/training', component: JobseekerTrainingComponent },
  { path: 'employer', redirectTo: 'employer/employer-dashboard' },
  { path: 'employer/employer-dashboard', component: EmployerDashboardComponent },
  { path: 'employer/training', component: EmployerTrainingComponent },
  { path: 'employer/ai-assistant', component: EmployerAiAssistantComponent },
  { path: 'employer/candidates', component: CandidatesComponent },
  { path: 'employer/interviews', component: InterviewsComponent },
  { path: 'employer/settings', component: SettingsComponent },
  { path: 'jobseeker/cv-builder', component: CvBuilderComponent },
  { path: 'jobseeker/portfolio', component: PortfolioComponent },
  { path: 'jobseeker/ai-assistant', component: JobseekerAiAssistantComponent },
  { path: 'employer/post-job', component: PostJobComponent },
  { path: 'employer/post-job', redirectTo: 'employer/post-job', pathMatch: 'full' },
  {path: 'admin/dashboard', component: AdminDashboardComponent},
  { path: '**', redirectTo: '' },
];