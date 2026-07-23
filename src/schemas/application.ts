import { z } from 'zod';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc
];

// Regex for international phone numbers starting with '+'
// Matches: +1 (555) 123-4567, +91 98765 43210, +442079460192, etc.
const phoneRegex = /^\+[1-9][0-9\s\-\(\)]{7,15}$/;

export const jobApplicationSchema = z.object({
  fullName: z
    .string()
    .min(2, { message: 'Full name must be at least 2 characters.' })
    .max(100, { message: 'Full name cannot exceed 100 characters.' })
    .regex(/^[a-zA-Z\s]*$/, { message: 'Full name can only contain letters and spaces.' }),
  
  email: z
    .string()
    .email({ message: 'Please enter a valid email address.' }),
  
  phoneNumber: z
    .string()
    .regex(phoneRegex, {
      message: 'Enter a valid international phone number starting with + (e.g. +1 555 123 4567).',
    }),
  
  portfolioUrl: z
    .string()
    .url({ message: 'Please enter a valid URL.' })
    .optional()
    .or(z.literal('')),
  
  resume: z
    .any()
    .refine((val) => {
      if (!val) return false;
      if (typeof window !== 'undefined' && val instanceof FileList) {
        return val.length > 0;
      }
      if (val instanceof File) return true;
      if (typeof val === 'string') return true;
      return false;
    }, 'Resume file is required.')
    .refine((val) => {
      const file = typeof window !== 'undefined' && val instanceof FileList ? val[0] : val;
      if (typeof val === 'string') return true;
      return !file || file.size <= MAX_FILE_SIZE;
    }, 'Resume file size must not exceed 5MB.')
    .refine((val) => {
      const file = typeof window !== 'undefined' && val instanceof FileList ? val[0] : val;
      if (typeof val === 'string') return true;
      if (!file) return false;
      const fileType = file.type;
      const fileName = file.name.toLowerCase();
      const hasValidExt = fileName.endsWith('.pdf') || fileName.endsWith('.docx') || fileName.endsWith('.doc');
      return ACCEPTED_FILE_TYPES.includes(fileType) || hasValidExt;
    }, 'Only PDF, DOC, and DOCX files are allowed.'),
  
  position: z.enum(
    [
      'UI/UX Designer',
      'Full Stack Developer',
      'Mobile Developer',
      'Tester',
      'HR',
      'Digital Marketer',
      'Intern',
    ],
    {
      message: 'Please select a valid position.',
    }
  ),
  
  yearsOfExperience: z.coerce
    .number()
    .int({ message: 'Years of experience must be an integer.' })
    .min(0, { message: 'Years of experience cannot be negative.' })
    .max(50, { message: 'Years of experience must be realistic (0-50).' }),
  
  coverLetter: z
    .string()
    .min(50, { message: 'Cover letter or short bio must be at least 50 characters.' })
    .max(5000, { message: 'Cover letter cannot exceed 5000 characters.' }),
});

export type JobApplicationInput = z.infer<typeof jobApplicationSchema>;
