import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Employer' | 'Jobseeker';
  status: 'Active' | 'Inactive' | 'Suspended' | 'Pending';
  created: Date;
  verification: 'Verified' | 'Pending' | 'Rejected';
  avatar?: string;
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

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.css']
})
export class UsersComponent implements OnInit {
  users: User[] = [];
  filteredUsers: User[] = [];
  searchTerm = '';
  selectedRole = 'All Roles';
  selectedStatus = 'All Status';
  selectedVerification = 'All Verification';
  selectedUsers: User[] = [];
  
  roles = ['All Roles', 'Admin', 'Employer', 'Jobseeker'];
  statuses = ['All Status', 'Active', 'Inactive', 'Suspended', 'Pending'];
  verifications = ['All Verification', 'Verified', 'Pending', 'Rejected'];
  
  Math = Math; // Make Math available in template

  stats: UserStats = {
    totalUsers: 0,
    activeUsers: 0,
    pendingVerification: 0,
    suspendedAccounts: 0,
    totalUsersChange: 12,
    activeUsersChange: 8,
    pendingVerificationChange: 15,
    suspendedAccountsChange: -3
  };

  constructor() {}

  ngOnInit(): void {
    this.loadUsers();
    this.updateStats();
  }

  loadUsers(): void {
    this.users = [
      {
        id: '6gaofjuc',
        name: 'John Doe',
        email: 'john@example.com',
        role: 'Jobseeker',
        status: 'Inactive',
        created: new Date('2025-08-20'),
        verification: 'Verified'
      },
      {
        id: 'i0kaymwz',
        name: 'Sarah Smith',
        email: 'sarah@example.com',
        role: 'Admin',
        status: 'Suspended',
        created: new Date('2025-08-20'),
        verification: 'Verified'
      },
      {
        id: '6ukbt7h1',
        name: 'Mike Johnson',
        email: 'mike@example.com',
        role: 'Admin',
        status: 'Inactive',
        created: new Date('2025-08-20'),
        verification: 'Verified'
      },
      {
        id: 'ldra8d0v',
        name: 'Emily Davis',
        email: 'emily@example.com',
        role: 'Jobseeker',
        status: 'Pending',
        created: new Date('2025-08-18'),
        verification: 'Verified'
      },
      {
        id: 'mn7x2p9k',
        name: 'David Wilson',
        email: 'david@example.com',
        role: 'Admin',
        status: 'Active',
        created: new Date('2025-08-16'),
        verification: 'Verified'
      },
      {
        id: 'qw8r5t2y',
        name: 'Lisa Brown',
        email: 'lisa@example.com',
        role: 'Employer',
        status: 'Active',
        created: new Date('2025-08-15'),
        verification: 'Pending'
      }
    ];
    
    this.filteredUsers = [...this.users];
  }

  updateStats(): void {
    this.stats.totalUsers = this.users.length;
    this.stats.activeUsers = this.users.filter(u => u.status === 'Active').length;
    this.stats.pendingVerification = this.users.filter(u => u.verification === 'Pending').length;
    this.stats.suspendedAccounts = this.users.filter(u => u.status === 'Suspended').length;
  }

  onSearch(): void {
    this.applyFilters();
  }

  onRoleChange(): void {
    this.applyFilters();
  }

  onStatusChange(): void {
    this.applyFilters();
  }

  onVerificationChange(): void {
    this.applyFilters();
  }

  applyFilters(): void {
    this.filteredUsers = this.users.filter(user => {
      const matchesSearch = !this.searchTerm || 
        user.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(this.searchTerm.toLowerCase());
      
      const matchesRole = this.selectedRole === 'All Roles' || user.role === this.selectedRole;
      const matchesStatus = this.selectedStatus === 'All Status' || user.status === this.selectedStatus;
      const matchesVerification = this.selectedVerification === 'All Verification' || user.verification === this.selectedVerification;

      return matchesSearch && matchesRole && matchesStatus && matchesVerification;
    });

    // Update selectedUsers to only include users that are still in filteredUsers
    this.selectedUsers = this.selectedUsers.filter(u => this.filteredUsers.some(fu => fu.id === u.id));
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.selectedRole = 'All Roles';
    this.selectedStatus = 'All Status';
    this.selectedVerification = 'All Verification';
    this.filteredUsers = [...this.users];
    this.selectedUsers = [];
  }

  onUserSelect(user: User, event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    if (checkbox.checked) {
      this.selectedUsers.push(user);
    } else {
      this.selectedUsers = this.selectedUsers.filter(u => u.id !== user.id);
    }
  }

