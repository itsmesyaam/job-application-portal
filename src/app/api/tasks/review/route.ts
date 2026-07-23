import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { TaskStatus } from '@prisma/client';

import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    // 1. Authenticate Request (Admin Only)
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized access. Admins only.' }, { status: 401 });
    }

    // 2. Parse request body
    const body = await request.json();
    const { taskId, status } = body;

    if (!taskId || !status) {
      return NextResponse.json({ error: 'Missing required parameters.' }, { status: 400 });
    }

    if (status !== TaskStatus.ACCEPTED && status !== TaskStatus.REJECTED) {
      return NextResponse.json({ error: 'Invalid review status. Must be ACCEPTED or REJECTED.' }, { status: 400 });
    }

    // 3. Update Task Status in DB using Prisma Client
    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: { status: status as TaskStatus },
    });

    console.log(`Task ${taskId} reviewed by admin. Decision: ${status}`);

    return NextResponse.json({ success: true, task: updatedTask });
  } catch (error) {
    console.error('Error reviewing task:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
