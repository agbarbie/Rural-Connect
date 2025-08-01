import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-post-job',
  templateUrl: './post-job.component.html',
  styleUrls: ['./post-job.component.css']
})
export class PostJobComponent {
  jobForm: FormGroup;

  constructor(private fb: FormBuilder) {
    this.jobForm = this.fb.group({
      jobTitle: ['', [Validators.required]],
      location: ['', [Validators.required]],
      salary: ['', [Validators.required]],
      duration: ['', [Validators.required]],
      skills: ['', [Validators.required]],
      description: ['', [Validators.required]]
    });
  }

  onSubmit() {
    if (this.jobForm.valid) {
      const jobData = this.jobForm.value;
      console.log('Job Posted:', jobData);
      // Here you would typically send the data to a service or API
      // Example: this.jobService.createJob(jobData).subscribe(response => { ... });
      alert('Job posted successfully!');
      this.jobForm.reset();
    } else {
      alert('Please fill all required fields correctly.');
    }
  }
}