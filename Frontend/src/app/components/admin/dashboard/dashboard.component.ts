import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

interface StatCard {
  title: string;
  value: string;
  trend: number;
  trendLabel: string;
  icon: string;
  color: string;
}

interface Alert {
  id: number;
  type: 'security' | 'system' | 'performance';
  title: string;
  message: string;
  time: string;
  severity: 'high' | 'medium' | 'low';
}

interface FeatureAdoption {
  name: string;
  percentage: number;
}

interface MaintenanceItem {
  title: string;
  description: string;
  date: string;
  downtime: string;
  type: 'database' | 'security' | 'feature';
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  
  constructor(private router: Router) {}

  statsCards: StatCard[] = [
    {
      title: 'Total Users',
      value: '8,249',
      trend: 12.5,
      trendLabel: 'vs last month',
      icon: 'fas fa-users',
      color: '#8b5cf6'
    },
    {
      title: 'Active Jobs',
      value: '1,423',
      trend: 8.2,
      trendLabel: 'vs last month',
      icon: 'fas fa-briefcase',
      color: '#06b6d4'
    },
    {
      title: 'Successful Matches',
      value: '5,874',
      trend: 15.3,
      trendLabel: 'vs last month',
      icon: 'fas fa-check-circle',
      color: '#10b981'
    },
    {
      title: 'AI Match Accuracy',
      value: '92.7%',
      trend: 3.1,
      trendLabel: 'vs last month',
      icon: 'fas fa-brain',
      color: '#f59e0b'
    }
  ];

  alerts: Alert[] = [
    {
      id: 1,
      type: 'security',
      title: 'Security: Unusual Login Patterns',
      message: 'Multiple failed login attempts detected from IP 203.45.78.105. Possible brute force attack.',
      time: '1h ago',
      severity: 'high'
    },
    {
      id: 2,
      type: 'system',
      title: 'System: Database Storage High',
      message: 'Database storage utilization reached 85%. Consider scaling or clean-up operations.',
      time: '3h ago',
      severity: 'medium'
    },
    {
      id: 3,
      type: 'performance',
      title: 'Performance: API Response Time Increased',
      message: 'Average API response time increased to 230ms from baseline of 120ms.',
      time: '6h ago',
      severity: 'low'
    }
  ];

  featureAdoption: FeatureAdoption[] = [
    { name: 'AI Matching', percentage: 87 },
    { name: 'Skill Assessment', percentage: 76 },
    { name: 'Career Path Guidance', percentage: 63 },
    { name: 'Video Interviews', percentage: 54 },
    { name: 'Portfolio Builder', percentage: 42 }
  ];

  maintenanceItems: MaintenanceItem[] = [
    {
      title: 'Database Optimization',
      description: 'Scheduled query optimization and index rebuilding.',
      date: 'April 15, 2025',
      downtime: 'No Downtime',
      type: 'database'
    },
    {
      title: 'Security Updates',
      description: 'Critical security patches and dependency updates.',
      date: 'April 17, 2025',
      downtime: '10 min Downtime',
      type: 'security'
    }
  ];

  ngOnInit() {
    // Initialize charts after view init
    setTimeout(() => {
      this.initializeCharts();
    }, 100);
  }

  getAlertIcon(type: string): string {
    const icons = {
      security: 'fas fa-exclamation-triangle',
      system: 'fas fa-exclamation-circle',
      performance: 'fas fa-bolt'
    };
    return icons[type as keyof typeof icons] || 'fas fa-info-circle';
  }

  getAlertAction(type: string): string {
    const actions = {
      security: 'Investigate',
      system: 'Review',
      performance: 'Analyze'
    };
    return actions[type as keyof typeof actions] || 'Review';
  }

  getMaintenanceIcon(type: string): string {
    const icons = {
      database: 'fas fa-database',
      security: 'fas fa-shield-alt',
      feature: 'fas fa-cog'
    };
    return icons[type as keyof typeof icons] || 'fas fa-wrench';
  }

  getStatDetailsRoute(statTitle: string): string {
    // Map stat titles to appropriate routes
    const routeMapping: { [key: string]: string } = {
      'Total Users': '/admin/users',
      'Active Jobs': '/admin/system-metrics',
      'Successful Matches': '/admin/system-metrics',
      'AI Match Accuracy': '/admin/ai-monitoring'
    };
    
    return routeMapping[statTitle] || '/admin/dashboard';
  }

  handleAlertAction(alert: Alert): void {
    // Navigate to appropriate page based on alert type
    switch (alert.type) {
      case 'security':
        this.router.navigate(['/admin/security']);
        break;
      case 'system':
        this.router.navigate(['/admin/system-metrics']);
        break;
      case 'performance':
        this.router.navigate(['/admin/system-metrics']);
        break;
      default:
        this.router.navigate(['/admin/dashboard']);
    }
  }

  dismissAlert(alertId: number): void {
    // Remove alert from the list
    this.alerts = this.alerts.filter(alert => alert.id !== alertId);
  }

  private initializeCharts() {
    // This would typically use Chart.js or similar library
    // For demo purposes, we'll just log that charts would be initialized
    console.log('Charts would be initialized here with actual data');
  }
}