import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
import { AdminUserService, UserManagementResponse, UserStats } from '../../../../../services/admin-user.service';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.css']
})
export class UsersComponent implements OnInit {
  users: UserManagementResponse[] = [];
  filteredUsers: UserManagementResponse[] = [];
  searchTerm = '';
  selectedRole = 'All Roles';
  selectedStatus = 'All Status';
  selectedVerification = 'All Verification';
  selectedUsers: UserManagementResponse[] = [];
  
  roles = ['All Roles', 'Admin', 'Employer', 'Jobseeker'];
  statuses = ['All Status', 'Active', 'Inactive', 'Suspended', 'Pending'];
  verifications = ['All Verification', 'Verified', 'Pending', 'Rejected'];
  
  Math = Math;

  // Pagination
  currentPage = 1;
  totalPages = 1;
  pageSize = 10;
  totalUsers = 0;

  // Loading states
  isLoading = false;
  isStatsLoading = false;

  // Action menu state
  activeMenuUserId: string | undefined = undefined;

  // Bulk action menu state
  showBulkMenu = false;

  stats: UserStats = {
    totalUsers: 0,
    activeUsers: 0,
    pendingVerification: 0,
    suspendedAccounts: 0,
    totalUsersChange: 0,
    activeUsersChange: 0,
    pendingVerificationChange: 0,
    suspendedAccountsChange: 0
  };

  constructor(private adminUserService: AdminUserService) {}

