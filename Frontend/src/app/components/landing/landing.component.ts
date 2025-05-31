import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.css']
})
export class LandingComponent{
  candidates = [
    {
      name: 'Micheal Smith',
      role: 'Market Analyst',
      experience: '11 Years',
      location: 'Washington, USA',
      image: 'https://images.unsplash.com/photo-1494790108755-2616b332c7ff?w=150&h=150&fit=crop&crop=face'
    },
    {
      name: 'Maria Bonaport',
      role: 'Market Analyst',
      experience: '8 Years',
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face'
    },
    {
      name: 'Alfread Bonaport',
      role: 'Market Analyst',
      experience: '6 Years',
      image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face'
    },
    {
      name: 'Jimmy Doe',
      role: 'Market Analyst',
      experience: '5 Years',
      image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face'
    }
  ];

  stories = [
    {
      name: 'Anjali Devi',
      role: 'Job Seeker',
      content: 'Thanks to RuralConnect, I found a remote data entry job. The app guides me at every step, and I get paid on time.',
      avatar: 'https://images.unsplash.com/photo-1494790108755-2616b332c7ff?w=50&h=50&fit=crop&crop=face'
    },
    {
      name: 'Ravi Jha',
      role: 'Employer',
      content: 'AI matched us with skilled workers fast. Payments are secure and automatic. It is transformed our hiring process.',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=50&h=50&fit=crop&crop=face'
    },
    {
      name: 'Isha Kumari',
      role: 'Job Seeker',
      content: 'The free online courses helped me learn new skills at my own pace. Now I am earning from my village!',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=50&h=50&fit=crop&crop=face'
    }
  ];
}