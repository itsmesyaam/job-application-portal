import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { TaskStatus, ApplicationStatus } from '@prisma/client';

import { authOptions } from '../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { sendShortlistEmail } from '@/lib/email';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const candidateId = searchParams.get('candidateId');

    if (!candidateId) {
      return NextResponse.json({ error: 'candidateId parameter is required' }, { status: 400 });
    }

    // Security check: candidate can only read their own task; admin can read any
    if (!session.user.isAdmin) {
      const candidate = await prisma.candidate.findUnique({
        where: { id: candidateId },
        select: { googleId: true },
      });
      if (!candidate || candidate.googleId !== session.user.googleId) {
        return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
      }
    }

    // Fetch candidate's task
    let task = await prisma.task.findUnique({
      where: { candidateId },
    });

    if (task) {
      // Dynamic Overdue Expiry Check
      const now = new Date();
      if (task.status === TaskStatus.ASSIGNED && now > new Date(task.deadline)) {
        task = await prisma.task.update({
          where: { id: task.id },
          data: { status: TaskStatus.OVERDUE },
        });
      }
    }

    return NextResponse.json({ success: true, task });
  } catch (error) {
    console.error('Error fetching task:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized. Admins only.' }, { status: 401 });
    }

    const body = await request.json();
    const { candidateId, title, instructions, taskFileUrl } = body;

    if (!candidateId || !title?.trim() || !instructions?.trim()) {
      return NextResponse.json({ error: 'Missing required parameters.' }, { status: 400 });
    }

    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
    });

    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found.' }, { status: 404 });
    }

    const now = new Date();
    const deadline = new Date(now.getTime() + 48 * 60 * 60 * 1000); // strictly +48 hours

    // Atomic transaction: Create task & update candidate status to SHORTLISTED
    const result = await prisma.$transaction(async (tx) => {
      // Delete any existing task if it exists (allows re-assigning)
      await tx.task.deleteMany({
        where: { candidateId },
      });

      const newTask = await tx.task.create({
        data: {
          candidateId,
          title: title.trim(),
          instructions: instructions.trim(),
          taskFileUrl: taskFileUrl || null,
          assignedAt: now,
          deadline,
          status: TaskStatus.ASSIGNED,
        },
      });

      await tx.candidate.update({
        where: { id: candidateId },
        data: { status: ApplicationStatus.SHORTLISTED },
      });

      return newTask;
    });

    // Dispatch the mock email notification in the background
    sendShortlistEmail(
      candidate.email, 
      candidate.fullName, 
      candidate.position, 
      title, 
      deadline
    ).catch(e => console.error('Failed to send shortlist email notification:', e));

    return NextResponse.json({ success: true, task: result });
  } catch (error) {
    console.error('Error assigning task:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
