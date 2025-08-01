import { Component, OnInit } from '@angular/core';
import {CommonModule} from '@angular/common';
import { FormsModule } from '@angular/forms';
interface Video {
  id: string;
  title: string;
  duration: string;
  completed: boolean;
}

interface Training {
  id: string;
  title: string;
  description: string;
  category: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  duration: string;
  cost: 'Free' | 'Paid';
  mode: 'Online' | 'Offline';
  provider: string;
  certificate: boolean;
  rating: number;
  students: number;
  thumbnail: string;
  videos: Video[];
  outcomes: string[];
  progress: number;
  enrolled: boolean;
}

interface FilterOptions {
  duration: string[];
  level: string[];
  cost: string[];
  mode: string[];
  category: string[];
}

@Component({
  selector: 'app-training',
  templateUrl: './training.component.html',
  imports: [CommonModule, FormsModule],
  styleUrls: ['./training.component.css']
})
export class TrainingComponent implements OnInit {
  
  trainings: Training[] = [
    {
      id: '1',
      title: 'Complete Data Science Bootcamp',
      description: 'Master data science from basics to advanced machine learning with hands-on projects.',
      category: 'Data Science',
      level: 'Intermediate',
      duration: '45 hours',
      cost: 'Paid',
      mode: 'Online',
      provider: 'TechAcademy',
      certificate: true,
      rating: 4.8,
      students: 15420,
      thumbnail: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=300&h=200&fit=crop',
      progress: 0,
      enrolled: false,
      videos: [
        { id: '1-1', title: 'Introduction to Data Science', duration: '12:30', completed: false },
        { id: '1-2', title: 'Python Fundamentals', duration: '45:20', completed: false },
        { id: '1-3', title: 'Data Manipulation with Pandas', duration: '38:15', completed: false },
        { id: '1-4', title: 'Data Visualization', duration: '52:10', completed: false },
        { id: '1-5', title: 'Machine Learning Basics', duration: '1:15:30', completed: false }
      ],
      outcomes: [
        'Master Python for data analysis',
        'Build machine learning models',
        'Create data visualizations',
        'Work with real datasets'
      ]
    },
    {
      id: '2',
      title: 'Modern Frontend Development',
      description: 'Learn React, Angular, and Vue.js to build modern web applications.',
      category: 'Frontend Development',
      level: 'Beginner',
      duration: '32 hours',
      cost: 'Free',
      mode: 'Online',
      provider: 'CodeCamp',
      certificate: true,
      rating: 4.6,
      students: 8750,
      thumbnail: 'https://images.unsplash.com/photo-1627398242454-45a1465c2479?w=300&h=200&fit=crop',
      progress: 25,
      enrolled: true,
      videos: [
        { id: '2-1', title: 'HTML5 & CSS3 Fundamentals', duration: '28:45', completed: true },
        { id: '2-2', title: 'JavaScript ES6+', duration: '42:30', completed: true },
        { id: '2-3', title: 'React Components', duration: '35:20', completed: false },
        { id: '2-4', title: 'State Management', duration: '48:15', completed: false }
      ],
      outcomes: [
        'Build responsive web applications',
        'Master modern JavaScript',
        'Create React components',
        'Deploy web applications'
      ]
    },
    {
      id: '3',
      title: 'Digital Marketing Mastery',
      description: 'Comprehensive digital marketing course covering SEO, social media, and analytics.',
      category: 'Marketing',
      level: 'Beginner',
      duration: '28 hours',
      cost: 'Paid',
      mode: 'Online',
      provider: 'MarketPro',
      certificate: true,
      rating: 4.7,
      students: 12300,
      thumbnail: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=300&h=200&fit=crop',
      progress: 0,
      enrolled: false,
      videos: [
        { id: '3-1', title: 'Digital Marketing Overview', duration: '15:20', completed: false },
        { id: '3-2', title: 'SEO Fundamentals', duration: '38:45', completed: false },
        { id: '3-3', title: 'Social Media Marketing', duration: '32:15', completed: false },
        { id: '3-4', title: 'Google Analytics', duration: '25:30', completed: false }
      ],
      outcomes: [
        'Create effective marketing campaigns',
        'Optimize websites for search engines',
        'Analyze marketing performance',
        'Build brand presence online'
      ]
    },
    {
      id: '4',
      title: 'Cloud Computing with AWS',
      description: 'Learn Amazon Web Services and cloud architecture fundamentals.',
      category: 'Cloud Computing',
      level: 'Advanced',
      duration: '55 hours',
      cost: 'Paid',
      mode: 'Online',
      provider: 'CloudAcademy',
      certificate: true,
      rating: 4.9,
      students: 6820,
      thumbnail: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=300&h=200&fit=crop',
      progress: 60,
      enrolled: true,
      videos: [
        { id: '4-1', title: 'AWS Overview', duration: '22:15', completed: true },
        { id: '4-2', title: 'EC2 Instances', duration: '45:30', completed: true },
        { id: '4-3', title: 'S3 Storage', duration: '38:20', completed: true },
        { id: '4-4', title: 'Database Services', duration: '52:45', completed: false },
        { id: '4-5', title: 'Security Best Practices', duration: '41:30', completed: false }
      ],
      outcomes: [
        'Deploy applications on AWS',
        'Design scalable architectures',
        'Implement cloud security',
        'Manage cloud costs effectively'
      ]
    },
    {
      id: '5',
      title: 'UX/UI Design Fundamentals',
      description: 'Learn user experience and interface design principles with practical projects.',
      category: 'Design',
      level: 'Beginner',
      duration: '25 hours',
      cost: 'Free',
      mode: 'Online',
      provider: 'DesignHub',
      certificate: false,
      rating: 4.5,
      students: 9450,
      thumbnail: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=300&h=200&fit=crop',
      progress: 0,
      enrolled: false,
      videos: [
        { id: '5-1', title: 'Design Thinking Process', duration: '18:30', completed: false },
        { id: '5-2', title: 'User Research Methods', duration: '32:45', completed: false },
        { id: '5-3', title: 'Wireframing & Prototyping', duration: '28:20', completed: false },
        { id: '5-4', title: 'Visual Design Principles', duration: '35:15', completed: false }
      ],
      outcomes: [
        'Understand user-centered design',
        'Create wireframes and prototypes',
        'Apply design principles',
        'Conduct user research'
      ]
    }
  ];

