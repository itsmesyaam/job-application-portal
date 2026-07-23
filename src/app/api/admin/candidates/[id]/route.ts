import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { ApplicationStatus } from '@prisma/client';

import { authOptions } from '../../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Authorize Admin Session
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized access. Admins only.' }, { status: 401 });
    }

    const { id } = await params;
    
    // 2. Parse request body
    const body = await request.json();
    const { status } = body;

    // Validate status value
    if (!status || !Object.values(ApplicationStatus).includes(status as ApplicationStatus)) {
      return NextResponse.json({ error: 'Invalid status value.' }, { status: 400 });
    }

    // 3. Update candidate status in PostgreSQL
    const updatedCandidate = await prisma.candidate.update({
      where: { id },
      data: { status: status as ApplicationStatus },
    });

    console.log(`Candidate ${id} status updated to ${status}`);

    return NextResponse.json({
      success: true,
      candidate: updatedCandidate,
    });
  } catch (error) {
    console.error('Error updating candidate status:', error);
    return NextResponse.json({ error: 'Failed to update candidate status.' }, { status: 500 });
  }
}
