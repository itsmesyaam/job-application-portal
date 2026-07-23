import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { Position } from '@prisma/client';

import { jobApplicationSchema } from '@/schemas/application';
import { authOptions } from '../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { uploadResume } from '@/lib/storage';
import { sendWelcomeEmail } from '@/lib/email';

// Map frontend dropdown positions to Prisma Enum Positions
const POSITION_MAP: Record<string, Position> = {
  'UI/UX Designer': Position.UI_UX_DESIGNER,
  'Full Stack Developer': Position.FULL_STACK_DEVELOPER,
  'Mobile Developer': Position.MOBILE_DEVELOPER,
  'Software Tester / QA': Position.TESTER,
  'HR Manager': Position.HR,
  'Digital Marketer': Position.DIGITAL_MARKETER,
  'Intern': Position.INTERN,
};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    
    // Extract fields from formData
    const fullName = formData.get('fullName') as string;
    const email = formData.get('email') as string;
    const phoneNumber = formData.get('phoneNumber') as string;
    const portfolioUrl = formData.get('portfolioUrl') as string;
    const position = formData.get('position') as string;
    const yearsOfExperience = formData.get('yearsOfExperience') as string;
    const coverLetter = formData.get('coverLetter') as string;
    const resume = formData.get('resume') as File | null;
    const isDemo = formData.get('isDemo') === 'true';
    
    // 1. Authenticate Request
    const session = await getServerSession(authOptions);
    let googleId = session?.user?.googleId;

    // Dev mode fallback for demo user simulation
    if (!googleId) {
      if (process.env.NODE_ENV === 'development' && isDemo) {
        googleId = `demo-google-id-${email.replace(/[^a-zA-Z0-9]/g, '')}`;
      } else {
        return NextResponse.json(
          { success: false, error: 'Authentication required. Please sign in with Google.' },
          { status: 401 }
        );
      }
    }

    // 2. Schema Validation (Server-side check)
    const validationResult = jobApplicationSchema.safeParse({
      fullName,
      email,
      phoneNumber,
      portfolioUrl,
      position,
      yearsOfExperience,
      coverLetter,
      resume,
    });
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          errors: validationResult.error.flatten().fieldErrors 
        },
        { status: 400 }
      );
    }

    const mappedPosition = POSITION_MAP[position];
    if (!mappedPosition) {
      return NextResponse.json(
        { success: false, error: 'Invalid position selected.' },
        { status: 400 }
      );
    }

    if (!resume) {
      return NextResponse.json(
        { success: false, error: 'Resume file is required.' },
        { status: 400 }
      );
    }

    // 3. File Upload to S3/Supabase Storage
    let resumeUrl = '';
    try {
      resumeUrl = await uploadResume(resume);
    } catch (storageError) {
      console.error('File storage upload failed:', storageError);
      return NextResponse.json(
        { success: false, error: 'Failed to upload resume. Please verify S3 settings.' },
        { status: 502 }
      );
    }

    // 4. Save Candidate Profile in DB using Prisma Client
    try {
      const candidate = await prisma.candidate.upsert({
        where: { email },
        update: {
          googleId,
          fullName,
          phone: phoneNumber,
          portfolioUrl: portfolioUrl || null,
          resumeUrl,
          position: mappedPosition,
          yearsOfExperience: parseInt(yearsOfExperience, 10),
          coverLetter: coverLetter || null,
          status: 'PENDING', // Reset status on re-application
        },
        create: {
          googleId,
          fullName,
          email,
          phone: phoneNumber,
          portfolioUrl: portfolioUrl || null,
          resumeUrl,
          position: mappedPosition,
          yearsOfExperience: parseInt(yearsOfExperience, 10),
          coverLetter: coverLetter || null,
          status: 'PENDING',
        },
      });

      console.log('Candidate successfully saved to DB:', candidate.id);

      // Dispatch Welcome Email in the background
      const humanFriendlyPosition = Object.keys(POSITION_MAP).find(
        (key) => POSITION_MAP[key] === candidate.position
      ) || candidate.position;
      
      sendWelcomeEmail(candidate.email, candidate.fullName, humanFriendlyPosition).catch((e) =>
        console.error('Failed to dispatch welcome email:', e)
      );
    } catch (dbError) {
      console.error('Database write failed:', dbError);
      return NextResponse.json(
        { success: false, error: 'Failed to save application to database.' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Application submitted successfully! Our hiring team will review your credentials and get back to you shortly.',
    });
  } catch (error) {
    console.error('Error handling application submission:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error while processing application.' },
      { status: 500 }
    );
  }
}
