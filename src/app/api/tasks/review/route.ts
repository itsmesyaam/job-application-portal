import { NextResponse } from 'next/server';
import { createClient as createServerClientInstance } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const ADMIN_LIST = (process.env.ADMIN_EMAILS || 'admin@yourdomain.com,jane.doe@example.com').split(',');

function getAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerClientInstance();
    const { data: { user } } = await supabase.auth.getUser();

    const isAdmin = user ? ADMIN_LIST.includes(user.email || '') : false;
    
    const body = await request.json();
    const { taskId, status, isDemo } = body;

    if (!taskId || !status) {
      return NextResponse.json({ error: 'Missing required parameters.' }, { status: 400 });
    }

    if (status !== 'ACCEPTED' && status !== 'REJECTED') {
      return NextResponse.json({ error: 'Invalid review status. Must be ACCEPTED or REJECTED.' }, { status: 400 });
    }

    let clientToUse = supabase;

    if (!user) {
      if (isDemo) {
        clientToUse = getAdminClient();
      } else {
        return NextResponse.json({ error: 'Unauthorized access.' }, { status: 401 });
      }
    } else if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized access. Admins only.' }, { status: 401 });
    }

    // 3. Update Task Status in DB
    const { data: updatedTask, error: updateError } = await clientToUse
      .from('tasks')
      .update({ status })
      .eq('id', taskId)
      .select('*')
      .single();

    if (updateError) {
      console.error('Error updating task review status:', updateError);
      return NextResponse.json({ error: 'Failed to update task review status.' }, { status: 500 });
    }

    // Update candidate status accordingly
    if (status === 'REJECTED') {
      await clientToUse
        .from('candidates')
        .update({ status: 'REJECTED' })
        .eq('id', updatedTask.candidate_id);
    }

    console.log(`Task ${taskId} reviewed by admin. Decision: ${status}`);

    const serializedTask = {
      id: updatedTask.id,
      title: updatedTask.title,
      instructions: updatedTask.instructions,
      assignedAt: updatedTask.assigned_at,
      deadline: updatedTask.deadline,
      submissionUrl: updatedTask.submission_url,
      submissionNotes: updatedTask.submission_notes,
      submittedAt: updatedTask.submitted_at,
      status: updatedTask.status,
    };

    return NextResponse.json({ success: true, task: serializedTask });
  } catch (error) {
    console.error('Error reviewing task:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
