// dashboard.component.ts
import { Component, OnInit } from '@angular/core';
import { Chart } from 'chart.js';
import { CommonModule } from '@angular/common';

interface DashboardStats {
  totalUsers: number;
  activeJobs: number;
  successfulMatches: number;
  aiAccuracy: number;
  userGrowthData: { month: string; jobSeekers: number; employers: number }[];
  platformActivity: { period: number; jobSeekers: number; employers: number; jobPosts: number }[];
  systemMetrics: { cpuUsage: number; memoryUsage: number; apiResponseTime: number; databaseLoad: number };
  criticalAlerts: { type: string; title: string; description: string; time: string; severity: string }[];
  featureAdoption: { feature: string; adoption: number }[];
  upcomingMaintenance: { type: string; title: string; description: string; date: string; downtime: string }[];
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  standalone: true,
  imports: [CommonModule]
})
export class DashboardComponent implements OnInit {
  stats: DashboardStats = {
    totalUsers: 8249,
    activeJobs: 1423,
    successfulMatches: 5874,
    aiAccuracy: 92.7,
    userGrowthData: [
      { month: 'Jan', jobSeekers: 520, employers: 120 },
      { month: 'Feb', jobSeekers: 620, employers: 140 },
      { month: 'Mar', jobSeekers: 750, employers: 170 },
      { month: 'Apr', jobSeekers: 880, employers: 200 },
      { month: 'May', jobSeekers: 950, employers: 240 },
      { month: 'Jun', jobSeekers: 1020, employers: 280 }
    ],
    platformActivity: [
      { period: 1, jobSeekers: 65, employers: 28, jobPosts: 15 },
      { period: 2, jobSeekers: 58, employers: 35, jobPosts: 20 },
      { period: 3, jobSeekers: 72, employers: 42, jobPosts: 25 },
      { period: 4, jobSeekers: 68, employers: 38, jobPosts: 22 },
      { period: 5, jobSeekers: 85, employers: 45, jobPosts: 30 },
      { period: 6, jobSeekers: 78, employers: 40, jobPosts: 28 },
      { period: 7, jobSeekers: 82, employers: 48, jobPosts: 32 }
    ],
    systemMetrics: {
      cpuUsage: 42,
      memoryUsage: 68,
      apiResponseTime: 128,
      databaseLoad: 54
    },
    criticalAlerts: [
      {
        type: 'security',
        title: 'Unusual Login Patterns',
        description: 'Multiple failed login attempts detected from IP 203.45.78.105. Possible brute force attack.',
        time: '1h ago',
        severity: 'high'
      },
      {
        type: 'system',
        title: 'Database Storage High',
        description: 'Database storage utilization reached 85%. Consider scaling or clean-up operations.',
        time: '3h ago',
        severity: 'warning'
      },
      {
        type: 'performance',
        title: 'API Response Time Increased',
        description: 'Average API response time increased to 230ms from baseline of 120ms.',
        time: '6h ago',
        severity: 'info'
      }
    ],
    featureAdoption: [
      { feature: 'AI Job Matching', adoption: 87 },
      { feature: 'Resume Assessment', adoption: 76 },
      { feature: 'Job Recommendation', adoption: 63 },
      { feature: 'Interview Prep', adoption: 54 },
      { feature: 'Profile Builder', adoption: 42 }
    ],
    upcomingMaintenance: [
      {
        type: 'database',
        title: 'Database Optimization',
        description: 'Scheduled query optimization and index rebuilding.',
        date: 'August 25, 2025',
        downtime: 'No Downtime'
      },
      {
        type: 'security',
        title: 'Security Updates',
        description: 'Critical security patches and dependency updates.',
        date: 'August 27, 2025',
        downtime: '10 min Downtime'
      }
    ]
  };

  userGrowthChart: Chart | undefined;
  platformActivityChart: Chart | undefined;

  ngOnInit(): void {
    this.createUserGrowthChart();
    this.createPlatformActivityChart();
  }

  createUserGrowthChart(): void {
    const ctx = document.getElementById('userGrowthChart') as HTMLCanvasElement;
    if (ctx) {
      this.userGrowthChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: this.stats.userGrowthData.map(d => d.month),
          datasets: [
            {
              label: 'Job Seekers',
              data: this.stats.userGrowthData.map(d => d.jobSeekers),
              backgroundColor: '#8B5CF6',
              borderRadius: 8
            },
            {
              label: 'Employers',
              data: this.stats.userGrowthData.map(d => d.employers),
              backgroundColor: '#3B82F6',
              borderRadius: 8
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              position: 'top'
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: {
                color: '#E5E7EB'
              }
            },
            x: {
              grid: {
                display: false
              }
            }
          }
        }
      });
    }
  }

  createPlatformActivityChart(): void {
    const ctx = document.getElementById('platformActivityChart') as HTMLCanvasElement;
    if (ctx) {
      this.platformActivityChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: this.stats.platformActivity.map((_, i) => `Period ${i + 1}`),
          datasets: [
            {
              label: 'Job Seekers',
              data: this.stats.platformActivity.map(d => d.jobSeekers),
              borderColor: '#8B5CF6',
              backgroundColor: 'rgba(139, 92, 246, 0.1)',
              tension: 0.4,
              fill: true
            },
            {
              label: 'Employers',
              data: this.stats.platformActivity.map(d => d.employers),
              borderColor: '#10B981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              tension: 0.4,
              fill: true
            },
            {
              label: 'Job Posts',
              data: this.stats.platformActivity.map(d => d.jobPosts),
              borderColor: '#F59E0B',
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              tension: 0.4,
              fill: true
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: {
                color: '#E5E7EB'
              }
            },
            x: {
              grid: {
                display: false
              }
            }
          }
        }
      });
    }
  }

  handleAlertAction(alert: any, action: 'investigate' | 'review' | 'analyze' | 'dismiss'): void {
    console.log(`${action} alert:`, alert);
    // Implement alert handling logic here
  }

  viewDetails(section: string): void {
    console.log(`View details for: ${section}`);
    // Implement navigation to detailed views
  }

  viewAllAlerts(): void {
    console.log('View all alerts');
    // Navigate to alerts page
  }
}