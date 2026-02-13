import { Component, OnInit, OnDestroy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment.prod';

@Component({
  selector: 'app-meeting-room',
  imports: [CommonModule, DatePipe],
  templateUrl: './meeting-room.component.html',
  styleUrls: ['./meeting-room.component.css']
})
export class MeetingRoomComponent implements OnInit, OnDestroy {
  meetingDetails: any = null;
  error: string | null = null;
  isLoading = true;
  jitsiLoaded = false;
  
  isMuted = false;
  isVideoOff = false;
  participantCount = 1; // Self
  
  private jitsiApi: any;
  private readonly API_URL = environment.apiUrl;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit() {
    const trainingId = this.route.snapshot.paramMap.get('trainingId');
    const sessionId = this.route.snapshot.paramMap.get('sessionId');
    const roomCode = this.route.snapshot.paramMap.get('roomCode');

    if (trainingId && sessionId && roomCode) {
      this.loadMeeting(trainingId, sessionId, roomCode);
    } else {
      this.error = 'Invalid meeting link';
      this.isLoading = false;
    }
  }

  ngOnDestroy() {
    if (this.jitsiApi) {
      this.jitsiApi.dispose();
    }
  }

  loadMeeting(trainingId: string, sessionId: string, roomCode: string) {
    this.http.get(`${this.API_URL}/trainings/meeting/${trainingId}/${sessionId}/${roomCode}`)
      .subscribe({
        next: (response: any) => {
          if (response.valid) {
            this.meetingDetails = response;
            this.isLoading = false;
            
            // Initialize Jitsi after a short delay
            setTimeout(() => {
              this.initializeJitsiMeet(roomCode);
            }, 500);
          } else {
            this.error = response.message || 'Invalid meeting link';
            this.isLoading = false;
          }
        },
        error: (err) => {
          this.error = 'Failed to load meeting details. Please check your link and try again.';
          this.isLoading = false;
          console.error('Meeting load error:', err);
        }
      });
  }

  initializeJitsiMeet(roomCode: string) {
    // Load Jitsi Meet API
    const script = document.createElement('script');
    script.src = 'https://meet.jit.si/external_api.js';
    script.async = true;
    script.onload = () => {
      const domain = 'meet.jit.si';
      const options = {
        roomName: `TrainingSession_${roomCode}`,
        width: '100%',
        height: '100%',
        parentNode: document.querySelector('#jitsi-meet-container'),
        userInfo: {
          displayName: localStorage.getItem('userName') || 'Guest'
        },
        configOverwrite: {
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          prejoinPageEnabled: false,
          enableWelcomePage: false,
          disableDeepLinking: true
        },
        interfaceConfigOverwrite: {
          TOOLBAR_BUTTONS: [
            'microphone', 'camera', 'closedcaptions', 'desktop',
            'fullscreen', 'fodeviceselection', 'chat',
            'raisehand', 'videoquality', 'filmstrip',
            'tileview', 'settings'
          ],
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          SHOW_BRAND_WATERMARK: false,
          DEFAULT_BACKGROUND: '#1a1a1a'
        }
      };

      this.jitsiApi = new (window as any).JitsiMeetExternalAPI(domain, options);
      
      this.jitsiApi.addEventListener('videoConferenceJoined', () => {
        this.jitsiLoaded = true;
        console.log('✅ Joined meeting successfully');
      });

      this.jitsiApi.addEventListener('participantJoined', () => {
        this.participantCount++;
      });

      this.jitsiApi.addEventListener('participantLeft', () => {
        this.participantCount = Math.max(1, this.participantCount - 1);
      });

      this.jitsiApi.addEventListener('readyToClose', () => {
        this.leaveMeeting();
      });
    };
    
    script.onerror = () => {
      this.error = 'Failed to load video conferencing. Please refresh and try again.';
    };
    
    document.head.appendChild(script);
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.jitsiApi) {
      this.jitsiApi.executeCommand('toggleAudio');
    }
  }

  toggleVideo() {
    this.isVideoOff = !this.isVideoOff;
    if (this.jitsiApi) {
      this.jitsiApi.executeCommand('toggleVideo');
    }
  }

  toggleScreenShare() {
    if (this.jitsiApi) {
      this.jitsiApi.executeCommand('toggleShareScreen');
    }
  }

  toggleChat() {
    if (this.jitsiApi) {
      this.jitsiApi.executeCommand('toggleChat');
    }
  }

  toggleParticipants() {
    if (this.jitsiApi) {
      this.jitsiApi.executeCommand('toggleTileView');
    }
  }

  leaveMeeting() {
    if (confirm('Are you sure you want to leave the meeting?')) {
      if (this.jitsiApi) {
        this.jitsiApi.dispose();
      }
      this.router.navigate(['/']);
    }
  }

  goBack() {
    this.router.navigate(['/']);
  }
}
