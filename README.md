# Digital Skilling APP - Simplified Project Structure

## Root Directory
```
digital-skilling-app/
├── frontend/           # Angular 19 App
├── backend/            # Express.js TypeScript API
├── shared/             # Shared types
└── README.md
```

## Frontend Structure (Angular 19 - Standalone)

```
frontend/
├── src/
│   ├── app/
│   │   ├── components/          # All Components
│   │   │   ├── landing/
│   │   │   │   ├── landing.component.ts
│   │   │   │   ├── landing.component.html
│   │   │   │   └── landing.component.css
│   │   │   ├── auth/
│   │   │   │   ├── auth.component.ts
│   │   │   │   ├── auth.component.html
│   │   │   │   ├── auth.component.css
<!-- │   │   │   ├── shared/
│   │   │   │   ├── header.component.ts
│   │   │   │   ├── header.component.html
│   │   │   │   ├── header.component.css
│   │   │   │   ├── sidebar.component.ts
│   │   │   │   ├── sidebar.component.html
│   │   │   │   └── sidebar.component.css -->
│   │   │   ├── jobseeker/
│   │   │   │   ├── dashboard.component.ts
│   │   │   │   ├── dashboard.component.html
│   │   │   │   ├── dashboard.component.css
│   │   │   │   ├── profile.component.ts
│   │   │   │   ├── profile.component.html
│   │   │   │   ├── profile.component.css
│   │   │   │   ├── job-explorer.component.ts
│   │   │   │   ├── job-explorer.component.html
│   │   │   │   ├── job-explorer.component.css
│   │   │   │   ├── portfolio.component.ts
│   │   │   │   ├── portfolio.component.html
│   │   │   │   ├── portfolio.component.css
│   │   │   │   ├── cv-builder.component.ts
│   │   │   │   ├── cv-builder.component.html
│   │   │   │   ├── cv-builder.component.css
│   │   │   │   ├── training.component.ts
│   │   │   │   ├── training.component.html
│   │   │   │   ├── training.component.css
│   │   │   │   ├── ai assistant.component.html
│   │   │   │   ├── ai assistant.component.css
│   │   │   │   ├── ai assistant.component.ts
│   │   │   │   ├── settings.component.ts
│   │   │   │   ├── settings.component.html
│   │   │   │   └── settings.component.css
│   │   │   ├── employer/
│   │   │   │   ├── employer-dashboard.component.ts
│   │   │   │   ├── employer-dashboard.component.html
│   │   │   │   ├── employer-dashboard.component.css
│   │   │   │   ├── post-job.component.ts
│   │   │   │   ├── post-job.component.html
│   │   │   │   ├── post-job.component.css
│   │   │   │   ├── candidates.component.ts
│   │   │   │   ├── candidates.component.html
│   │   │   │   ├── candidates.component.css
│   │   │   │   ├── interviews.component.ts
│   │   │   │   ├── interviews.component.html
│   │   │   │   ├── interviews.component.css
│   │   │   │   ├── training.component.ts
│   │   │   │   ├── training.component.html
│   │   │   │   ├── training.component.css
│   │   │   │   ├── ai assistant.component.html
│   │   │   │   ├── ai assistant.component.css
│   │   │   │   ├── ai assistant.component.ts
│   │   │   │   ├── settings.component.ts
│   │   │   │   ├── settings.component.html
│   │   │   │   └── settings.component.css
                    company-profile.ts
                    company-profile.html
                    company-profile.css

│   │   │   └── admin/
│   │   │       ├── dashboard.component.ts
│   │   │       ├── dashboard.component.html
│   │   │       ├── dashboard.component.css
│   │   │       ├── users.component.ts
│   │   │       ├── users.component.html
│   │   │       ├── users.component.css
│   │   │       ├── jobs.component.ts
│   │   │       ├── jobs.component.html
│   │   │       ├── jobs.component.css
│   │   │       ├── settings.component.ts
│   │   │       ├── settings.component.html
│   │   │       └── settings.component.css
│   │   ├── services/            # All Services
│   │   │   ├── auth.service.ts
│   │   │   ├── user.service.ts
│   │   │   ├── job.service.ts
│   │   │   ├── application.service.ts
│   │   │   ├── interview.service.ts
│   │   │   ├── training.service.ts
│   │   │   ├── portfolio.service.ts
│   │   │   ├── ai.service.ts
│   │   │   └── notification.service.ts
│   │   ├── guards/              # Route Guards
│   │   │   ├── auth.guard.ts
│   │   │   └── role.guard.ts
│   │   ├── models/              # TypeScript Models
│   │   │   ├── user.type.ts
│   │   │   ├── job.type.ts
│   │   │   ├── application.type.ts
│   │   │   ├── interview.type.ts
│   │   │   ├── training.type.ts
│   │   │   └── portfolio.type.ts
│   │   ├── app.component.ts
│   │   ├── app.component.html
│   │   ├── app.component.css
│   │   ├── app.config.ts
│   │   └── app.routes.ts
│   ├── assets/
│   │   ├── images/
│   │   └── icons/
│   ├── styles.css               # Global styles
│   ├── index.html
│   └── main.ts
├── angular.json
├── package.json
├── tsconfig.json

```