  filteredTrainings: Training[] = [];
  selectedCategory: string = 'all';
  searchQuery: string = '';
  
  filters: FilterOptions = {
    duration: [],
    level: [],
    cost: [],
    mode: [],
    category: []
  };

  categories: string[] = ['Data Science', 'Frontend Development', 'Marketing', 'Cloud Computing', 'Design'];
  
  showFilters: boolean = false;
  selectedTraining: Training | null = null;
  showTrainingDetail: boolean = false;

  constructor() { }

  ngOnInit(): void {
    this.filteredTrainings = [...this.trainings];
  }

  filterByCategory(category: string): void {
    this.selectedCategory = category;
    this.applyFilters();
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  onFilterChange(): void {
    this.applyFilters();
  }

  applyFilters(): void {
    let filtered = [...this.trainings];

    // Category filter
    if (this.selectedCategory !== 'all') {
      filtered = filtered.filter(training => training.category === this.selectedCategory);
    }

    // Search filter
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(training => 
        training.title.toLowerCase().includes(query) ||
        training.description.toLowerCase().includes(query) ||
        training.category.toLowerCase().includes(query)
      );
    }

    // Duration filter
    if (this.filters.duration.length > 0) {
      filtered = filtered.filter(training => {
        const hours = parseInt(training.duration);
        return this.filters.duration.some(filter => {
          if (filter === 'short' && hours < 10) return true;
          if (filter === 'medium' && hours >= 10 && hours <= 40) return true;
          if (filter === 'long' && hours > 40) return true;
          return false;
        });
      });
    }

    // Level filter
    if (this.filters.level.length > 0) {
      filtered = filtered.filter(training => this.filters.level.includes(training.level));
    }

    // Cost filter
    if (this.filters.cost.length > 0) {
      filtered = filtered.filter(training => this.filters.cost.includes(training.cost));
    }

    // Mode filter
    if (this.filters.mode.length > 0) {
      filtered = filtered.filter(training => this.filters.mode.includes(training.mode));
    }

    this.filteredTrainings = filtered;
  }

  viewTrainingDetail(training: Training): void {
    this.selectedTraining = training;
    this.showTrainingDetail = true;
  }

  closeTrainingDetail(): void {
    this.showTrainingDetail = false;
    this.selectedTraining = null;
  }

  enrollInTraining(training: Training): void {
    training.enrolled = true;
    // Here you would typically make an API call to enroll the user
    console.log('Enrolled in:', training.title);
  }

  startTraining(training: Training): void {
    // Navigate to video player or training viewer
    console.log('Starting training:', training.title);
  }

  onFilterCheckboxChange(filterType: keyof FilterOptions, value: string, event: any): void {
    if (event.target.checked) {
      this.filters[filterType].push(value);
    } else {
      const index = this.filters[filterType].indexOf(value);
      if (index > -1) {
        this.filters[filterType].splice(index, 1);
      }
    }
    this.onFilterChange();
  }

  clearAllFilters(): void {
    this.filters = {
      duration: [],
      level: [],
      cost: [],
      mode: [],
      category: []
    };
    this.selectedCategory = 'all';
    this.searchQuery = '';
    this.applyFilters();
  }

  getDurationText(duration: string): string {
    const hours = parseInt(duration);
    if (hours < 10) return 'Short Course';
    if (hours <= 40) return 'Medium Course';
    return 'Comprehensive Course';
  }

  getProgressWidth(progress: number): string {
    return `${progress}%`;
  }
}