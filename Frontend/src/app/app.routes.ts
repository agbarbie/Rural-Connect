import { Routes } from '@angular/router';
import { LandingComponent } from './components/landing/landing.component';
import { AuthComponent } from './components/auth/auth.component';
import { ResetPasswordComponent } from './components/reset-password/reset-password.component';

export const routes: Routes = [
 { path: '', component: LandingComponent },
 { path: 'auth', component: AuthComponent },
 { path: 'reset-password', component: ResetPasswordComponent },
];
