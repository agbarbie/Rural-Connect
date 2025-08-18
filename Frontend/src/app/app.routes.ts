import { Routes } from '@angular/router';
import { LandingComponent } from './components/landing/landing.component';
import { AuthComponent } from './components/auth/auth.component';
import { ResetPasswordComponent } from './components/reset-password/reset-password.component';
import { DashboardComponent } from './components/jobseeker/dashboard/dashboard.component';
import { JobExplorerComponent } from './components/jobseeker/job-explorer/job-explorer.component';
import { TrainingComponent as JobseekerTrainingComponent } from './components/jobseeker/training/training.component';
import { EmployerDashboardComponent } from './components/employer/employer-dashboard/employer-dashboard.component';
import { TrainingComponent as EmployerTrainingComponent } from './components/employer/training/training.component';
import { PostJobComponent } from './components/employer/post-job/post-job.component'; 

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
  { path: 'employer/post-job', component: PostJobComponent }, 
];