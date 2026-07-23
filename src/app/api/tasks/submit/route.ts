import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { TaskStatus } from '@prisma/client';

import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { uploadResume } from '@/lib/storage'; // Reusable S3 uploader
import { sendSubmissionConfirmEmail, sendAdminAlertEmail } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const candidateId = formData.get('candidateId') as string;
    const submissionNotes = formData.get('submissionNotes') as string;
    const file = formData.get('file') as File | null;
    const url = formData.get('url') as string;

    if (!candidateId) {
      return NextResponse.json({ error: 'candidateId is required' }, { status: 400 });
    }

    // Security check: Candidate can only submit for themselves
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      select: { googleId: true, email: true, fullName: true },
    });
    if (!candidate || candidate.googleId !== session.user.googleId) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }

    // Retrieve active task
    const task = await prisma.task.findUnique({
      where: { candidateId },
    });

    if (!task) {
      return NextResponse.json({ error: 'No task assigned for this candidate.' }, { status: 404 });
    }

    // Check if the task is already submitted or overdue
    const now = new Date();
    if (now > new Date(task.deadline)) {
      await prisma.task.update({
        where: { id: task.id },
        data: { status: TaskStatus.OVERDUE },
      });
      return NextResponse.json({ error: 'The assignment deadline has passed. Submissions locked.' }, { status: 400 });
    }

    // Determine upload URL or live link
    let submissionUrl = '';
    if (file) {
      try {
        submissionUrl = await uploadResume(file);
      } catch (storageError) {
        console.error('File storage upload failed:', storageError);
        return NextResponse.json({ error: 'Failed to upload assignment file. Verify storage settings.' }, { status: 502 });
      }
    } else if (url?.trim()) {
      submissionUrl = url.trim();
    } else {
      return NextResponse.json({ error: 'Please submit a file or paste a submission link.' }, { status: 400 });
    }

    // Update task record
    const updatedTask = await prisma.task.update({
      where: { id: task.id },
      data: {
        submissionUrl,
        submissionNotes: submissionNotes || null,
        submittedAt: now,
        status: TaskStatus.SUBMITTED,
      },
    });

    console.log(`Task ${task.id} submitted successfully by candidate.`);

    // Dispatch emails asynchronously in the background
    sendSubmissionConfirmEmail(candidate.email, candidate.fullName, task.title).catch((e) =>
      console.error('Failed to send task submission confirmation email:', e)
    );

    const adminEmails = (process.env.ADMIN_EMAILS || 'admin@example.com').split(',');
    const primaryAdmin = adminEmails[0];
    sendAdminAlertEmail(
      primaryAdmin,
      candidate.fullName,
      'SUBMISSION',
      `Submitted solution for technical assignment: "${task.title}".`
    ).catch((e) => console.error('Failed to send admin alert email:', e));

    return NextResponse.json({ success: true, task: updatedTask });
  } catch (error) {
    console.error('Error submitting task:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
