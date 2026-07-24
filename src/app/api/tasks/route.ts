import { NextResponse } from 'next/server';
import { createClient as createServerClientInstance } from '@/lib/supabase/server';
import { sendShortlistEmail } from '@/lib/email';

const ADMIN_LIST = (process.env.ADMIN_EMAILS || 'admin@yourdomain.com,jane.doe@example.com').split(',');

export async function GET(request: Request) {
  try {
    const supabase = await createServerClientInstance();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const candidateId = searchParams.get('candidateId');

    if (!candidateId) {
      return NextResponse.json({ error: 'candidateId parameter is required' }, { status: 400 });
    }

    let isAdmin = ADMIN_LIST.includes(user.email || '');

    if (!isAdmin && user.id !== candidateId) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }

    // Fetch candidate's task
    const { data: task, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('candidate_id', candidateId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching task:', error);
      return NextResponse.json({ error: 'Failed to retrieve task.' }, { status: 500 });
    }

    let resultTask = task;

    if (task) {
      // Dynamic Overdue Expiry Check
      const now = new Date();
      if (task.status === 'ASSIGNED' && now > new Date(task.deadline)) {
        const { data: updated } = await supabase
          .from('tasks')
          .update({ status: 'OVERDUE' })
          .eq('id', task.id)
          .select('*')
          .single();
        resultTask = updated;
      }
    }

    const serializedTask = resultTask ? {
      id: resultTask.id,
      title: resultTask.title,
      instructions: resultTask.instructions,
      assignedAt: resultTask.assigned_at,
      deadline: resultTask.deadline,
      submissionUrl: resultTask.submission_url || undefined,
      submissionNotes: resultTask.submission_notes || undefined,
      submittedAt: resultTask.submitted_at || undefined,
      status: resultTask.status,
    } : null;

    return NextResponse.json({ success: true, task: serializedTask });
  } catch (error) {
    console.error('Error fetching task:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerClientInstance();
    const { data: { user } } = await supabase.auth.getUser();

    const isAdmin = user ? ADMIN_LIST.includes(user.email || '') : false;
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized. Admins only.' }, { status: 401 });
    }

    const body = await request.json();
    const { candidateId, title, instructions } = body;

    if (!candidateId || !title?.trim() || !instructions?.trim()) {
      return NextResponse.json({ error: 'Missing required parameters.' }, { status: 400 });
    }

    // Fetch candidate
    const { data: candidate, error: candError } = await supabase
      .from('candidates')
      .select('*')
      .eq('id', candidateId)
      .single();

    if (candError || !candidate) {
      return NextResponse.json({ error: 'Candidate not found.' }, { status: 404 });
    }

    const now = new Date();
    const deadline = new Date(now.getTime() + 48 * 60 * 60 * 1000); // strictly +48 hours

    // Delete existing tasks to allow re-assigning
    await supabase.from('tasks').delete().eq('candidate_id', candidateId);

    // Create the new task
    const { data: newTask, error: insertError } = await supabase
      .from('tasks')
      .insert({
        candidate_id: candidateId,
        title: title.trim(),
        instructions: instructions.trim(),
        assigned_at: now.toISOString(),
        deadline: deadline.toISOString(),
        status: 'ASSIGNED',
      })
      .select('*')
      .single();

    if (insertError) {
      console.error('Error creating task:', insertError);
      return NextResponse.json({ error: 'Failed to create task assignment.' }, { status: 500 });
    }

    // Update candidate status to TASK_ASSIGNED in PostgreSQL database
    const { error: updateError } = await supabase
      .from('candidates')
      .update({ status: 'TASK_ASSIGNED' })
      .eq('id', candidateId);

    if (updateError) {
      console.error('Error updating candidate status:', updateError);
      return NextResponse.json({ error: 'Failed to update candidate status.' }, { status: 500 });
    }

    // Dispatch email notification
    sendShortlistEmail(
      candidate.email, 
      candidate.full_name, 
      candidate.position, 
      title, 
      deadline
    ).catch(e => console.error('Failed to send shortlist email notification:', e));

    const serializedTask = {
      id: newTask.id,
      title: newTask.title,
      instructions: newTask.instructions,
      assignedAt: newTask.assigned_at,
      deadline: newTask.deadline,
      status: newTask.status,
    };

    return NextResponse.json({ success: true, task: serializedTask });
  } catch (error) {
    console.error('Error assigning task:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
