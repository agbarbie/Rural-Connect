// training-meeting.component.ts - DYTE INTEGRATION
import { Component, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AuthService } from '../../../../../services/auth.service';
import { TrainingService } from '../../../../../services/training.service';
import { DyteMeetingService } from '../../../../../services/dyte-meeting.service';

@Component({
  selector: 'app-training-meeting',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './training-meeting.component.html',
  styleUrls: ['./training-meeting.component.css']
})
export class TrainingMeetingComponent implements OnInit, OnDestroy {
  
  // Meeting state
  sessionId: string = '';
  trainingId: string = '';
  
  // User info
  currentUser: any = null;
  isModerator: boolean = false;
  userDisplayName: string = '';
  userId: string = '';
  
  // Meeting details
  sessionTitle: string = '';
  trainingTitle: string = '';
  
  // UI state
  loading: boolean = true;
  error: string = '';
  meetingJoined: boolean = false;
  
  // Dyte iframe
  dyteIframeUrl: SafeResourceUrl | null = null;
  
  constructor(
    private route: ActivatedRoute,
    public router: Router, // ✅ FIXED: Made public
    private authService: AuthService,
    private trainingService: TrainingService,
    private dyteMeetingService: DyteMeetingService,
    private sanitizer: DomSanitizer
  ) {}
  
  ngOnInit(): void {
    // Get route parameters
    this.route.params.subscribe(params => {
      this.trainingId = params['trainingId'];
      this.sessionId = params['sessionId'];
      
      console.log('📍 Meeting params:', {
        trainingId: this.trainingId,
        sessionId: this.sessionId
      });
    });
    
    // Get current user
    this.currentUser = this.authService.getCurrentUser();
    
    if (!this.currentUser) {
      this.error = 'You must be logged in to join this meeting';
      this.loading = false;
      return;
    }
    
    // Set user details
    this.userId = this.currentUser.id;
    this.userDisplayName = this.getUserDisplayName();
    
    // Determine if user is moderator (employers are moderators)
    this.isModerator = this.currentUser.user_type === 'employer';
    
    console.log('👤 Current user:', {
      name: this.userDisplayName,
      role: this.isModerator ? 'MODERATOR' : 'PARTICIPANT'
    });
    
    // Initialize meeting
    this.initializeDyteMeeting();
  }
  
  /**
   * Initialize Dyte meeting
   */
  private async initializeDyteMeeting(): Promise<void> {
    try {
      this.loading = true;
      this.error = '';
      
      if (this.isModerator) {
        // Employer gets iframe URL
        this.dyteMeetingService.getIframeUrl(this.sessionId).subscribe({
          next: (response) => {
            if (response.success && response.data) {
              this.sessionTitle = response.data.session?.title || 'Training Session';
              this.trainingTitle = response.data.session?.training_title || '';
              
              // Sanitize iframe URL
              this.dyteIframeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
                response.data.iframeUrl
              );
              
              this.loading = false;
              this.meetingJoined = true;
              
              console.log('✅ Employer iframe ready');
            } else {
              throw new Error('Invalid response from server');
            }
          },
          error: (error) => {
            console.error('❌ Failed to get iframe URL:', error);
            this.error = error.error?.message || 'Failed to start meeting';
            this.loading = false;
          }
        });
      } else {
        // Jobseeker gets join URL
        this.dyteMeetingService.joinMeeting(this.sessionId).subscribe({
          next: (response) => {
            if (response.success && response.data) {
              this.sessionTitle = response.data.session?.title || 'Training Session';
              this.trainingTitle = response.data.session?.training_title || '';
              
              // Sanitize join URL
              this.dyteIframeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
                response.data.joinUrl
              );
              
              this.loading = false;
              this.meetingJoined = true;
              
              console.log('✅ Participant join URL ready');
            } else {
              throw new Error('Invalid response from server');
            }
          },
          error: (error) => {
            console.error('❌ Failed to get join URL:', error);
            this.error = error.error?.message || 'Failed to join meeting';
            this.loading = false;
          }
        });
      }
      
    } catch (error: any) {
      console.error('❌ Meeting initialization failed:', error);
      this.error = error.message || 'Failed to initialize meeting';
      this.loading = false;
    }
  }
  
  /**
   * Get user display name from current user
   */
  private getUserDisplayName(): string {
    if (!this.currentUser) return 'Guest';
    
    const firstName = this.currentUser.first_name || '';
    const lastName = this.currentUser.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim();
    
    if (fullName) return fullName;
    if (this.currentUser.name) return this.currentUser.name;
    if (this.currentUser.email) {
      return this.currentUser.email.split('@')[0]
        .replace(/[_.-]/g, ' ')
        .replace(/\b\w/g, (l: string) => l.toUpperCase());
    }
    
    return 'User';
  }
  
  /**
   * Leave meeting and navigate back
   */
  leaveMeeting(): void {
    console.log('👋 Leaving meeting...');
    
    this.meetingJoined = false;
    this.dyteIframeUrl = null;
    
    // Navigate back to training page
    setTimeout(() => {
      this.router.navigate([
        this.isModerator ? '/employer/training' : '/jobseeker/training',
        this.trainingId
      ]);
    }, 500);
  }
  
  /**
   * Component cleanup
   */
  ngOnDestroy(): void {
    console.log('🧹 Cleaning up meeting component');
    this.dyteIframeUrl = null;
  }
}