## Backend Structure (Express.js TypeScript)

```
backend/
├── src/
│   ├── controllers/             # Route Handlers
│   │   ├── auth.controller.ts
│   │   ├── user.controller.ts
│   │   ├── job.controller.ts
│   │   ├── application.controller.ts
│   │   ├── interview.controller.ts
│   │   ├── training.controller.ts
│   │   ├── portfolio.controller.ts
│   │   ├── ai.controller.ts
│   │   ├── notification.controller.ts
│   │   ├── cv-builder.controller.ts
│   │   ├── employer.controller.ts
│   │   ├── company.controller.ts
│   │   └── admin.controller.ts
│   ├── routes/                  # API Routes
│   │   ├── auth.routes.ts
│   │   ├── user.routes.ts
│   │   ├── job.routes.ts
│   │   ├── application.routes.ts
│   │   ├── interview.routes.ts
│   │   ├── training.routes.ts
│   │   ├── portfolio.routes.ts
│   │   ├── ai.routes.ts
│   │   ├── notification.routes.ts
│   │   ├── cv-builder.routes.ts
│   │   ├── employer.routes.ts
│   │   ├── company.routes.ts
│   │   └── admin.routes.ts
│   ├── types/                
│   │   ├── user.type.ts
│   │   ├── job.type.ts
│   │   ├── application.type.ts
│   │   ├── interview.type.ts
│   │   ├── training.type.ts
│   │   ├── portfolio.type.ts
│   │   ├── notification.type.ts
│   │   ├── cv.type.ts
│   │   ├── company.type.ts
│   │   └── skill.type.ts
│   ├── services/                # Business Logic
│   │   ├── auth.service.ts
│   │   ├── user.service.ts
│   │   ├── job.service.ts
│   │   ├── application.service.ts
│   │   ├── interview.service.ts
│   │   ├── training.service.ts
│   │   ├── portfolio.service.ts
│   │   ├── ai.service.ts
│   │   ├── email.service.ts
│   │   ├── notification.service.ts
│   │   ├── cv-builder.service.ts
│   │   ├── company.service.ts
│   │   └── file-upload.service.ts
│   ├── middleware/              # Middleware
│   │   ├── auth.middleware.ts
│   │   ├── role.middleware.ts
│   │   ├── validation.middleware.ts
│   │   ├── upload.middleware.ts
│   │   ├── cors.middleware.ts
│   │   └── error.middleware.ts
│   ├── config/                  # Configuration
│   │   ├── database.config.ts
│   │   ├── jwt.config.ts
│   │   ├── multer.config.ts
│   │   ├── email.config.ts
│   │   └── app.config.ts
│   ├── utils/                   # Utilities
│   │   ├── logger.ts
│   │   ├── validation.ts
│   │   ├── helpers.ts
│   │   ├── email-templates.ts
│   │   └── constants.ts
│   ├── app.ts                   # Express App Setup
│   └── server.ts                # Server Entry Point
├── uploads/                     # File Uploads Directory
│   ├── profiles/
│   ├── cvs/
│   ├── portfolios/
│   └── company-logos/
├── tests/                       # Test Files
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── .env.example
├── .env
├── .gitignore
├── package.json
├── tsconfig.json
├── nodemon.json
└── README.md
```

