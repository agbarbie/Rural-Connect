// User Management Types for Admin Dashboard

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

export interface UserDetailResponse {
  success: boolean;
  data: {
    user: UserManagementResponse;
    profile?: any; // Jobseeker or Employer specific data
    activityLog?: ActivityLog[];
  };
  message?: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  details: string;
  performed_by: string;
  timestamp: Date;
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
  role?: 'Admin' | 'Employer' | 'Jobseeker';
  status?: 'Active' | 'Inactive' | 'Suspended' | 'Pending';
  verification?: 'Verified' | 'Pending' | 'Rejected';
  location?: string;
  contact_number?: string;
}