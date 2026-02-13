// src/services/cv-parse.service.ts - COMPLETE ENHANCED VERSION
import fs from 'fs';
import path from 'path';
const pdf = require('pdf-parse');
import { CVData } from '../types/cv.type';

/**
 * ✅ COMPLETE CV PARSING SERVICE
 * Extracts comprehensive information from CV files
 */
class CVParserService {
  
  /**
   * Main parsing function - determines file type and extracts data
   */
  async parseCV(filePath: string, mimeType: string): Promise<CVData> {
    try {
      console.log('📄 Starting CV parse:', { filePath, mimeType });
      
      let text = '';
      
      // Extract text based on file type
      if (mimeType === 'application/pdf') {
        text = await this.extractPDFText(filePath);
      } else if (mimeType === 'text/plain') {
        text = await this.extractPlainText(filePath);
      } else if (
        mimeType === 'application/msword' ||
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ) {
        text = await this.extractDocText(filePath);
      } else {
        throw new Error(`Unsupported file type: ${mimeType}`);
      }
      
      console.log('📝 Extracted text length:', text.length);
      console.log('📝 First 1000 chars:', text.substring(0, 1000));
      
      // Parse the extracted text
      const cvData = this.parseText(text);
      
      console.log('✅ CV parsing complete');
      console.log('📊 Parsed data summary:', {
        name: cvData.personal_info.full_name,
        email: cvData.personal_info.email,
        phone: cvData.personal_info.phone,
        educationCount: cvData.education.length,
        workCount: cvData.work_experience.length,
        skillsCount: cvData.skills.length,
        certsCount: cvData.certifications.length,
        projectsCount: cvData.projects.length
      });
      
      return cvData;
      
    } catch (error: any) {
      console.error('❌ CV parsing error:', error);
      throw new Error(`Failed to parse CV: ${error.message}`);
    }
  }
  
  /**
   * Extract text from PDF
   */
  private async extractPDFText(filePath: string): Promise<string> {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    return data.text;
  }
  
  /**
   * Extract text from plain text file
   */
  private async extractPlainText(filePath: string): Promise<string> {
    return fs.readFileSync(filePath, 'utf-8');
  }
  
  /**
   * Extract text from DOC/DOCX
   */
  private async extractDocText(filePath: string): Promise<string> {
    try {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    } catch (error) {
      console.warn('Mammoth extraction failed, using fallback');
      return fs.readFileSync(filePath, 'utf-8');
    }
  }
  
  /**
   * Parse extracted text into structured CV data
   */
  private parseText(text: string): CVData {
    // Clean the text
    const cleanedText = this.cleanText(text);
    const lines = cleanedText.split('\n').map(l => l.trim()).filter(l => l);
    
    console.log('🔍 Parsing text with', lines.length, 'lines');
    
    // Extract different sections
    const personalInfo = this.extractPersonalInfo(cleanedText, lines);
    const summary = this.extractSummary(cleanedText, lines);
    const education = this.extractEducation(cleanedText, lines);
    const workExperience = this.extractWorkExperience(cleanedText, lines);
    const skills = this.extractSkills(cleanedText, lines);
    const certifications = this.extractCertifications(cleanedText, lines);
    const projects = this.extractProjects(cleanedText, lines);
    
    console.log('✅ Extraction complete:', {
      hasName: !!personalInfo.full_name,
      hasEmail: !!personalInfo.email,
      hasPhone: !!personalInfo.phone,
      summaryLength: summary.length,
      educationCount: education.length,
      workCount: workExperience.length,
      skillsCount: skills.length
    });
    
    return {
      personal_info: {
        ...personalInfo,
        professional_summary: summary
      },
      education,
      work_experience: workExperience,
      skills,
      certifications,
      projects
    };
  }
  
