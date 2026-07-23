import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const ADMIN_LIST = (process.env.ADMIN_EMAILS || 'admin@yourdomain.com,jane.doe@example.com').split(',');

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Authorize Admin Session
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const isAdmin = user ? ADMIN_LIST.includes(user.email || '') : false;
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized access. Admins only.' }, { status: 401 });
    }

    const { id } = await params;
    
    // 2. Parse request body
    const body = await request.json();
    const { status } = body;

    const allowedStatuses = ['PENDING', 'SHORTLISTED', 'TASK_ASSIGNED', 'SUBMITTED', 'REJECTED'];
    if (!status || !allowedStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status value.' }, { status: 400 });
    }

    // 3. Update candidate status in Supabase Database
    const { data: updatedCandidate, error } = await supabase
      .from('candidates')
      .update({ status })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('Error updating candidate in Supabase:', error);
      return NextResponse.json({ error: 'Failed to update candidate status in database.' }, { status: 500 });
    }

    console.log(`Candidate ${id} status updated to ${status}`);

    const serializedCandidate = {
      id: updatedCandidate.id,
      fullName: updatedCandidate.full_name,
      email: updatedCandidate.email,
      phone: updatedCandidate.phone,
      portfolioUrl: updatedCandidate.portfolio_url || undefined,
      resumeUrl: updatedCandidate.resume_url,
      position: updatedCandidate.position,
      yearsOfExperience: updatedCandidate.years_of_experience,
      coverLetter: updatedCandidate.cover_letter || undefined,
      status: updatedCandidate.status,
      createdAt: updatedCandidate.created_at,
    };

    return NextResponse.json({
      success: true,
      candidate: serializedCandidate,
    });
  } catch (error) {
    console.error('Error updating candidate status:', error);
    return NextResponse.json({ error: 'Failed to update candidate status.' }, { status: 500 });
  }
}
