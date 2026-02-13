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
  private isRefreshing = false;
  private refreshQueue: Array<{ req: HttpRequest<any>; next: HttpHandler; observer: any }> = [];

  private addAuthHeader(req: HttpRequest<any>, token: string): HttpRequest<any> {
    return req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token}`)
    });
  }

  private queueRequest(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return new Observable(observer => {
      this.refreshQueue.push({ req, next, observer });
    });
  }

  private processQueue(token?: string) {
    this.refreshQueue.forEach(entry => {
      if (token) {
        const authReq = this.addAuthHeader(entry.req, token);
        entry.next.handle(authReq).subscribe({
          next: v => entry.observer.next(v),
          error: e => entry.observer.error(e),
          complete: () => entry.observer.complete()
        });
      } else {
        entry.observer.error(new Error('No token available after refresh'));
      }
    });
    this.refreshQueue = [];
  }

  private attemptTokenRefresh(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (this.isRefreshing) {
      return this.queueRequest(req, next);
    }

    this.isRefreshing = true;

    return new Observable(observer => {
      // Expect AuthService to expose a refreshToken() that may return an Observable, a Promise, or nothing.
      const refreshResult: any = (this.authService.refreshToken as any)?.();

      const handleSuccess = (res: any) => {
        const newToken = res?.token || res?.accessToken || null;

        if (newToken) {
          // Try common setter names if present on the service (safe optional calls).
          try { this.authService.setToken?.(newToken); } catch {}
          try { this.authService.updateToken?.(newToken); } catch {}
          try { this.authService.storeToken?.(newToken); } catch {}

          this.processQueue(newToken);

          const authReq = this.addAuthHeader(req, newToken);
          next.handle(authReq).subscribe({
            next: v => observer.next(v),
            error: e => observer.error(e),
            complete: () => observer.complete()
          });
        } else {
          // If no token returned, force logout and fail queued requests
          this.authService.logout().subscribe({ complete: () => this.router.navigate(['/login']) });
          this.processQueue();
          observer.error(new Error('Token refresh did not return a token'));
        }
      };

      const handleError = (err: any) => {
        // On refresh error, clear auth and redirect to login
        this.authService.logout().subscribe({ complete: () => this.router.navigate(['/login']) });
        this.processQueue();
        observer.error(err);
      };

      const finalize = () => {
        this.isRefreshing = false;
      };

      if (refreshResult && typeof refreshResult.subscribe === 'function') {
        // Observable
        refreshResult.subscribe({
          next: handleSuccess,
          error: handleError,
          complete: finalize
        });
      } else if (refreshResult && typeof refreshResult.then === 'function') {
        // Promise
        refreshResult.then((res: any) => {
          handleSuccess(res);
          finalize();
        }).catch((err: any) => {
          handleError(err);
          finalize();
        });
      } else {
        // No observable/promise returned — try synchronous retrieval from the service or fail.
        const maybeToken = this.authService.getToken?.();
        if (maybeToken) {
          try { this.authService.setToken?.(maybeToken); } catch {}
          try { this.authService.updateToken?.(maybeToken); } catch {}
          try { this.authService.storeToken?.(maybeToken); } catch {}

          this.processQueue(maybeToken);

          const authReq = this.addAuthHeader(req, maybeToken);
          next.handle(authReq).subscribe({
            next: v => { observer.next(v); },
            error: e => { observer.error(e); },
            complete: () => { observer.complete(); this.isRefreshing = false; }
          });
        } else {
          this.authService.logout().subscribe({ complete: () => this.router.navigate(['/login']) });
          this.processQueue();
          this.isRefreshing = false;
          observer.error(new Error('refreshToken did not return an observable/promise and no token available'));
        }
      }
    });
  }
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