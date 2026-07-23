import { NextResponse } from 'next/server';
import { TaskStatus, ApplicationStatus } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { sendTaskReminderEmail } from '@/lib/email';

export async function GET(request: Request) {
  try {
    // 1. Authorize Cron request via Bearer Token Header
    const authHeader = request.headers.get('Authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized Access. Invalid Cron Secret token.' }, { status: 401 });
    }

    const now = new Date();

    // 2. Action A: Expire all ASSIGNED tasks past their deadline
    const overdueTasks = await prisma.task.findMany({
      where: {
        status: TaskStatus.ASSIGNED,
        deadline: { lt: now },
      },
      include: { candidate: true },
    });

    const overdueUpdates = overdueTasks.map(async (task) => {
      // Execute atomically in transaction: set task to OVERDUE and reject candidate status
      await prisma.$transaction([
        prisma.task.update({
          where: { id: task.id },
          data: { status: TaskStatus.OVERDUE },
        }),
        prisma.candidate.update({
          where: { id: task.candidateId },
          data: { status: ApplicationStatus.REJECTED },
        })
      ]);
      console.log(`[Cron Task Overdue] Task ID: ${task.id} for Candidate: ${task.candidate.fullName} has expired. Candidate rejected.`);
    });
    await Promise.all(overdueUpdates);

    // 3. Action B: Find tasks with 11-12 hours remaining and dispatch reminders
    const elevenHoursLater = new Date(now.getTime() + 11 * 60 * 60 * 1000);
    const twelveHoursLater = new Date(now.getTime() + 12 * 60 * 60 * 1000);

    const reminderTasks = await prisma.task.findMany({
      where: {
        status: TaskStatus.ASSIGNED,
        reminderSent: false,
        deadline: {
          gte: elevenHoursLater,
          lte: twelveHoursLater,
        },
      },
      include: { candidate: true },
    });

    const reminderUpdates = reminderTasks.map(async (task) => {
      try {
        await sendTaskReminderEmail(
          task.candidate.email,
          task.candidate.fullName,
          task.title,
          task.deadline
        );
        
        await prisma.task.update({
          where: { id: task.id },
          data: { reminderSent: true },
        });
        
        console.log(`[Cron Reminder Sent] Warning dispatched to Candidate: ${task.candidate.fullName}`);
      } catch (err) {
        console.error(`[Cron Reminder Error] Failed warning dispatch to candidate ${task.candidate.email}:`, err);
      }
    });
    await Promise.all(reminderUpdates);

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      overdueProcessed: overdueTasks.length,
      remindersSent: reminderTasks.length,
    });
  } catch (error) {
    console.error('Error running check-deadlines cron job:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