  /**
   * Clean and normalize text
   */
  private cleanText(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\t/g, ' ')
      .replace(/  +/g, ' ')
      .trim();
  }
  
  /**
   * ✅ ENHANCED: Extract personal information
   */
  private extractPersonalInfo(text: string, lines: string[]): any {
    console.log('🔍 Extracting personal info...');
    
    // Extract name - look for UPPERCASE name at top
    let fullName = '';
    const upperCaseNamePattern = /^[A-Z][A-Z\s]+[A-Z]$/;
    const titleCaseNamePattern = /^([A-Z][a-z]+\s+){1,4}[A-Z][a-z]+$/;
    
    // Skip common headers
    const skipHeaders = ['curriculum vitae', 'cv', 'resume'];
    for (let i = 0; i < Math.min(lines.length, 10); i++) {
      const line = lines[i];
      const lineLower = line.toLowerCase();
      
      if (skipHeaders.some(h => lineLower === h)) continue;
      
      // Check for UPPERCASE names (like "BARBARA WANGUI MAINA")
      if (upperCaseNamePattern.test(line) && line.length > 5 && line.length < 60) {
        fullName = line;
        console.log('✅ Found name (uppercase):', fullName);
        break;
      }
      
      // Check for Title Case names
      if (titleCaseNamePattern.test(line) && !line.includes('@') && !line.includes('+')) {
        fullName = line;
        console.log('✅ Found name (title case):', fullName);
        break;
      }
    }
    
    // Extract email
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emailMatches = text.match(emailPattern);
    const email = emailMatches ? emailMatches[0] : '';
    console.log('📧 Email found:', email);
    
    // Extract phone - enhanced for Kenyan and international formats
    const phonePattern = /(?:\+254|0)\s*\d{3}\s*\d{3}\s*\d{3,4}|\(\d{3}\)\s*\d{3}\s*\d{4}|\d{3}[-\s]?\d{3}[-\s]?\d{4}/;
    const phoneMatch = text.match(phonePattern);
    const phone = phoneMatch ? phoneMatch[0].replace(/\s+/g, ' ').trim() : '';
    console.log('📱 Phone found:', phone);
    
    // Extract GitHub
    const githubPattern = /github\.com\/([a-zA-Z0-9-]+)/i;
    const githubMatch = text.match(githubPattern);
    const github = githubMatch ? `https://${githubMatch[0]}` : '';
    console.log('💻 GitHub found:', github);
    
    // Extract LinkedIn
    const linkedinPattern = /linkedin\.com\/in\/([a-zA-Z0-9-]+)/i;
    const linkedinMatch = text.match(linkedinPattern);
    const linkedIn = linkedinMatch ? `https://${linkedinMatch[0]}` : '';
    console.log('🔗 LinkedIn found:', linkedIn);
    
    // Extract location - enhanced for Kenya
    const locationPattern = /\b(Kenya|Nairobi|Mombasa|Kisumu|Eldoret|Nakuru|Thika|Nyeri|Machakos)\b/i;
    const locationMatch = text.match(locationPattern);
    const address = locationMatch ? locationMatch[0] : '';
    console.log('📍 Location found:', address);
    
    return {
      full_name: fullName,
      email,
      phone,
      address,
      linkedin_url: linkedIn,
      website_url: '',
      github,
      profile_image: undefined,
      website: undefined,
      linkedIn: linkedIn,
      x_handle: undefined,
      twitter: undefined
    };
  }
  
  /**
   * ✅ ENHANCED: Extract professional summary
   */
  private extractSummary(text: string, lines: string[]): string {
    console.log('🔍 Extracting summary...');
    
    const summaryHeaders = [
      'professional summary',
      'summary',
      'profile',
      'about me',
      'objective',
      'career objective',
      'professional profile'
    ];
    
    let summaryText = '';
    let foundHeader = false;
    let linesCollected = 0;
    
    for (let i = 0; i < lines.length && linesCollected < 10; i++) {
      const line = lines[i];
      const lineLower = line.toLowerCase();
      
      // Check if this is a summary header
      if (summaryHeaders.some(header => lineLower.includes(header) || lineLower === header)) {
        foundHeader = true;
        console.log('✅ Found summary header at line', i);
        continue;
      }
      
      // If we found the header, collect the next lines until we hit another section
      if (foundHeader) {
        // Stop if we hit another section header
        if (this.isSectionHeader(line)) {
          console.log('📍 Hit next section, stopping summary collection');
          break;
        }
        
        // Collect lines that look like content (longer than 20 chars)
        if (line.length > 20 && !line.match(/^[\d\-\s]+$/)) {
          summaryText += (summaryText ? ' ' : '') + line;
          linesCollected++;
        }
      }
    }
    
    const result = summaryText || 'Professional seeking new opportunities';
    console.log('✅ Summary extracted:', result.substring(0, 100) + '...');
    return result;
  }
  
  /**
   * ✅ ENHANCED: Extract education
   */
  private extractEducation(text: string, lines: string[]): any[] {
    console.log('🔍 Extracting education...');
    
    const education: any[] = [];
    const educationHeaders = ['education', 'academic background', 'qualifications', 'academic qualifications'];
    
    let inEducationSection = false;
    let currentEdu: any = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineLower = line.toLowerCase();
      
      // Check if entering education section
      if (educationHeaders.some(h => lineLower.includes(h) || lineLower === h)) {
        inEducationSection = true;
        console.log('✅ Found education section at line', i);
        continue;
      }
      
      // Check if leaving education section
      if (inEducationSection && this.isSectionHeader(line) && !educationHeaders.some(h => lineLower.includes(h))) {
        if (currentEdu) {
          education.push(currentEdu);
          currentEdu = null;
        }
        console.log('📍 Leaving education section');
        break;
      }
      
      if (!inEducationSection) continue;
      
      // Look for degree patterns
      const degreePattern = /\b(bachelor|master|phd|doctorate|bsc|msc|ba|ma|bba|mba|bcom|bbit|btech|diploma|certificate|degree|kcse)\b/i;
      const degreeMatch = line.match(degreePattern);
      
      if (degreeMatch) {
        // Save previous education
        if (currentEdu) {
          education.push(currentEdu);
          console.log('✅ Added education entry:', currentEdu.degree);
        }
        
        currentEdu = {
          id: `edu_${Date.now()}_${education.length}`,
          institution: '',
          degree: line,
          field_of_study: '',
          start_year: '',
          end_year: '',
          gpa: '',
          achievements: ''
        };
        
        // Extract field of study if present
        const fieldPattern = /\b(?:in|of)\s+([A-Z][a-zA-Z\s&]+?)(?:\s+(?:at|from|,|\d{4}))/;
        const fieldMatch = line.match(fieldPattern);
        if (fieldMatch) {
          currentEdu.field_of_study = fieldMatch[1].trim();
        }
      }
      
      // Look for institution names
      const institutionPattern = /\b(university|college|school|institute|academy|polytechnic)\b/i;
      if (currentEdu && institutionPattern.test(line) && !degreePattern.test(line)) {
        currentEdu.institution = line;
      }
      
      // Look for years
      const yearPattern = /\b(19|20)\d{2}\b/g;
      const graduatedPattern = /graduated:\s*(\d{4})/i;
      
      const graduatedMatch = line.match(graduatedPattern);
      if (currentEdu && graduatedMatch) {
        currentEdu.end_year = graduatedMatch[1];
      } else {
        const years = line.match(yearPattern);
        if (currentEdu && years) {
          if (years.length >= 2) {
            currentEdu.start_year = years[0];
            currentEdu.end_year = years[1];
          } else if (years.length === 1) {
            currentEdu.end_year = years[0];
          }
        }
      }
      
      // Look for GPA
      const gpaPattern = /\bgpa:?\s*(\d+\.?\d*)\b/i;
      const gpaMatch = line.match(gpaPattern);
      if (currentEdu && gpaMatch) {
        currentEdu.gpa = gpaMatch[1];
      }
    }
    
    // Add last education
    if (currentEdu) {
      education.push(currentEdu);
      console.log('✅ Added final education entry:', currentEdu.degree);
    }
    
    console.log('📊 Total education entries:', education.length);
    return education;
  }
  
  /**
   * ✅ ENHANCED: Extract work experience
   */
  private extractWorkExperience(text: string, lines: string[]): any[] {
    console.log('🔍 Extracting work experience...');
    
    const workExperience: any[] = [];
    const workHeaders = [
      'professional experience',
      'work experience',
      'experience',
      'employment history',
      'career history',
      'work history'
    ];
    
    let inWorkSection = false;
    let currentWork: any = null;
    let responsibilities: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineLower = line.toLowerCase();
      
      // Check if entering work section
      if (workHeaders.some(h => lineLower.includes(h) || lineLower === h)) {
        inWorkSection = true;
        console.log('✅ Found work experience section at line', i);
        continue;
      }
      
      // Check if leaving work section
      if (inWorkSection && this.isSectionHeader(line) && !workHeaders.some(h => lineLower.includes(h))) {
        if (currentWork) {
          currentWork.responsibilities = responsibilities.join('\n');
          workExperience.push(currentWork);
          currentWork = null;
          responsibilities = [];
        }
        console.log('📍 Leaving work experience section');
        break;
      }
      
      if (!inWorkSection) continue;
      
      // Look for job titles with dates
      const jobPattern = /^([A-Z][a-zA-Z\s&\/]+?)\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d{4}|Present)/i;
      const jobMatch = line.match(jobPattern);
      
      if (jobMatch) {
        // Save previous work
        if (currentWork) {
          currentWork.responsibilities = responsibilities.join('\n');
          workExperience.push(currentWork);
          console.log('✅ Added work entry:', currentWork.position);
          responsibilities = [];
        }
        
        const dates = this.extractDates(line);
        
        currentWork = {
          id: `work_${Date.now()}_${workExperience.length}`,
          company: '',
          position: jobMatch[1].trim(),
          start_date: dates.start || '',
          end_date: dates.end || '',
          is_current: dates.isCurrent,
          responsibilities: '',
          achievements: ''
        };
        continue;
      }
      
      // Next line after job title might be company name
      if (currentWork && !currentWork.company && line.length > 2 && line.length < 100 && !line.startsWith('•')) {
        // Check if this line doesn't look like a responsibility
        if (!line.match(/^[•\-*]/)) {
          currentWork.company = line;
          console.log('📍 Found company:', line);
        }
      }
      
      // Collect bullet points as responsibilities
      if (currentWork && (line.startsWith('•') || line.startsWith('-') || line.startsWith('*'))) {
        const responsibility = line.replace(/^[•\-*]\s*/, '').trim();
        if (responsibility.length > 10) {
          responsibilities.push(responsibility);
        }
      }
    }
    
    // Add last work entry
    if (currentWork) {
      currentWork.responsibilities = responsibilities.join('\n');
      workExperience.push(currentWork);
      console.log('✅ Added final work entry:', currentWork.position);
    }
    
    console.log('📊 Total work experience entries:', workExperience.length);
    return workExperience;
  }
  
  /**
   * ✅ ENHANCED: Extract skills
   */
  private extractSkills(text: string, lines: string[]): any[] {
    console.log('🔍 Extracting skills...');
    
    const skills: any[] = [];
    const skillHeaders = [
      'skills',
      'core competencies',
      'technical skills',
      'competencies',
      'soft skills',
      'key skills'
    ];
    
    let inSkillSection = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineLower = line.toLowerCase();
      
      // Check if entering skills section
      if (skillHeaders.some(h => lineLower.includes(h) || lineLower === h)) {
        inSkillSection = true;
        console.log('✅ Found skills section at line', i);
        continue;
      }
      
      // Check if leaving skills section
      if (inSkillSection && this.isSectionHeader(line) && !skillHeaders.some(h => lineLower.includes(h))) {
        console.log('📍 Leaving skills section');
        break;
      }
      
      if (!inSkillSection) continue;
      
      // Parse category: skills format (e.g., "Design & Branding: UI/UX Design, Figma...")
      const categoryMatch = line.match(/^([^:]+):\s*(.+)$/);
      if (categoryMatch) {
        const category = categoryMatch[1].trim();
        const skillList = categoryMatch[2];
        
        // Split skills by common delimiters
        const skillNames = skillList
          .split(/[,;|•·()]/)
          .map(s => s.trim())
          .filter(s => s && s.length > 2 && s.length < 50);
        
        skillNames.forEach(skillName => {
          skills.push({
            skill_name: skillName,
            skill_level: 'Intermediate',
            category: category
          });
        });
        
        console.log(`✅ Found ${skillNames.length} skills in category:`, category);
      } else if (line.includes(',') || line.includes('•')) {
        // Plain list format
        const skillNames = line
          .split(/[,•·;]/)
          .map(s => s.trim())
          .filter(s => s && s.length > 2 && s.length < 50);
        
        skillNames.forEach(skillName => {
          skills.push({
            skill_name: skillName,
            skill_level: 'Intermediate',
            category: 'Other'
          });
        });
        
        if (skillNames.length > 0) {
          console.log(`✅ Found ${skillNames.length} skills (no category)`);
        }
      }
    }
    
    console.log('📊 Total skills extracted:', skills.length);
    return skills;
  }
  
  /**
   * ✅ ENHANCED: Extract certifications
   */
  private extractCertifications(text: string, lines: string[]): any[] {
    console.log('🔍 Extracting certifications...');
    
    const certifications: any[] = [];
    const certHeaders = [
      'certifications',
      'certificates',
      'programs, training & certifications',
      'training',
      'professional development',
      'programs'
    ];
    
    let inCertSection = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineLower = line.toLowerCase();
      
      // Check if entering cert section
      if (certHeaders.some(h => lineLower.includes(h))) {
        inCertSection = true;
        console.log('✅ Found certifications section at line', i);
        continue;
      }
      
      // Check if leaving cert section
      if (inCertSection && this.isSectionHeader(line) && !certHeaders.some(h => lineLower.includes(h))) {
        console.log('📍 Leaving certifications section');
        break;
      }
      
      if (!inCertSection) continue;
      
      // Extract certification entries (usually bulleted)
      if (line.startsWith('•') || line.startsWith('-') || (line.length > 10 && !line.includes(':'))) {
        const certText = line.replace(/^[•\-*]\s*/, '').trim();
        
        // Try to extract issuer and date
        const issuerPattern = /(?:issued by|from|by):?\s*([^,\n]+)/i;
        const datePattern = /(?:date|issued):?\s*(\w+\s+\d{4}|\d{4})/i;
        
        const issuerMatch = certText.match(issuerPattern);
        const dateMatch = certText.match(datePattern);
        
        // Get cert name (before issuer/date markers)
        const certName = certText.split(/(?:issued by|from|by|date|issued):?/i)[0].trim();
        
        if (certName.length > 5) {
          certifications.push({
            id: `cert_${Date.now()}_${certifications.length}`,
            certification_name: certName,
            issuer: issuerMatch ? issuerMatch[1].trim() : '',
            date_issued: dateMatch ? dateMatch[1].trim() : '',
            expiry_date: '',
            credential_id: ''
          });
          
          console.log('✅ Added certification:', certName);
        }
      }
    }
    
    console.log('📊 Total certifications extracted:', certifications.length);
    return certifications;
  }
  
  /**
   * Extract projects
   */
  private extractProjects(text: string, lines: string[]): any[] {
    // Projects are rarely in CVs like this, return empty array
    // This can be improved if needed
    return [];
  }
  
  /**
   * Check if line is a section header
   */
  private isSectionHeader(line: string): boolean {
    const headers = [
      'professional summary', 'summary', 'profile', 'objective',
      'education', 'academic', 'qualifications',
      'experience', 'work experience', 'employment',
      'skills', 'competencies', 'core competencies',
      'certifications', 'certificates', 'training',
      'projects', 'portfolio',
      'personal values', 'references', 'programs'
    ];
    
    const lineLower = line.toLowerCase().trim();
    return headers.some(h => lineLower === h || lineLower.includes(h));
  }
  
  /**
   * Extract dates from text
   */
  private extractDates(text: string): { start: string; end: string; isCurrent: boolean } {
    const isCurrent = /\b(present|current|ongoing|now)\b/i.test(text);
    
    // Match patterns like "Feb 2025 – Apr 2025" or "2021 - 2026"
    const dateRangePattern = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s*(\d{4})\s*[-–—]\s*(Present|Current|Now|(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s*(\d{4}))/i;
    const rangeMatch = text.match(dateRangePattern);
    
    if (rangeMatch) {
      const start = `${rangeMatch[1]} ${rangeMatch[2]}`;
      const end = isCurrent ? 'Present' : (rangeMatch[5] ? `${rangeMatch[4]} ${rangeMatch[5]}` : rangeMatch[3]);
      return { start, end, isCurrent };
    }
    
    // Fallback: just look for any years
    const yearPattern = /\b(19|20)\d{2}\b/g;
    const years = text.match(yearPattern);
    
    if (years && years.length >= 2) {
      return {
        start: years[0],
        end: isCurrent ? 'Present' : years[1],
        isCurrent
      };
    }
    
    return { start: '', end: '', isCurrent: false };
  }
}

export default new CVParserService();