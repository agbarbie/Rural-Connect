import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment.prod';

// Declare Dyte global
declare const DyteClient: any;

@Component({
  selector: 'app-meeting-room',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Loading -->
    <div *ngIf="isLoading" style="display: flex; align-items: center; justify-content: center; height: 100vh; background: #000; color: #fff; flex-direction: column; gap: 20px;">
      <div style="width: 60px; height: 60px; border: 4px solid rgba(255,255,255,0.1); border-top-color: #667eea; border-radius: 50%; animation: spin 1s linear infinite;"></div>
      <p>Loading meeting...</p>
    </div>

    <!-- Error -->
    <div *ngIf="error" style="display: flex; align-items: center; justify-content: center; height: 100vh; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; flex-direction: column; gap: 20px; padding: 20px; text-align: center;">
      <h2>Unable to Join Meeting</h2>
      <p>{{ error }}</p>
      <button (click)="goBack()" style="padding: 12px 24px; background: white; color: #667eea; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">Go Back</button>
    </div>

    <!-- Meeting -->
    <div *ngIf="!isLoading && !error" #dyteContainer style="width: 100vw; height: 100vh; background: #000;"></div>
  `,
  styles: [`
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `]
})
export class MeetingRoomComponent implements OnInit, OnDestroy {
  @ViewChild('dyteContainer', { static: false }) dyteContainer!: ElementRef;
  
  error: string | null = null;
  isLoading = true;
  private dyteClient: any;
  private readonly API_URL = environment.apiUrl;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit() {
    const sessionId = this.route.snapshot.paramMap.get('sessionId');
    if (!sessionId) {
      this.error = 'No session ID provided';
      this.isLoading = false;
      return;
    }
    this.loadMeeting(sessionId);
  }

  ngOnDestroy() {
    if (this.dyteClient) {
      try {
        this.dyteClient.leaveRoom();
      } catch (err) {
        console.error('Error leaving room:', err);
      }
    }
  }

  loadMeeting(sessionId: string) {
    const token = localStorage.getItem('token');
    
    this.http.get(`${this.API_URL}/trainings/sessions/${sessionId}/join`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }).subscribe({
      next: (response: any) => {
        if (response.success && response.data && response.data.authToken) {
          console.log('✅ Got authToken from backend');
          setTimeout(() => this.initDyte(response.data.authToken), 500);
        } else {
          this.error = 'Failed to get meeting credentials';
          this.isLoading = false;
        }
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to load meeting';
        this.isLoading = false;
        console.error('Meeting load error:', err);
      }
    });
  }

  async initDyte(authToken: string) {
    try {
      console.log('🎥 Initializing Dyte with authToken only (NO roomName)...');
      
      // Wait for DyteClient to be available
      if (typeof DyteClient === 'undefined') {
        console.log('⏳ Waiting for Dyte SDK to load...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // ✅ CRITICAL: ONLY authToken - absolutely NO roomName anywhere
      this.dyteClient = await DyteClient.init({
        authToken: authToken,
        defaults: {
          audio: false,
          video: false
        }
      });

      console.log('✅ Dyte client initialized');
      
      await this.dyteClient.join();
      console.log('✅ Joined meeting');

      // Create meeting UI
      const meetingEl = document.createElement('dyte-meeting');
      meetingEl.setAttribute('mode', 'fill');
      (meetingEl as any).meeting = this.dyteClient;

      if (this.dyteContainer) {
        this.dyteContainer.nativeElement.appendChild(meetingEl);
      }

      this.isLoading = false;

      // Listen for leave
      this.dyteClient.self.on('roomLeft', () => {
        this.router.navigate(['/dashboard']);
      });

    } catch (err: any) {
      console.error('❌ Dyte init failed:', err);
      this.error = 'Failed to initialize video call: ' + (err.message || 'Unknown error');
      this.isLoading = false;
    }
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }
}