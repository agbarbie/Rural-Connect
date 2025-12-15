// src/services/cv-parse.service.ts - FIX URI MALFORMED ERROR
import mammoth from 'mammoth';
import fs from 'fs';
const PDFParser = require('pdf2json');

export class CVParserService {
  
  async parseCV(filePath: string, mimeType: string): Promise<any> {
    let text = '';
    
    try {
      console.log('Starting to parse CV:', { filePath, mimeType });
      
      if (mimeType === 'application/pdf') {
        text = await this.parsePDF(filePath);
      } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        text = await this.parseDOCX(filePath);
      } else if (mimeType === 'application/msword' || mimeType === 'text/plain') {
        text = fs.readFileSync(filePath, 'utf-8');
      } else {
        throw new Error('Unsupported file type');
      }
      
      console.log('Extracted text length:', text.length);
      
      const cvData = this.extractCVData(text);
      console.log('CV data extracted successfully');
      
      return cvData;
      
    } catch (error: any) {
      console.error('Error parsing CV:', error);
      throw new Error(`Failed to parse CV: ${error.message}`);
    }
  }
  
  /**
   * Parse PDF using pdf2json with error handling
   */
  private async parsePDF(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const pdfParser = new PDFParser();
      
      pdfParser.on('pdfParser_dataError', (errData: any) => {
        reject(new Error(errData.parserError));
      });
      
      pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
        try {
          let text = '';
          
          // Extract text from all pages
          if (pdfData.Pages) {
            for (const page of pdfData.Pages) {
              if (page.Texts) {
                for (const textItem of page.Texts) {
                  for (const rItem of textItem.R) {
                    try {
                      // Try to decode, if it fails, use raw text
                      text += decodeURIComponent(rItem.T) + ' ';
                    } catch (e) {
                      // If decoding fails, use the raw text
                      text += rItem.T + ' ';
                    }
                  }
                }
                text += '\n'; // Add newline after each text item
              }
            }
          }
          
          console.log('PDF text extracted, length:', text.length);
          console.log('First 200 chars:', text.substring(0, 200));
          resolve(text);
        } catch (err: any) {
          reject(err);
        }
      });
      
      pdfParser.loadPDF(filePath);
    });
  }
  
  private async parseDOCX(filePath: string): Promise<string> {
    try {
      console.log('Reading DOCX file:', filePath);
      const result = await mammoth.extractRawText({ path: filePath });
      console.log('DOCX parsed successfully');
      return result.value;
    } catch (error: any) {
      console.error('DOCX parsing error:', error);
      throw new Error(`Failed to parse DOCX: ${error.message}`);
    }
  }
  
  private extractCVData(text: string): any {
    console.log('Extracting CV data from text...');
    
    const cvData: any = {
      personal_info: this.extractPersonalInfo(text),
      education: this.extractEducation(text),
      work_experience: this.extractWorkExperience(text),
      skills: this.extractSkills(text),
      certifications: this.extractCertifications(text),
      projects: this.extractProjects(text)
    };
    
    console.log('Extracted data summary:', {
      hasName: !!cvData.personal_info.full_name,
      hasEmail: !!cvData.personal_info.email,
      educationCount: cvData.education.length,
      workExpCount: cvData.work_experience.length,
      skillsCount: cvData.skills.length
    });
    
    return cvData;
  }
  
  private extractPersonalInfo(text: string): any {
    const personalInfo: any = {
      full_name: '',
      email: '',
      phone: '',
      address: '',
      linkedin_url: '',
      website_url: '',
      professional_summary: '',
      profile_image: undefined
    };
    
    const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g;
    const emails = text.match(emailRegex);
    if (emails && emails.length > 0) {
      personalInfo.email = emails[0];
      console.log('Found email:', personalInfo.email);
    }
    
    const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
    const phones = text.match(phoneRegex);
    if (phones && phones.length > 0) {
      personalInfo.phone = phones[0].replace(/\s+/g, ' ').trim();
      console.log('Found phone:', personalInfo.phone);
    }
    
    const linkedInRegex = /(https?:\/\/)?(www\.)?linkedin\.com\/in\/[\w-]+/gi;
    const linkedIn = text.match(linkedInRegex);
    if (linkedIn && linkedIn.length > 0) {
      personalInfo.linkedin_url = linkedIn[0];
    }
    
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length > 0) {
      const firstLine = lines[0];
      if (/^[A-Za-z\s]{2,50}$/.test(firstLine) && firstLine.split(' ').length <= 4) {
        personalInfo.full_name = firstLine;
        console.log('Found name:', personalInfo.full_name);
      }
    }
    
    const summaryKeywords = ['summary', 'profile', 'objective', 'about'];
    const summarySection = this.extractSection(text, summaryKeywords);
    if (summarySection) {
      personalInfo.professional_summary = summarySection.substring(0, 500);
    }
    
    return personalInfo;
  }
  
  private extractEducation(text: string): any[] {
    const education: any[] = [];
    const educationKeywords = ['education', 'academic background', 'qualifications'];
    const sectionText = this.extractSection(text, educationKeywords);
    
    if (!sectionText) return education;
    
    const degreePatterns = [
      /(?:bachelor|master|phd|doctorate|diploma|certificate|associate)(?:'?s)?(?:\s+of)?(?:\s+(?:science|arts|engineering|business|technology|commerce))?/gi,
      /B\.?S\.?c?|M\.?S\.?c?|Ph\.?D\.?|B\.?A\.?|M\.?A\.?|MBA|B\.?Tech|M\.?Tech/gi
    ];
    
    const yearPattern = /\b(19|20)\d{2}\b/g;
    const lines = sectionText.split('\n').filter(l => l.trim());
    
    let currentEntry: any = null;
    
    for (const line of lines) {
      let foundDegree = false;
      
      for (const pattern of degreePatterns) {
        const match = line.match(pattern);
        if (match) {
          foundDegree = true;
          if (currentEntry) education.push(currentEntry);
          currentEntry = {
            institution: '',
            degree: match[0],
            field_of_study: '',
            start_year: null,
            end_year: null,
            gpa: null,
            achievements: null
          };
          break;
        }
      }
      
      if (currentEntry) {
        const years = line.match(yearPattern);
        if (years && years.length > 0) {
          currentEntry.start_year = years[0];
          if (years.length > 1) currentEntry.end_year = years[1];
        }
        
        const gpaMatch = line.match(/GPA:?\s*([\d.]+)/i);
        if (gpaMatch) currentEntry.gpa = gpaMatch[1];
        
        if (!foundDegree && !years && line.length > 3 && !line.match(/GPA/i)) {
          currentEntry.institution = line.trim();
        }
      }
    }
    
    if (currentEntry) education.push(currentEntry);
    return education;
  }
  
  private extractWorkExperience(text: string): any[] {
    const workExperience: any[] = [];
    const workKeywords = ['experience', 'work experience', 'employment', 'professional experience'];
    const sectionText = this.extractSection(text, workKeywords);
    
    if (!sectionText) return workExperience;
    
    const lines = sectionText.split('\n').filter(l => l.trim());
    const datePattern = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/gi;
    
    let currentEntry: any = null;
    
    for (const line of lines) {
      const dates = line.match(datePattern);
      if (dates && dates.length > 0) {
        if (currentEntry) workExperience.push(currentEntry);
        
        currentEntry = {
          company: '',
          position: '',
          start_date: dates[0],
          end_date: dates.length > 1 ? dates[1] : null,
          is_current: line.toLowerCase().includes('present') || line.toLowerCase().includes('current'),
          responsibilities: '',
          achievements: null
        };
        
        const parts = line.split(/[-–—|@]/);
        if (parts.length >= 2) {
          currentEntry.position = parts[0].replace(datePattern, '').trim();
          currentEntry.company = parts[1].replace(datePattern, '').trim();
        }
      } else if (currentEntry && (line.startsWith('•') || line.startsWith('-') || line.startsWith('*'))) {
        currentEntry.responsibilities += line + '\n';
      }
    }
    
    if (currentEntry) workExperience.push(currentEntry);
    return workExperience;
  }
  
  private extractSkills(text: string): any[] {
    const skills: any[] = [];
    const skillKeywords = ['skills', 'technical skills', 'core competencies', 'expertise'];
    const sectionText = this.extractSection(text, skillKeywords);
    
    if (!sectionText) return skills;
    
    const categories: { [key: string]: string[] } = {
      'Programming': ['javascript', 'python', 'java', 'c++', 'c#', 'php', 'ruby', 'go', 'rust', 'swift', 'kotlin', 'typescript', 'scala'],
      'Web': ['html', 'css', 'react', 'angular', 'vue', 'node', 'express', 'django', 'flask', 'asp.net', 'jquery', 'bootstrap'],
      'Database': ['sql', 'mysql', 'postgresql', 'mongodb', 'redis', 'oracle', 'dynamodb', 'cassandra'],
      'Cloud': ['aws', 'azure', 'gcp', 'google cloud', 'cloud computing', 'heroku'],
      'DevOps': ['docker', 'kubernetes', 'jenkins', 'ci/cd', 'git', 'github', 'gitlab', 'terraform'],
      'Other': []
    };
    
    const lines = sectionText.toLowerCase().split(/[,\n•\-*|]/);
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length < 2 || trimmed.length > 30) continue;
      
      let category = 'Other';
      for (const [cat, keywords] of Object.entries(categories)) {
        if (keywords.some(keyword => trimmed.includes(keyword))) {
          category = cat;
          break;
        }
      }
      
      skills.push({
        skill_name: this.capitalizeWords(trimmed),
        skill_level: 'Intermediate',
        category: category
      });
    }
    
    return skills.slice(0, 20);
  }
  
  private extractCertifications(text: string): any[] {
    const certifications: any[] = [];
    const certKeywords = ['certifications', 'certificates', 'credentials', 'licenses'];
    const sectionText = this.extractSection(text, certKeywords);
    
    if (!sectionText) return certifications;
    
    const lines = sectionText.split('\n').filter(l => l.trim());
    const yearPattern = /\b(19|20)\d{2}\b/g;
    
    for (const line of lines) {
      if (line.trim().length < 5) continue;
      
      const years = line.match(yearPattern);
      const parts = line.split(/[-–—|]/);
      
      if (parts.length > 0) {
        certifications.push({
          certification_name: parts[0].trim(),
          issuer: parts.length > 1 ? parts[1].replace(yearPattern, '').trim() : '',
          date_issued: years && years.length > 0 ? `${years[0]}-01-01` : null,
          expiry_date: null,
          credential_id: null
        });
      }
    }
    
    return certifications;
  }
  
  private extractProjects(text: string): any[] {
    const projects: any[] = [];
    const projectKeywords = ['projects', 'portfolio', 'key projects'];
    const sectionText = this.extractSection(text, projectKeywords);
    
    if (!sectionText) return projects;
    
    const lines = sectionText.split('\n').filter(l => l.trim());
    let currentProject: any = null;
    
    for (const line of lines) {
      if (line.length > 0 && line[0] === line[0].toUpperCase() && !line.startsWith('•') && !line.startsWith('-')) {
        if (currentProject) projects.push(currentProject);
        currentProject = {
          project_name: line.trim(),
          description: '',
          technologies: null,
          start_date: null,
          end_date: null,
          github_link: null,
          demo_link: null,
          outcomes: null
        };
      } else if (currentProject) {
        currentProject.description += line + ' ';
      }
    }
    
    if (currentProject) projects.push(currentProject);
    return projects;
  }
  
  private extractSection(text: string, keywords: string[]): string | null {
    const lowerText = text.toLowerCase();
    
    for (const keyword of keywords) {
      const index = lowerText.indexOf(keyword.toLowerCase());
      if (index !== -1) {
        const nextSectionPatterns = [
          'education', 'experience', 'skills', 'certification', 'projects',
          'work history', 'employment', 'qualifications', 'achievements',
          'references', 'hobbies', 'interests'
        ];
        
        let endIndex = text.length;
        for (const pattern of nextSectionPatterns) {
          if (pattern.toLowerCase() === keyword.toLowerCase()) continue;
          const nextIndex = lowerText.indexOf(pattern.toLowerCase(), index + keyword.length);
          if (nextIndex !== -1 && nextIndex < endIndex) {
            endIndex = nextIndex;
          }
        }
        
        return text.substring(index + keyword.length, endIndex).trim();
      }
    }
    
    return null;
  }
  
  private capitalizeWords(text: string): string {
    return text.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
}

export default new CVParserService();