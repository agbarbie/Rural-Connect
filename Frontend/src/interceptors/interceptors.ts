// src/app/core/interceptors/auth.interceptor.ts
import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = this.authService.getToken();

    // Debug logging (remove in production)
    console.log('🔒 Auth Interceptor:', {
      url: req.url,
      method: req.method,
      hasToken: !!token,
      tokenPreview: token ? `${token.substring(0, 15)}...` : 'No token'
    });

    if (token) {
      const authReq = req.clone({
        headers: req.headers.set('Authorization', `Bearer ${token}`)
      });

      console.log('✅ Token attached to request');

      return next.handle(authReq).pipe(
        tap(() => {
          // Request successful
        }),
        catchError((error: HttpErrorResponse) => {
          return this.handleError(error, req);
        })
      );
    }

    console.log('⚠️ No token available, proceeding without Authorization header');
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        return this.handleError(error, req);
      })
    );
  }

  private handleError(error: HttpErrorResponse, req: HttpRequest<any>): Observable<never> {
    console.error('❌ HTTP Error:', {
      status: error.status,
      url: req.url,
      message: error.message
    });

    if (error.status === 401) {
      console.error('🚫 Unauthorized - Token invalid or expired');
      
      // Clear auth data and redirect to login
      this.authService.logout().subscribe({
        next: () => {
          console.log('Logged out due to 401 error');
        },
        error: (logoutError) => {
          console.error('Error during logout:', logoutError);
        },
        complete: () => {
          // Redirect to login with return URL
          const returnUrl = this.router.url;
          this.router.navigate(['/login'], {
            queryParams: { returnUrl }
          });
        }
      });
    }

    if (error.status === 403) {
      console.error('🚫 Forbidden - Access denied');
    }

    if (error.status === 0) {
      console.error('🔌 Network error - Cannot connect to server');
    }

    return throwError(() => error);
  }
}