import { Injectable } from '@angular/core';
import { InMemoryDbService, RequestInfo } from 'angular-in-memory-web-api';
import { CVData } from '../services/cv.service';  // Adjust path if your CvService is elsewhere (e.g., './cv.service')

@Injectable({
  providedIn: 'root',
})
export class InMemoryDataService implements InMemoryDbService {
  createDb() {
    const cvs: CVData[] = [
      // Optional: Add mock data to simulate loaded CVs
      {
        personalInfo: {
          fullName: 'Sample User',
          email: 'sample@example.com',
          phone: '+1-234-567-8900',
          address: 'Sample City, USA',
          linkedIn: 'https://linkedin.com/in/sample',
          website: 'https://sample.dev',
          professionalSummary: 'Sample professional summary.'
        },
        education: [],
        workExperience: [],
        skills: [],
        certifications: [],
        projects: []
      }
    ];
    return { cvs };
  }

  // Override GET for /api/cvs/me to return user's CVs (all in this case)
  get(reqInfo: RequestInfo) {
    if (reqInfo.url.indexOf('/me') > -1) {
      const cvs = reqInfo.collection || [];
      return { body: { data: cvs } };  // Matches your component's res.data expectation
    }
    return undefined;  // Use default for other GETs (e.g., /api/cvs/:id)
  }

  // POST adds to collection (default behavior is fine, but you can customize if needed)
  post(reqInfo: RequestInfo) {
    // Optionally add an ID if not present (in-memory auto-generates IDs)
    return undefined;  // Use default POST behavior
  }
}