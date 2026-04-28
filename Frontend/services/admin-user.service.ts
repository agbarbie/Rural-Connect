import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../src/environments/environment.prod';

// Types matching backend
export interface UserManagementFilters {
  search?: string;
  role?: 'All Roles' | 'Admin' | 'Employer' | 'Jobseeker';
  status?: 'All Status' | 'Active' | 'Inactive' | 'Suspended' | 'Pending';
  verification?: 'All Verification' | 'Verified' | 'Pending' | 'Rejected';
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface UserManagementResponse {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Employer' | 'Jobseeker';
  status: 'Active' | 'Inactive' | 'Suspended' | 'Pending';
  created: Date;
  verification: 'Verified' | 'Pending' | 'Rejected';
  avatar?: string;
  location?: string;
  contact_number?: string;
  last_login?: Date;
}

export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  pendingVerification: number;
  suspendedAccounts: number;
  totalUsersChange: number;
  activeUsersChange: number;
  pendingVerificationChange: number;
  suspendedAccountsChange: number;
}

export interface PaginatedUsersResponse {
  success: boolean;
  data: {
    users: UserManagementResponse[];
    stats: UserStats;
    pagination: {
      currentPage: number;
      totalPages: number;
      totalUsers: number;
      limit: number;
    };
  };
  message?: string;
}

export interface UserActionRequest {
  action: 'activate' | 'deactivate' | 'suspend' | 'unsuspend' | 'verify' | 'reject' | 'delete';
  reason?: string;
}

export interface BulkActionRequest {
  userIds: string[];
  action: 'activate' | 'deactivate' | 'suspend' | 'unsuspend' | 'verify' | 'reject' | 'delete';
  reason?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AdminUserService {
  private apiUrl = `${environment.apiUrl}/admin/users`;

  constructor(private http: HttpClient) {}

  /**
   * Get authentication headers with token
   */
  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json'
    });
  }

  /**
   * Build HTTP params from filters
   */
  private buildParams(filters: UserManagementFilters): HttpParams {
    let params = new HttpParams();

    if (filters.search) {
      params = params.set('search', filters.search);
    }
    if (filters.role && filters.role !== 'All Roles') {
      params = params.set('role', filters.role);
    }
    if (filters.status && filters.status !== 'All Status') {
      params = params.set('status', filters.status);
    }
    if (filters.verification && filters.verification !== 'All Verification') {
      params = params.set('verification', filters.verification);
    }
    if (filters.page) {
      params = params.set('page', filters.page.toString());
    }
    if (filters.limit) {
      params = params.set('limit', filters.limit.toString());
    }
    if (filters.sortBy) {
      params = params.set('sortBy', filters.sortBy);
    }
    if (filters.sortOrder) {
      params = params.set('sortOrder', filters.sortOrder);
    }

    return params;
  }

  /**
   * Get all users with filtering and pagination
   */
  getUsers(filters: UserManagementFilters = {}): Observable<PaginatedUsersResponse> {
    const headers = this.getAuthHeaders();
    const params = this.buildParams(filters);

    return this.http.get<PaginatedUsersResponse>(this.apiUrl, { headers, params })
      .pipe(
        tap(response => {
          console.log('Fetched users:', response.data.users.length);
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Get user statistics
   */
  getUserStats(): Observable<{ success: boolean; data: { stats: UserStats } }> {
    const headers = this.getAuthHeaders();

    return this.http.get<{ success: boolean; data: { stats: UserStats } }>(
      `${this.apiUrl}/stats`,
      { headers }
    ).pipe(
      tap(response => {
        console.log('Fetched user stats:', response.data.stats);
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Get detailed user information by ID
   */
  getUserById(userId: string): Observable<any> {
    const headers = this.getAuthHeaders();

    return this.http.get(`${this.apiUrl}/${userId}`, { headers })
      .pipe(
        tap(response => {
          console.log('Fetched user details:', response);
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Update user information
   */
  updateUser(userId: string, updateData: any): Observable<any> {
    const headers = this.getAuthHeaders();

    return this.http.put(`${this.apiUrl}/${userId}`, updateData, { headers })
      .pipe(
        tap(response => {
          console.log('User updated:', response);
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Perform action on a single user
   */
  performUserAction(userId: string, actionData: UserActionRequest): Observable<any> {
    const headers = this.getAuthHeaders();

    return this.http.post(`${this.apiUrl}/${userId}/action`, actionData, { headers })
      .pipe(
        tap(response => {
          console.log('User action performed:', response);
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Perform bulk action on multiple users
   */
  performBulkAction(bulkActionData: BulkActionRequest): Observable<any> {
    const headers = this.getAuthHeaders();

    return this.http.post(`${this.apiUrl}/bulk-action`, bulkActionData, { headers })
      .pipe(
        tap(response => {
          console.log('Bulk action performed:', response);
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Permanently delete a user
   */
  deleteUserPermanently(userId: string, confirmationToken: string): Observable<any> {
    const headers = this.getAuthHeaders();
    const body = {
      confirmationToken,
      expectedToken: confirmationToken
    };

    return this.http.delete(`${this.apiUrl}/${userId}/permanent`, { headers, body })
      .pipe(
        tap(response => {
          console.log('User permanently deleted:', response);
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Export users data as CSV
   */
  exportUsers(filters: UserManagementFilters = {}): Observable<Blob> {
    const headers = this.getAuthHeaders();
    const params = this.buildParams(filters);

    return this.http.get(`${this.apiUrl}/export`, {
      headers,
      params,
      responseType: 'blob'
    }).pipe(
      tap(() => {
        console.log('Users exported successfully');
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Helper method to activate a user
   */
  activateUser(userId: string, reason?: string): Observable<any> {
    return this.performUserAction(userId, { action: 'activate', reason });
  }

  /**
   * Helper method to deactivate a user
   */
  deactivateUser(userId: string, reason?: string): Observable<any> {
    return this.performUserAction(userId, { action: 'deactivate', reason });
  }

  /**
   * Helper method to suspend a user
   */
  suspendUser(userId: string, reason?: string): Observable<any> {
    return this.performUserAction(userId, { action: 'suspend', reason });
  }

  /**
   * Helper method to unsuspend a user
   */
  unsuspendUser(userId: string, reason?: string): Observable<any> {
    return this.performUserAction(userId, { action: 'unsuspend', reason });
  }

  /**
   * Helper method to verify a user
   */
  verifyUser(userId: string): Observable<any> {
    return this.performUserAction(userId, { action: 'verify' });
  }

  /**
   * Helper method to reject user verification
   */
  rejectUser(userId: string, reason?: string): Observable<any> {
    return this.performUserAction(userId, { action: 'reject', reason });
  }

  /**
   * Helper method to soft delete a user
   */
  deleteUser(userId: string, reason?: string): Observable<any> {
    return this.performUserAction(userId, { action: 'delete', reason });
  }

  /**
   * Error handling
   */
  private handleError(error: HttpErrorResponse) {
    console.error('Admin user service error:', error);

    let errorMessage = 'An error occurred';

    if (error.status === 0) {
      errorMessage = 'Cannot connect to server. Please check your connection.';
    } else if (error.error?.message) {
      errorMessage = error.error.message;
    } else if (error.message) {
      errorMessage = error.message;
    }

    return throwError(() => new Error(errorMessage));
  }
}