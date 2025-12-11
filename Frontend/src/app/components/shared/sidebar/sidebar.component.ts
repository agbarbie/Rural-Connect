import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  badge?: number | string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css'
})
export class SidebarComponent implements OnInit {
  @Input() userType: 'jobseeker' | 'employer' | 'admin' = 'jobseeker';
  
  currentRoute: string = '';
  navSections: NavSection[] = [];

  private jobseekerNav: NavSection[] = [
    {
      title: 'Main',
      items: [
        { label: 'Dashboard', icon: 'fas fa-th-large', route: '/jobseeker/dashboard' },
        { label: 'My Profile', icon: 'fas fa-user', route: '/jobseeker/profile' },
        { label: 'Jobs Explorer', icon: 'fas fa-briefcase', route: '/jobseeker/job-explorer', badge: 5 },
        { label: 'AI Recommendations', icon: 'fas fa-robot', route: '/jobseeker/ai-assistant' },
        { label: 'CV Manager', icon: 'fas fa-file-alt', route: '/jobseeker/cv-builder' },
        { label: 'My Portfolio', icon: 'fas fa-folder', route: '/jobseeker/portfolio' },
        { label: 'Training', icon: 'fas fa-play-circle', route: '/jobseeker/training' }
      ]
    },
    {
      title: 'Support',
      items: [
        { label: 'Settings', icon: 'fas fa-cog', route: '/jobseeker/settings' },
        { label: 'Help & Support', icon: 'fas fa-question-circle', route: '/jobseeker/help' }
      ]
    }
  ];

  private employerNav: NavSection[] = [
    {
      title: 'Main',
      items: [
        { label: 'Dashboard', icon: 'fas fa-th-large', route: '/employer/employer-dashboard' },
        { label: 'Post Jobs', icon: 'fas fa-briefcase', route: '/employer/post-jobs' },
        { label: 'Candidates', icon: 'fas fa-users', route: '/employer/candidates' },
        // { label: 'Interviews', icon: 'fas fa-calendar-alt', route: '/employer/interviews' },
        { label: 'Training', icon: 'fas fa-play-circle', route: '/employer/training' },
        { label: 'AI Assistant', icon: 'fas fa-robot', route: '/employer/ai-assistant' },
        { label: 'Company Profile', icon: 'fas fa-building', route: '/employer/company-profile' }
      ]
    },
    {
      title: 'Support',
      items: [
        { label: 'Settings', icon: 'fas fa-cog', route: '/employer/settings' },
        { label: 'Help & Support', icon: 'fas fa-question-circle', route: '/employer/help' }
      ]
    }
  ];

  private adminNav: NavSection[] = [
    {
      title: 'Main',
      items: [
        { label: 'Dashboard', icon: 'fas fa-th-large', route: '/admin/dashboard' },
        { label: 'Users', icon: 'fas fa-users', route: '/admin/users' },
        { label: 'Security', icon: 'fas fa-shield-alt', route: '/admin/security' },
        { label: 'AI Monitoring', icon: 'fas fa-robot', route: '/admin/ai-monitoring' },
        { label: 'System Metrics', icon: 'fas fa-chart-line', route: '/admin/system-metrics' }
      ]
    },
    {
      title: 'Support',
      items: [
        { label: 'Settings', icon: 'fas fa-cog', route: '/admin/settings' },
        { label: 'Help & Support', icon: 'fas fa-question-circle', route: '/admin/help' }
      ]
    }
  ];

  constructor(private router: Router) {}

  ngOnInit(): void {
    // Set navigation based on user type
    this.setNavigation();

    // Get current route
    this.currentRoute = this.router.url;

    // Listen to route changes
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.currentRoute = event.urlAfterRedirects || event.url;
      });
  }

  private setNavigation(): void {
    switch (this.userType) {
      case 'employer':
        this.navSections = this.employerNav;
        break;
      case 'admin':
        this.navSections = this.adminNav;
        break;
      case 'jobseeker':
      default:
        this.navSections = this.jobseekerNav;
        break;
    }
  }

  isActive(route: string): boolean {
    return this.currentRoute === route || this.currentRoute.startsWith(route + '/');
  }

  navigate(route: string, event?: Event): void {
    if (event) {
      event.preventDefault();
    }
    this.router.navigate([route]);
  }
}