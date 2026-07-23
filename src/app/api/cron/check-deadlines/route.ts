import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { sendTaskReminderEmail } from '@/lib/email';

function getAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
}

export async function GET(request: Request) {
  try {
    // 1. Authorize Cron request via Bearer Token Header
    const authHeader = request.headers.get('Authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized Access. Invalid Cron Secret token.' }, { status: 401 });
    }

    const supabase = getAdminClient();
    const now = new Date();

    // 2. Action A: Expire all ASSIGNED tasks past their deadline
    const { data: overdueTasks, error: fetchError } = await supabase
      .from('tasks')
      .select('*, candidates(*)')
      .eq('status', 'ASSIGNED')
      .lt('deadline', now.toISOString());

    if (fetchError) throw fetchError;

    const overdueUpdates = (overdueTasks || []).map(async (task: any) => {
      const candidate = task.candidates;
      const candidateName = candidate ? candidate.full_name : 'Unknown';

      // Set task to OVERDUE
      await supabase
        .from('tasks')
        .update({ status: 'OVERDUE' })
        .eq('id', task.id);

      // Set candidate status to REJECTED
      await supabase
        .from('candidates')
        .update({ status: 'REJECTED' })
        .eq('id', task.candidate_id);

      console.log(`[Cron Task Overdue] Task ID: ${task.id} for Candidate: ${candidateName} has expired. Candidate rejected.`);
    });
    await Promise.all(overdueUpdates);

    // 3. Action B: Find tasks with 11-12 hours remaining and dispatch reminders
    const elevenHoursLater = new Date(now.getTime() + 11 * 60 * 60 * 1000);
    const twelveHoursLater = new Date(now.getTime() + 12 * 60 * 60 * 1000);

    const { data: reminderTasks, error: fetchRemError } = await supabase
      .from('tasks')
      .select('*, candidates(*)')
      .eq('status', 'ASSIGNED')
      .eq('reminder_sent', false)
      .gte('deadline', elevenHoursLater.toISOString())
      .lte('deadline', twelveHoursLater.toISOString());

    if (fetchRemError) throw fetchRemError;

    const reminderUpdates = (reminderTasks || []).map(async (task: any) => {
      const candidate = task.candidates;
      if (!candidate) return;

      try {
        await sendTaskReminderEmail(
          candidate.email,
          candidate.full_name,
          task.title,
          task.deadline
        );
        
        await supabase
          .from('tasks')
          .update({ reminder_sent: true })
          .eq('id', task.id);
        
        console.log(`[Cron Reminder Sent] Warning dispatched to Candidate: ${candidate.full_name}`);
      } catch (err) {
        console.error(`[Cron Reminder Error] Failed warning dispatch to candidate ${candidate.email}:`, err);
      }
    });
    await Promise.all(reminderUpdates);

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      overdueProcessed: overdueTasks?.length || 0,
      remindersSent: reminderTasks?.length || 0,
    });
  } catch (error) {
    console.error('Error running check-deadlines cron job:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
