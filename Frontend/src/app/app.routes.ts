import { Routes } from '@angular/router';
import { LandingComponent } from './components/landing/landing.component';
import { AuthComponent } from './components/auth/auth.component';
import { ResetPasswordComponent } from './components/reset-password/reset-password.component';
import { DashboardComponent } from './components/jobseeker/dashboard/dashboard.component';
import { JobExplorerComponent } from './components/jobseeker/job-explorer/job-explorer.component';
import { TrainingComponent as JobseekerTrainingComponent } from './components/jobseeker/training/training.component';
import { CvBuilderComponent } from './components/jobseeker/cv-builder/cv-builder.component';
import { PortfolioComponent } from './components/jobseeker/portfolio/portfolio.component';
import { AiAssistantComponent as JobseekerAiAssistantComponent } from './components/jobseeker/ai-assistant/ai-assistant.component';
import { DashboardComponent as AdminDashboardComponent } from './components/admin/dashboard/dashboard.component';
import { EmployerDashboardComponent } from './components/employer/employer-dashboard/employer-dashboard.component';
import { PostJobsComponent } from './components/employer/post-jobs/post-jobs.component';
import { TrainingComponent } from './components/employer/training/training.component';

export const routes: Routes = [
  { path: '', component: LandingComponent },
  { path: 'auth', component: AuthComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  
  // Jobseeker routes
  { path: 'jobseeker', redirectTo: '/jobseeker/dashboard', pathMatch: 'full' },
  { path: 'jobseeker/dashboard', component: DashboardComponent },
  { path: 'jobseeker/job-explorer', component: JobExplorerComponent },
  { path: 'job-explorer', redirectTo: '/jobseeker/job-explorer', pathMatch: 'full' },
  { path: 'jobseeker/training', component: JobseekerTrainingComponent },
  { path: 'jobseeker/cv-builder', component: CvBuilderComponent },
  { path: 'jobseeker/portfolio', component: PortfolioComponent },
  { path: 'jobseeker/ai-assistant', component: JobseekerAiAssistantComponent },
  
  // Admin routes
  { path: 'admin/dashboard', component: AdminDashboardComponent },
  
  // Employer routes
  { path: 'employer', redirectTo: '/employer/employer-dashboard', pathMatch: 'full' },
  { path: 'employer/employer-dashboard', component: EmployerDashboardComponent },
  { path: 'employer/post-jobs', component: PostJobsComponent },
  {path: 'employer/training', component:TrainingComponent},
  
  // Alternative shorter routes for employer (in case the issue is with long paths)
  { path: 'post-jobs', component: PostJobsComponent },
  
  // Wildcard route - should be last
  { path: '**', redirectTo: '/' }
];