## Shared Types

```
shared/
├── types/
│   ├── user.types.ts
│   ├── job.types.ts
│   ├── application.types.ts
│   ├── interview.types.ts
│   ├── training.types.ts
│   ├── portfolio.types.ts
│   └── api.types.ts
└── package.json
```

## Simple Component Examples

### Angular Standalone Component
```typescript
// login.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  email = '';
  password = '';
  
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}
  
  onLogin() {
    this.authService.login(this.email, this.password).subscribe({
      next: (response) => {
        this.router.navigate(['/dashboard']);
      },
      error: (error) => {
        console.error('Login failed', error);
      }
    });
  }
}
```

### Simple Route Configuration
```typescript
// app.routes.ts
import { Routes } from '@angular/router';
import { LoginComponent } from './components/auth/login.component';
import { JobseekerDashboardComponent } from './components/jobseeker/dashboard.component';
import { EmployerDashboardComponent } from './components/employer/dashboard.component';
import { AdminDashboardComponent } from './components/admin/dashboard.component';
import { AuthGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { 
    path: 'jobseeker', 
    component: JobseekerDashboardComponent,
    canActivate: [AuthGuard]
  },
  { 
    path: 'employer', 
    component: EmployerDashboardComponent,
    canActivate: [AuthGuard]
  },
  { 
    path: 'admin', 
    component: AdminDashboardComponent,
    canActivate: [AuthGuard]
  }
];
```

### Express Controller Example
```typescript
// auth.controller.ts
import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';

export class AuthController {
  private authService = new AuthService();

  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      const result = await this.authService.login(email, password);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async register(req: Request, res: Response) {
    try {
      const userData = req.body;
      const result = await this.authService.register(userData);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
}
```

## Key Features by User Type

### Jobseeker Features
- **Dashboard**: Overview of applications, interviews, recommendations
- **Profile**: Complete personal and professional information
- **Job Search**: Browse and apply for jobs
- **Applications**: Track application status
- **Portfolio**: Upload projects, certificates, skills
- **CV Builder**: Create and download CV
- **Interviews**: View scheduled interviews
- **Training**: Access training programs
- **Settings**: Account preferences

### Employer Features
- **Dashboard**: Overview of posted jobs, applications
- **Post Job**: Create job listings and training opportunities
- **Manage Jobs**: Edit and manage job postings
- **Candidates**: Review job applications and profiles
- **Interviews**: Schedule and manage interviews
- **Training**: Create and manage training programs
- **Settings**: Company profile and preferences

### Admin Features
- **Dashboard**: System overview and statistics
- **Users**: Manage jobseekers and employers
- **Jobs**: Monitor and approve job postings
- **Settings**: System configuration

## Technology Stack

### Frontend
- **Angular 19** with Standalone Components
- **TypeScript**
- **Tailwind CSS** for styling
- **Angular Material** for UI components

### Backend
- **Node.js** with **Express.js**
- **TypeScript**
- **PostgreSQL** or **MongoDB**
- **JWT** for authentication
- **Multer** for file uploads

### AI Integration
- **Python** with **Flask** or **FastAPI**
- **scikit-learn** for recommendations
- **OpenAI API** for advanced AI features

This simplified structure is much easier to understand and implement while still covering all your requirements!