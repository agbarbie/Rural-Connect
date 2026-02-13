import { Injectable } from '@angular/core';
import { Router, CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    
    console.log('AuthGuard: Checking authentication for:', state.url);
    
    if (this.authService.isAuthenticated()) {
      const userType = this.authService.getUserType();
      const requiredRole = route.data['role'] as string;
      
      console.log('User authenticated:', { userType, requiredRole });
      
      if (requiredRole && userType !== requiredRole) {
        console.warn(`Access denied: User type ${userType} cannot access ${requiredRole} route`);
        
        // Redirect to their own dashboard
        switch (userType) {
          case 'jobseeker':
            return this.router.createUrlTree(['/jobseeker/dashboard']);
          case 'employer':
            return this.router.createUrlTree(['/employer/employer-dashboard']);
          case 'admin':
            return this.router.createUrlTree(['/admin/dashboard']);
          default:
            return this.router.createUrlTree(['/auth']);
        }
      }
      
      return true;
    }
    
    console.warn('User not authenticated, redirecting to auth page');
    // Store the attempted URL for redirecting after login
    localStorage.setItem('redirectUrl', state.url);
    return this.router.createUrlTree(['/auth']);
  }
}