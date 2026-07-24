import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const ADMIN_LIST = (process.env.ADMIN_EMAILS || 'admin@yourdomain.com,jane.doe@example.com').split(',');

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const isAdmin = user ? ADMIN_LIST.includes(user.email || '') : false;
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized access. Admins only.' }, { status: 401 });
    }

    // 2. Parse Query Parameters
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const position = searchParams.get('position') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const skip = (page - 1) * limit;

    // 3. Build Supabase query with task relations
    let query = supabase
      .from('candidates')
      .select('id, full_name, email, phone, portfolio_url, resume_url, position, years_of_experience, cover_letter, status, created_at, tasks(id, title, instructions, assigned_at, deadline, submission_url, submission_notes, submitted_at, status)', { count: 'exact' });

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (position) {
      query = query.eq('position', position);
    }

    // 4. Query DB for candidates list & totals
    const { data: candidates, count: filteredTotal, error: queryError } = await query
      .order('created_at', { ascending: false })
      .range(skip, skip + limit - 1);

    if (queryError) {
      console.error('Candidate query error:', queryError);
      throw queryError;
    }

    // 5. Gather dashboard aggregation stats
    const { data: allCandidates, error: statsError } = await supabase
      .from('candidates')
      .select('status');

    if (statsError) {
      console.error('Stats fetch error:', statsError);
      throw statsError;
    }

    const stats = {
      total: allCandidates?.length || 0,
      pending: allCandidates?.filter(c => c.status === 'PENDING').length || 0,
      reviewed: allCandidates?.filter(c => c.status === 'SHORTLISTED').length || 0,
      shortlisted: allCandidates?.filter(c => c.status === 'SHORTLISTED').length || 0,
      taskAssigned: allCandidates?.filter(c => c.status === 'TASK_ASSIGNED').length || 0,
      submitted: allCandidates?.filter(c => c.status === 'SUBMITTED').length || 0,
      rejected: allCandidates?.filter(c => c.status === 'REJECTED').length || 0,
    };

    // Serialize keys to match camelCase expectations in CandidateTable.tsx
    const serializedCandidates = (candidates || []).map((c: any) => {
      const rawTask = c.tasks;
      const task = rawTask ? (Array.isArray(rawTask) ? rawTask[0] : rawTask) : null;
      
      return {
        id: c.id,
        fullName: c.full_name,
        email: c.email,
        phone: c.phone,
        portfolioUrl: c.portfolio_url || undefined,
        resumeUrl: c.resume_url,
        position: c.position,
        yearsOfExperience: c.years_of_experience,
        coverLetter: c.cover_letter || undefined,
        status: c.status,
        createdAt: c.created_at,
        task: task ? {
          id: task.id,
          title: task.title,
          instructions: task.instructions,
          assignedAt: task.assigned_at,
          deadline: task.deadline,
          submissionUrl: task.submission_url || undefined,
          submissionNotes: task.submission_notes || undefined,
          submittedAt: task.submitted_at || undefined,
          status: task.status,
        } : null
      };
    });

    return NextResponse.json({
      candidates: serializedCandidates,
      pagination: {
        total: filteredTotal || 0,
        page,
        limit,
        totalPages: Math.ceil((filteredTotal || 0) / limit),
      },
      stats,
    });
  } catch (error) {
    console.error('Error fetching candidates for admin:', error);
    return NextResponse.json({ error: 'Failed to retrieve candidates.' }, { status: 500 });
  }
}