  selectAllUsers(event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    if (checkbox.checked) {
      this.selectedUsers = [...this.filteredUsers];
    } else {
      this.selectedUsers = [];
    }
  }

  isUserSelected(user: User): boolean {
    return this.selectedUsers.some(u => u.id === user.id);
  }

  areAllUsersSelected(): boolean {
    return this.filteredUsers.length > 0 && this.selectedUsers.length === this.filteredUsers.length;
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'Active': return 'status-active';
      case 'Inactive': return 'status-inactive';
      case 'Suspended': return 'status-suspended';
      case 'Pending': return 'status-pending';
      default: return '';
    }
  }

  getRoleClass(role: string): string {
    switch (role) {
      case 'Admin': return 'role-admin';
      case 'Instructor': return 'role-instructor';
      case 'Student': return 'role-student';
      default: return '';
    }
  }

  getVerificationClass(verification: string): string {
    switch (verification) {
      case 'Verified': return 'verification-verified';
      case 'Pending': return 'verification-pending';
      case 'Rejected': return 'verification-rejected';
      default: return '';
    }
  }

  getUserInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  }

  onUserAction(user: User, action: string): void {
    switch (action.toLowerCase()) {
      case 'view':
        console.log(`Viewing user: ${user.name} (${user.id})`);
        // Placeholder for navigation to user details page or modal
        // Example: this.router.navigate(['/users', user.id]);
        break;
      case 'edit':
        console.log(`Editing user: ${user.name} (${user.id})`);
        // Placeholder for opening edit form or modal
        // Example: this.openEditModal(user);
        break;
      case 'delete':
        if (confirm(`Are you sure you want to delete ${user.name}?`)) {
          this.users = this.users.filter(u => u.id !== user.id);
          this.filteredUsers = this.filteredUsers.filter(u => u.id !== user.id);
          this.selectedUsers = this.selectedUsers.filter(u => u.id !== user.id);
          this.updateStats();
          console.log(`Deleted user: ${user.name} (${user.id})`);
        }
        break;
      case 'suspend':
        this.users = this.users.map(u => 
          u.id === user.id 
            ? { ...u, status: u.status === 'Suspended' ? 'Active' : 'Suspended' }
            : u
        );
        this.filteredUsers = this.filteredUsers.map(u => 
          u.id === user.id 
            ? { ...u, status: u.status === 'Suspended' ? 'Active' : 'Suspended' }
            : u
        );
        this.selectedUsers = this.selectedUsers.map(u => 
          u.id === user.id 
            ? { ...u, status: u.status === 'Suspended' ? 'Active' : 'Suspended' }
            : u
        );
        this.updateStats();
        console.log(`Toggled suspend status for user: ${user.name} (${user.id}) to ${user.status === 'Suspended' ? 'Active' : 'Suspended'}`);
        break;
      default:
        console.log(`Unknown action ${action} for user: ${user.name} (${user.id})`);
    }
  }

  onBulkAction(action: string): void {
    if (this.selectedUsers.length === 0) {
      alert('No users selected for bulk action.');
      return;
    }
    
    switch (action.toLowerCase()) {
      case 'delete':
        if (confirm(`Are you sure you want to delete ${this.selectedUsers.length} user(s)?`)) {
          const selectedIds = new Set(this.selectedUsers.map(u => u.id));
          this.users = this.users.filter(u => !selectedIds.has(u.id));
          this.filteredUsers = this.filteredUsers.filter(u => !selectedIds.has(u.id));
          this.selectedUsers = [];
          this.updateStats();
          console.log(`Deleted ${selectedIds.size} user(s)`);
        }
        break;
      case 'suspend':
        this.users = this.users.map(u => 
          this.selectedUsers.some(su => su.id === u.id)
            ? { ...u, status: u.status === 'Suspended' ? 'Active' : 'Suspended' }
            : u
        );
        this.filteredUsers = this.filteredUsers.map(u => 
          this.selectedUsers.some(su => su.id === u.id)
            ? { ...u, status: u.status === 'Suspended' ? 'Active' : 'Suspended' }
            : u
        );
        this.selectedUsers = this.selectedUsers.map(u => 
          u.status === 'Suspended' 
            ? { ...u, status: 'Active' }
            : { ...u, status: 'Suspended' }
        );
        this.updateStats();
        console.log(`Toggled suspend status for ${this.selectedUsers.length} user(s)`);
        break;
      default:
        console.log(`Unknown bulk action: ${action}`);
    }
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric'
    }).format(date);
  }
}