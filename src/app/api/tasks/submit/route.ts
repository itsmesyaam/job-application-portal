import { NextResponse } from 'next/server';
import { createClient as createServerClientInstance } from '@/lib/supabase/server';
import { sendSubmissionConfirmEmail, sendAdminAlertEmail } from '@/lib/email';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const supabase = await createServerClientInstance();
    const { data: { user } } = await supabase.auth.getUser();

    const formData = await request.formData();
    const candidateId = formData.get('candidateId') as string;
    const submissionNotes = formData.get('submissionNotes') as string;
    const file = formData.get('file') as File | null;
    const url = formData.get('url') as string;

    if (!candidateId) {
      return NextResponse.json({ error: 'candidateId is required' }, { status: 400 });
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Security check: Candidate can only submit for themselves
    if (user.id !== candidateId) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }

    // Retrieve candidate profile
    const { data: candidate, error: candError } = await supabase
      .from('candidates')
      .select('full_name, email')
      .eq('id', candidateId)
      .single();

    if (candError || !candidate) {
      return NextResponse.json({ error: 'Candidate profile not found.' }, { status: 404 });
    }

    // Retrieve active task
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('*')
      .eq('candidate_id', candidateId)
      .maybeSingle();

    if (taskError || !task) {
      return NextResponse.json({ error: 'No task assigned for this candidate.' }, { status: 404 });
    }

    // Check if the task is already overdue
    const now = new Date();
    if (now > new Date(task.deadline)) {
      await supabase
        .from('tasks')
        .update({ status: 'OVERDUE' })
        .eq('id', task.id);

      return NextResponse.json({ error: 'The assignment deadline has passed. Submissions locked.' }, { status: 400 });
    }

    // Determine upload URL or live link
    let submissionUrl = '';
    if (file) {
      const rawExtension = file.name.split('.').pop() || '';
      const fileExtension = ['zip', 'pdf'].includes(rawExtension.toLowerCase()) 
        ? rawExtension.toLowerCase() 
        : 'bin';

      if (fileExtension === 'bin') {
        return NextResponse.json({ error: 'Malicious or unsupported file extension. Only ZIP and PDF files are allowed.' }, { status: 400 });
      }

      const fileKey = `${candidateId}/${crypto.randomUUID()}.${fileExtension}`;
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Upload to private task-submissions bucket
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('task-submissions')
        .upload(fileKey, buffer, {
          contentType: file.type,
          upsert: true,
        });

      if (uploadError) {
        console.error('File storage upload failed:', uploadError);
        return NextResponse.json({ error: 'Failed to upload assignment file. Verify storage settings.' }, { status: 502 });
      }

      // Save key path as url
      submissionUrl = uploadData.path;
    } else if (url?.trim()) {
      submissionUrl = url.trim();
    } else {
      return NextResponse.json({ error: 'Please submit a file or paste a submission link.' }, { status: 400 });
    }

    // Update task record
    const { data: updatedTask, error: updateError } = await supabase
      .from('tasks')
      .update({
        submission_url: submissionUrl,
        submission_notes: submissionNotes || null,
        submitted_at: now.toISOString(),
        status: 'SUBMITTED',
      })
      .eq('id', task.id)
      .select('*')
      .single();

    if (updateError) {
      console.error('Error updating task in database:', updateError);
      return NextResponse.json({ error: 'Failed to update task submission.' }, { status: 500 });
    }

    // Also update candidate status in db
    await supabase
      .from('candidates')
      .update({ status: 'SUBMITTED' })
      .eq('id', candidateId);

    // Dispatch emails asynchronously in the background
    sendSubmissionConfirmEmail(candidate.email, candidate.full_name, task.title).catch((e) =>
      console.error('Failed to send task submission confirmation email:', e)
    );

    const adminEmails = (process.env.ADMIN_EMAILS || 'admin@yourdomain.com').split(',');
    const primaryAdmin = adminEmails[0];
    sendAdminAlertEmail(
      primaryAdmin,
      candidate.full_name,
      'SUBMISSION',
      `Submitted solution for technical assignment: "${task.title}".`
    ).catch((e) => console.error('Failed to send admin alert email:', e));

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
    console.error('Error submitting task:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
