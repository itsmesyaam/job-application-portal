import { NextResponse } from 'next/server';
import { createClient as createServerClientInstance } from '@/lib/supabase/server';
import { jobApplicationSchema } from '@/schemas/application';
import { sendWelcomeEmail } from '@/lib/email';
import crypto from 'crypto';

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

    // 1. Authenticate session
    const supabase = await createServerClientInstance();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required. Please sign in.' },
        { status: 401 }
      );
    }

    const candidateId = user.id;
    const candidateEmail = user.email;

    // 2. Schema Validation (Server-side check)
    const validationResult = jobApplicationSchema.safeParse({
      fullName,
      email: candidateEmail,
      phoneNumber,
      portfolioUrl: portfolioUrl || undefined,
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

    if (!resume) {
      return NextResponse.json(
        { success: false, error: 'Resume file is required.' },
        { status: 400 }
      );
    }

    // 3. File Upload to Supabase Storage
    const rawExtension = resume.name.split('.').pop() || '';
    const fileExtension = ['pdf', 'docx', 'doc'].includes(rawExtension.toLowerCase()) 
      ? rawExtension.toLowerCase() 
      : 'bin';

    if (fileExtension === 'bin') {
      return NextResponse.json(
        { success: false, error: 'Malicious or unsupported file extension detected.' },
        { status: 400 }
      );
    }

    const fileKey = `${candidateId}/${crypto.randomUUID()}.${fileExtension}`;
    const arrayBuffer = await resume.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload directly to private bucket
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('resumes')
      .upload(fileKey, buffer, {
        contentType: resume.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('Supabase Storage upload failed:', uploadError);
      return NextResponse.json(
        { success: false, error: 'Failed to upload resume to storage.' },
        { status: 502 }
      );
    }

    // 4. Save/Upsert Candidate details in PostgreSQL candidates table
    const { error: dbError } = await supabase
      .from('candidates')
      .upsert({
        id: candidateId,
        full_name: fullName,
        email: candidateEmail,
        phone: phoneNumber,
        portfolio_url: portfolioUrl || null,
        resume_url: uploadData.path,
        position,
        years_of_experience: parseInt(yearsOfExperience, 10),
        cover_letter: coverLetter || null,
        status: 'PENDING',
        created_at: new Date().toISOString(),
      });

    if (dbError) {
      console.error('Database write failed:', dbError);
      return NextResponse.json(
        { success: false, error: 'Failed to save application to database.' },
        { status: 500 }
      );
    }

    // Dispatch Welcome Email in the background
    sendWelcomeEmail(candidateEmail || '', fullName, position).catch((e) =>
      console.error('Failed to dispatch welcome email:', e)
    );

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
