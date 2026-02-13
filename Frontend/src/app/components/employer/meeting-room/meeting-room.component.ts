import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { DatePipe } from '@angular/common';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment.prod';

// Declare Dyte global
declare const DyteClient: any;

@Component({
  selector: 'app-meeting-room',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './meeting-room.component.html',
  styleUrls: ['./meeting-room.component.css']
})
export class MeetingRoomComponent implements OnInit, OnDestroy {
  @ViewChild('dyteContainer', { static: false }) dyteContainer!: ElementRef;
  
  meetingDetails: any = null;
  error: string | null = null;
  isLoading = true;
  dyteLoaded = false;
  
  isMuted = false;
  isVideoOff = false;
  participantCount = 1;
  
  private dyteClient: any;
  private readonly API_URL = environment.apiUrl;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit() {
    const sessionId = this.route.snapshot.paramMap.get('sessionId');

    if (sessionId) {
      this.loadMeeting(sessionId);
    } else {
      this.error = 'Invalid meeting link - no session ID';
      this.isLoading = false;
    }
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
        if (response.success && response.data) {
          this.meetingDetails = response.data;
          this.isLoading = false;
          
          // Initialize Dyte after a short delay
          setTimeout(() => {
            this.initializeDyteMeet(response.data.authToken);
          }, 500);
        } else {
          this.error = response.message || 'Failed to join meeting';
          this.isLoading = false;
        }
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to load meeting. Please try again.';
        this.isLoading = false;
        console.error('Meeting load error:', err);
      }
    });
  }

  async initializeDyteMeet(authToken: string) {
    try {
      console.log('🎥 Initializing Dyte client...');

      // ✅ CRITICAL: Initialize with ONLY authToken (Dyte SDK v2+)
      this.dyteClient = await DyteClient.init({
        authToken: authToken,
        defaults: {
          audio: false,  // Start muted
          video: false,  // Start with camera off
        }
      });

      console.log('✅ Dyte client initialized');

      // ✅ CRITICAL: Must call join() after init
      await this.dyteClient.join();
      console.log('✅ Successfully joined meeting');

      // Create and append Dyte meeting UI element
      const meetingEl = document.createElement('dyte-meeting');
      meetingEl.setAttribute('mode', 'fill');
      (meetingEl as any).meeting = this.dyteClient;

      // Clear container and add meeting element
      if (this.dyteContainer) {
        this.dyteContainer.nativeElement.innerHTML = '';
        this.dyteContainer.nativeElement.appendChild(meetingEl);
      }

      this.dyteLoaded = true;

      // Setup event listeners
      this.setupDyteListeners();

    } catch (err: any) {
      console.error('❌ Failed to initialize Dyte:', err);
      this.error = 'Failed to initialize video call. Please refresh and try again.';
      this.dyteLoaded = false;
    }
  }

  setupDyteListeners() {
    if (!this.dyteClient) return;

    // Listen for participant changes
    this.dyteClient.participants.joined.on('participantJoined', () => {
      this.participantCount = this.dyteClient.participants.joined.size + 1;
    });

    this.dyteClient.participants.joined.on('participantLeft', () => {
      this.participantCount = this.dyteClient.participants.joined.size + 1;
    });

    // Listen for self leaving
    this.dyteClient.self.on('roomLeft', () => {
      console.log('👋 Left the meeting');
      this.router.navigate(['/dashboard']);
    });

    // Listen for meeting ending
    this.dyteClient.meta.on('meetingEnded', () => {
      console.log('🛑 Meeting ended');
      alert('The meeting has ended');
      this.router.navigate(['/dashboard']);
    });

    // Listen for audio/video state changes
    this.dyteClient.self.on('audioUpdate', ({ audioEnabled }: any) => {
      this.isMuted = !audioEnabled;
    });

    this.dyteClient.self.on('videoUpdate', ({ videoEnabled }: any) => {
      this.isVideoOff = !videoEnabled;
    });
  }

  toggleMute() {
    if (this.dyteClient) {
      if (this.isMuted) {
        this.dyteClient.self.enableAudio();
      } else {
        this.dyteClient.self.disableAudio();
      }
    }
  }

  toggleVideo() {
    if (this.dyteClient) {
      if (this.isVideoOff) {
        this.dyteClient.self.enableVideo();
      } else {
        this.dyteClient.self.disableVideo();
      }
    }
  }

  toggleScreenShare() {
    if (this.dyteClient) {
      if (this.dyteClient.self.screenShareEnabled) {
        this.dyteClient.self.disableScreenShare();
      } else {
        this.dyteClient.self.enableScreenShare();
      }
    }
  }

  toggleChat() {
    // Dyte UI Kit handles chat internally
    // This is handled by the dyte-meeting component
    console.log('Chat toggle - handled by Dyte UI');
  }

  toggleParticipants() {
    // Dyte UI Kit handles participants view internally
    // This is handled by the dyte-meeting component
    console.log('Participants toggle - handled by Dyte UI');
  }

  leaveMeeting() {
    if (confirm('Are you sure you want to leave the meeting?')) {
      if (this.dyteClient) {
        this.dyteClient.leaveRoom();
      } else {
        this.router.navigate(['/dashboard']);
      }
    }
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }
}