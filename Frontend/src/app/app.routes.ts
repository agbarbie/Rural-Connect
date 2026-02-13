import { Routes } from '@angular/router';
import { LandingComponent } from './components/landing/landing.component';
import { AuthComponent } from './components/auth/auth.component';
import { ResetPasswordComponent } from './components/reset-password/reset-password.component';
import { DashboardComponent } from './components/jobseeker/dashboard/dashboard.component';
import { JobExplorerComponent } from './components/jobseeker/job-explorer/job-explorer.component';
import { TrainingComponent as JobseekerTrainingComponent } from './components/jobseeker/training/training.component';
import { CvBuilderComponent } from './components/jobseeker/cv-builder/cv-builder.component';
import { PortfolioComponent } from './components/jobseeker/portfolio/portfolio.component';
import { ProfileComponent } from './components/jobseeker/profile/profile.component';
import { AiAssistantComponent as JobseekerAiAssistantComponent } from './components/jobseeker/ai-assistant/ai-assistant.component';
import { DashboardComponent as AdminDashboardComponent } from './components/admin/dashboard/dashboard.component';
import { EmployerDashboardComponent } from './components/employer/employer-dashboard/employer-dashboard.component';
import { PostJobsComponent } from './components/employer/post-jobs/post-jobs.component';
import { TrainingComponent } from './components/employer/training/training.component';
import { AiAssistantComponent } from './components/employer/ai-assistant/ai-assistant.component';
import { CandidatesComponent } from './components/employer/candidates/candidates.component';
import { InterviewsComponent } from './components/employer/interviews/interviews.component';
import { CompanyProfileComponent } from './components/employer/company-profile/company-profile.component';
import { UsersComponent } from './components/admin/users/users.component';
import { MeetingRoomComponent } from './components/employer/meeting-room/meeting-room.component';

// import { CandidateProfileComponent } from './components/employer/candidate-profile/candidate-profile.component';
import { AuthGuard } from '../guards/auth.guards';

export const routes: Routes = [
  // Public routes
  { path: '', component: LandingComponent },
  { path: 'auth', component: AuthComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  
  // Jobseeker routes - Protected
  { 
    path: 'jobseeker', 
    redirectTo: '/jobseeker/dashboard', 
    pathMatch: 'full' 
  },
  { 
    path: 'jobseeker/dashboard', 
    component: DashboardComponent,
    canActivate: [AuthGuard],
    data: { role: 'jobseeker' }
  },
  { 
    path: 'jobseeker/job-explorer', 
    component: JobExplorerComponent,
    canActivate: [AuthGuard],
    data: { role: 'jobseeker' }
  },
  { 
    path: 'job-explorer', 
    redirectTo: '/jobseeker/job-explorer', 
    pathMatch: 'full' 
  },
  { 
    path: 'jobseeker/training', 
    component: JobseekerTrainingComponent,
    canActivate: [AuthGuard],
    data: { role: 'jobseeker' }
  },
  { 
    path: 'jobseeker/cv-builder', 
    component: CvBuilderComponent,
    canActivate: [AuthGuard],
    data: { role: 'jobseeker' }
  },
  { 
    path: 'jobseeker/portfolio', 
    component: PortfolioComponent,
    canActivate: [AuthGuard],
    data: { role: 'jobseeker' }
  },
  { 
    path: 'jobseeker/ai-assistant', 
    component: JobseekerAiAssistantComponent,
    canActivate: [AuthGuard],
    data: { role: 'jobseeker' }
  },
  { 
    path: 'jobseeker/profile', 
    component: ProfileComponent,
    canActivate: [AuthGuard],
    data: { role: 'jobseeker' }
  },

  // Admin routes - Protected
  { 
    path: 'admin', 
    redirectTo: '/admin/dashboard', 
    pathMatch: 'full' 
  },
  { 
    path: 'admin/dashboard', 
    component: AdminDashboardComponent,
    canActivate: [AuthGuard],
    data: { role: 'admin' }
  },
  { 
    path: 'admin/users', 
    component: UsersComponent,
    canActivate: [AuthGuard],
    data: { role: 'admin' }
  },
  { 
    path: 'admin/security', 
    redirectTo: '/admin/dashboard', 
    pathMatch: 'full' 
  },
  { 
    path: 'admin/ai-monitoring', 
    redirectTo: '/admin/dashboard', 
    pathMatch: 'full' 
  },
  { 
    path: 'admin/system-metrics', 
    redirectTo: '/admin/dashboard', 
    pathMatch: 'full' 
  },
  { 
    path: 'admin/settings', 
    redirectTo: '/admin/dashboard', 
    pathMatch: 'full' 
  },
  
  // Employer routes - Protected
  { 
    path: 'employer', 
    redirectTo: '/employer/employer-dashboard', 
    pathMatch: 'full' 
  },
  { 
    path: 'employer/employer-dashboard', 
    component: EmployerDashboardComponent,
    canActivate: [AuthGuard],
    data: { role: 'employer' }
  },
  { 
    path: 'employer/post-jobs', 
    component: PostJobsComponent,
    canActivate: [AuthGuard],
    data: { role: 'employer' }
  },
  { 
    path: 'employer/training', 
    component: TrainingComponent,
    canActivate: [AuthGuard],
    data: { role: 'employer' }
  },
   {
    path: 'meeting/:trainingId/:sessionId/:roomCode',
    component: MeetingRoomComponent
  },
  { 
    path: 'employer/ai-assistant', 
    component: AiAssistantComponent,
    canActivate: [AuthGuard],
    data: { role: 'employer' }
  },
  { 
    path: 'employer/candidates', 
    component: CandidatesComponent,
    canActivate: [AuthGuard],
    data: { role: 'employer' }
  },
  { 
    path: 'employer/interviews', 
    component: InterviewsComponent,
    canActivate: [AuthGuard],
    data: { role: 'employer' }
  },
  { 
    path: 'employer/company-profile', 
    component: CompanyProfileComponent,
    canActivate: [AuthGuard],
    data: { role: 'employer' }
  },
  // { 
  //   path: 'employer/candidate-profile/:id', 
  //   component: CandidateProfileComponent,
  //   canActivate: [AuthGuard],
  //   data: { role: 'employer' }
  // },
  { 
    path: 'post-jobs', 
    component: PostJobsComponent,
    canActivate: [AuthGuard],
    data: { role: 'employer' }
  },
  
  // Wildcard route - should be last
  { path: '**', redirectTo: '/auth' } // Changed from '/' to '/auth'
];