  ngOnInit(): void {
    this.loadUsers();
    this.loadStats();

    // Close menus when clicking outside
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.action-menu-container')) {
        this.activeMenuUserId = undefined;
      }
      if (!target.closest('.bulk-actions-container')) {
        this.showBulkMenu = false;
      }
    });
  }

  /**
   * Load users from backend with current filters
   */
  loadUsers(): void {
    this.isLoading = true;

    const filters = {
      search: this.searchTerm || undefined,
      role: this.selectedRole !== 'All Roles' ? this.selectedRole as any : undefined,
      status: this.selectedStatus !== 'All Status' ? this.selectedStatus as any : undefined,
      verification: this.selectedVerification !== 'All Verification' ? this.selectedVerification as any : undefined,
      page: this.currentPage,
      limit: this.pageSize
    };

    this.adminUserService.getUsers(filters).subscribe({
      next: (response) => {
        this.users = response.data.users;
        this.filteredUsers = response.data.users;
        this.currentPage = response.data.pagination.currentPage;
        this.totalPages = response.data.pagination.totalPages;
        this.totalUsers = response.data.pagination.totalUsers;
        this.isLoading = false;
        console.log('Users loaded:', this.users.length);
      },
      error: (error) => {
        console.error('Error loading users:', error);
        this.isLoading = false;
        alert('Failed to load users: ' + error.message);
      }
    });
  }

  /**
   * Load user statistics
   */
  loadStats(): void {
    this.isStatsLoading = true;

    this.adminUserService.getUserStats().subscribe({
      next: (response) => {
        this.stats = response.data.stats;
        this.isStatsLoading = false;
        console.log('Stats loaded:', this.stats);
      },
      error: (error) => {
        console.error('Error loading stats:', error);
        this.isStatsLoading = false;
      }
    });
  }

  /**
   * Search users
   */
  onSearch(): void {
    this.currentPage = 1;
    this.loadUsers();
  }

  /**
   * Handle role filter change
   */
  onRoleChange(): void {
    this.currentPage = 1;
    this.loadUsers();
  }

  /**
   * Handle status filter change
   */
  onStatusChange(): void {
    this.currentPage = 1;
    this.loadUsers();
  }

  /**
   * Handle verification filter change
   */
  onVerificationChange(): void {
    this.currentPage = 1;
    this.loadUsers();
  }

  /**
   * Reset all filters
   */
  resetFilters(): void {
    this.searchTerm = '';
    this.selectedRole = 'All Roles';
    this.selectedStatus = 'All Status';
    this.selectedVerification = 'All Verification';
    this.selectedUsers = [];
    this.currentPage = 1;
    this.loadUsers();
  }

  /**
   * Handle user selection
   */
  onUserSelect(user: UserManagementResponse, event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    if (checkbox.checked) {
      this.selectedUsers.push(user);
    } else {
      this.selectedUsers = this.selectedUsers.filter(u => u.id !== user.id);
    }
  }

  /**
   * Select all users on current page
   */
  selectAllUsers(event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    if (checkbox.checked) {
      this.selectedUsers = [...this.filteredUsers];
    } else {
      this.selectedUsers = [];
    }
  }

  /**
   * Check if user is selected
   */
  isUserSelected(user: UserManagementResponse): boolean {
    return this.selectedUsers.some(u => u.id === user.id);
  }

  /**
   * Check if all users are selected
   */
  areAllUsersSelected(): boolean {
    return this.filteredUsers.length > 0 && 
           this.selectedUsers.length === this.filteredUsers.length;
  }

  /**
   * Toggle action menu for a user
   */
  toggleActionMenu(userId: string, event: Event): void {
    event.stopPropagation();
    this.activeMenuUserId = this.activeMenuUserId === userId ? undefined : userId;
  }

  /**
   * Check if menu is active for user
   */
  isMenuActive(userId: string): boolean {
    return this.activeMenuUserId === userId;
  }

  /**
   * Toggle bulk actions menu
   */
  toggleBulkMenu(event: Event): void {
    event.stopPropagation();
    this.showBulkMenu = !this.showBulkMenu;
  }

  /**
   * Perform action on a single user
   */
  performAction(user: UserManagementResponse, action: string): void {
    this.activeMenuUserId = undefined; // Close menu

    switch (action) {
      case 'view':
        this.viewUser(user);
        break;
      case 'edit':
        this.editUser(user);
        break;
      case 'activate':
        this.activateUser(user);
        break;
      case 'suspend':
        this.suspendUser(user);
        break;
      case 'verify':
        this.verifyUser(user);
        break;
      case 'delete':
        this.deleteUser(user);
        break;
      default:
        console.log('Unknown action:', action);
    }
  }

  /**
   * View user details
   */
  viewUser(user: UserManagementResponse): void {
    console.log('Viewing user:', user);
    alert(`View user details for: ${user.name}\nEmail: ${user.email}\nRole: ${user.role}\nStatus: ${user.status}`);
    // TODO: Navigate to user detail page or open modal
  }

  /**
   * Edit user
   */
  editUser(user: UserManagementResponse): void {
    console.log('Editing user:', user);
    alert(`Edit functionality coming soon for: ${user.name}`);
    // TODO: Open edit modal or navigate to edit page
  }

  /**
   * Activate user
   */
  activateUser(user: UserManagementResponse): void {
    if (!confirm(`Activate ${user.name}?`)) return;

    this.adminUserService.activateUser(user.id).subscribe({
      next: () => {
        alert(`${user.name} has been activated successfully.`);
        this.loadUsers();
        this.loadStats();
      },
      error: (error) => {
        alert('Failed to activate user: ' + error.message);
      }
    });
  }

  /**
   * Suspend user
   */
  suspendUser(user: UserManagementResponse): void {
    const reason = prompt(`Why are you suspending ${user.name}?`);
    if (!reason) {
      alert('Suspension reason is required.');
      return;
    }

    this.adminUserService.suspendUser(user.id, reason).subscribe({
      next: () => {
        alert(`${user.name} has been suspended successfully.`);
        this.loadUsers();
        this.loadStats();
      },
      error: (error) => {
        alert('Failed to suspend user: ' + error.message);
      }
    });
  }

  /**
   * Verify user
   */
  verifyUser(user: UserManagementResponse): void {
    if (!confirm(`Verify ${user.name}'s account?`)) return;

    this.adminUserService.verifyUser(user.id).subscribe({
      next: () => {
        alert(`${user.name} has been verified successfully.`);
        this.loadUsers();
        this.loadStats();
      },
      error: (error) => {
        alert('Failed to verify user: ' + error.message);
      }
    });
  }

  /**
   * Delete user (soft delete)
   */
  deleteUser(user: UserManagementResponse): void {
    if (!confirm(`Are you sure you want to delete ${user.name}? This action can be reversed.`)) return;

    const reason = prompt('Reason for deletion (optional):');

    this.adminUserService.deleteUser(user.id, reason || undefined).subscribe({
      next: () => {
        alert(`${user.name} has been deleted successfully.`);
        this.loadUsers();
        this.loadStats();
        this.selectedUsers = this.selectedUsers.filter(u => u.id !== user.id);
      },
      error: (error) => {
        alert('Failed to delete user: ' + error.message);
      }
    });
  }

  /**
   * Perform bulk action
   */
  performBulkAction(action: string): void {
    this.showBulkMenu = false; // Close menu

    if (this.selectedUsers.length === 0) {
      alert('No users selected for bulk action.');
      return;
    }

    const userCount = this.selectedUsers.length;
    const actionText = action.toLowerCase();

    if (!confirm(`Are you sure you want to ${actionText} ${userCount} user(s)?`)) return;

    let reason: string | undefined;
    if (actionText === 'suspend' || actionText === 'delete') {
      // prompt can return null; convert null to undefined to match the variable type
      reason = prompt(`Reason for ${actionText}ing these users:`) ?? undefined;
      if (!reason && actionText === 'suspend') {
        alert('Suspension reason is required.');
        return;
      }
    }

    const userIds = this.selectedUsers.map(u => u.id);

    this.adminUserService.performBulkAction({
      userIds,
      action: actionText as any,
      reason
    }).subscribe({
      next: (response) => {
        const results = response.data.results;
        const successCount = results.filter((r: any) => r.success).length;
        const failureCount = results.filter((r: any) => !r.success).length;

        alert(`Bulk action completed.\nSuccess: ${successCount}\nFailed: ${failureCount}`);
        
        this.selectedUsers = [];
        this.loadUsers();
        this.loadStats();
      },
      error: (error) => {
        alert('Bulk action failed: ' + error.message);
      }
    });
  }

  /**
   * Export users to CSV
   */
  exportUsers(): void {
    const filters = {
      search: this.searchTerm || undefined,
      role: this.selectedRole !== 'All Roles' ? this.selectedRole as any : undefined,
      status: this.selectedStatus !== 'All Status' ? this.selectedStatus as any : undefined,
      verification: this.selectedVerification !== 'All Verification' ? this.selectedVerification as any : undefined
    };

    this.adminUserService.exportUsers(filters).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `users-export-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        window.URL.revokeObjectURL(url);
        alert('Users exported successfully!');
      },
      error: (error) => {
        alert('Failed to export users: ' + error.message);
      }
    });
  }

  /**
   * Pagination methods
   */
  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadUsers();
  }

  previousPage(): void {
    this.goToPage(this.currentPage - 1);
  }

  nextPage(): void {
    this.goToPage(this.currentPage + 1);
  }

  /**
   * UI helper methods
   */
  getStatusClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'active': return 'status-active';
      case 'inactive': return 'status-inactive';
      case 'suspended': return 'status-suspended';
      case 'pending': return 'status-pending';
      default: return '';
    }
  }

  getRoleClass(role: string): string {
    switch (role?.toLowerCase()) {
      case 'admin': return 'role-admin';
      case 'employer': return 'role-employer';
      case 'jobseeker': return 'role-jobseeker';
      default: return '';
    }
  }

  getVerificationClass(verification: string): string {
    switch (verification?.toLowerCase()) {
      case 'verified': return 'verification-verified';
      case 'pending': return 'verification-pending';
      case 'rejected': return 'verification-rejected';
      default: return '';
    }
  }

  getUserInitials(name: string): string {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  }

  formatDate(date: Date | string): string {
    if (!date) return 'N/A';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric'
    }).format(dateObj);
  }
}