import { Component, OnInit } from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';

interface Training {
  id: string;
  title: string;
  description: string;
  duration: string;
  status: 'Active' | 'Closed';
  videoUrl: string;
  videoType: 'youtube' | 'vimeo' | 'local';
  completionCriteria: string;
  issueCertificate: boolean;
  createdDate: Date;
  completedBy: string[];
  certificatesIssued: number;
  totalViews: number;
}

interface NewTraining {
  title: string;
  description: string;
  duration: string;
  videoUrl: string;
  videoType: 'youtube' | 'vimeo' | 'local';
  completionCriteria: string;
  issueCertificate: boolean;
}

@Component({
  selector: 'app-training',
  templateUrl: './training.component.html',
  imports: [CommonModule, FormsModule],
  styleUrls: ['./training.component.css']
})
export class TrainingComponent implements OnInit {
  employerName: string = 'TechCorp Solutions';
  trainings: Training[] = [];
  showAddForm: boolean = false;
  selectedTraining: Training | null = null;
  showVideoPlayer: boolean = false;
  videoProgress: number = 0;
  isVideoCompleted: boolean = false;

  newTraining: NewTraining = {
    title: '',
    description: '',
    duration: '',
    videoUrl: '',
    videoType: 'youtube',
    completionCriteria: 'Watch till end',
    issueCertificate: false
  };

  constructor() {}

  ngOnInit(): void {
    this.loadTrainings();
  }

  // Computed properties for analytics
  get totalCompletions(): number {
    return this.trainings.reduce((sum, t) => sum + t.completedBy.length, 0);
  }

  get totalCertificates(): number {
    return this.trainings.reduce((sum, t) => sum + t.certificatesIssued, 0);
  }

  get activeTrainingsCount(): number {
    return this.trainings.filter(t => t.status === 'Active').length;
  }

  loadTrainings(): void {
    // Mock data - in real app, this would come from a service
    this.trainings = [
      {
        id: '1',
        title: 'Angular Fundamentals',
        description: 'Learn the basics of Angular framework including components, services, and routing.',
        duration: '2 hours',
        status: 'Active',
        videoUrl: 'https://www.youtube.com/embed/k5E2AVpwsko',
        videoType: 'youtube',
        completionCriteria: 'Watch till end',
        issueCertificate: true,
        createdDate: new Date('2024-01-15'),
        completedBy: ['user1', 'user2', 'user3'],
        certificatesIssued: 3,
        totalViews: 45
      },
      {
        id: '2',
        title: 'TypeScript Best Practices',
        description: 'Advanced TypeScript concepts and best practices for professional development.',
        duration: '1.5 hours',
        status: 'Active',
        videoUrl: 'https://www.youtube.com/embed/ahCwqrYpIuM',
        videoType: 'youtube',
        completionCriteria: 'Watch till end and pass quiz',
        issueCertificate: true,
        createdDate: new Date('2024-01-10'),
        completedBy: ['user1', 'user4'],
        certificatesIssued: 2,
        totalViews: 32
      },
      {
        id: '3',
        title: 'Project Management Essentials',
        description: 'Essential project management skills for software development teams.',
        duration: '3 hours',
        status: 'Closed',
        videoUrl: 'https://www.youtube.com/embed/ZKOL-rZ79gs',
        videoType: 'youtube',
        completionCriteria: 'Complete all modules',
        issueCertificate: false,
        createdDate: new Date('2023-12-20'),
        completedBy: ['user2', 'user3', 'user5'],
        certificatesIssued: 0,
        totalViews: 28
      }
    ];
  }

  toggleAddForm(): void {
    this.showAddForm = !this.showAddForm;
    if (!this.showAddForm) {
      this.resetForm();
    }
  }

  resetForm(): void {
    this.newTraining = {
      title: '',
      description: '',
      duration: '',
      videoUrl: '',
      videoType: 'youtube',
      completionCriteria: 'Watch till end',
      issueCertificate: false
    };
  }

  addTraining(): void {
    if (this.isFormValid()) {
      const training: Training = {
        id: Date.now().toString(),
        ...this.newTraining,
        status: 'Active',
        createdDate: new Date(),
        completedBy: [],
        certificatesIssued: 0,
        totalViews: 0
      };

      this.trainings.unshift(training);
      this.toggleAddForm();
      // In real app, you would call a service to save the training
    }
  }

  isFormValid(): boolean {
    return !!(this.newTraining.title && 
             this.newTraining.description && 
             this.newTraining.duration && 
             this.newTraining.videoUrl);
  }

  viewTrainingDetails(training: Training): void {
    this.selectedTraining = training;
    this.showVideoPlayer = true;
    this.videoProgress = 0;
    this.isVideoCompleted = false;
  }

  closeVideoPlayer(): void {
    this.showVideoPlayer = false;
    this.selectedTraining = null;
  }

  updateVideoProgress(progress: number): void {
    this.videoProgress = progress;
    if (progress >= 90) { // Consider 90% as completed
      this.isVideoCompleted = true;
    }
  }

  markTrainingCompleted(): void {
    if (this.selectedTraining && this.isVideoCompleted) {
      // In real app, you would call a service to mark completion
      this.selectedTraining.completedBy.push('current-user');
      if (this.selectedTraining.issueCertificate) {
        this.selectedTraining.certificatesIssued++;
        this.generateCertificate();
      }
    }
  }

  generateCertificate(): void {
    // Mock certificate generation
    alert('Certificate generated successfully! You can download it from your profile.');
  }

  toggleTrainingStatus(training: Training): void {
    training.status = training.status === 'Active' ? 'Closed' : 'Active';
    // In real app, you would call a service to update the status
  }

  deleteTraining(trainingId: string): void {
    if (confirm('Are you sure you want to delete this training?')) {
      this.trainings = this.trainings.filter(t => t.id !== trainingId);
    }
  }

  getVideoEmbedUrl(url: string, type: string): string {
    if (type === 'youtube') {
      // Convert YouTube URL to embed format
      const videoId = this.extractYouTubeId(url);
      return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
    }
    return url;
  }

  getTrustedUrl(url: string): any {
    // Simple method to handle trusted URLs - in production you might want to use DomSanitizer
    return url;
  }

  private extractYouTubeId(url: string): string | null {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      // In real app, you would upload the file to a server
      this.newTraining.videoUrl = URL.createObjectURL(file);
      this.newTraining.videoType = 'local';
    }
  }
}