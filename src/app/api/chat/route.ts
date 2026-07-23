import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { SenderType } from '@prisma/client';
import { sendAdminAlertEmail } from '@/lib/email';

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

    // Security check: Candidates can only fetch their own chat; Admins can fetch any
    if (!session.user.isAdmin) {
      const candidate = await prisma.candidate.findUnique({
        where: { id: candidateId },
        select: { googleId: true },
      });
      if (!candidate || candidate.googleId !== session.user.googleId) {
        return NextResponse.json({ error: 'Access denied. Unauthorized chat access.' }, { status: 403 });
      }
    }

    // Dynamically mark incoming messages from the opposite party as read
    const opposingSenderType = session.user.isAdmin ? SenderType.CANDIDATE : SenderType.ADMIN;
    await prisma.message.updateMany({
      where: {
        candidateId,
        senderType: opposingSenderType,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    // Fetch messages sorted by creation date
    const messages = await prisma.message.findMany({
      where: { candidateId },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ success: true, messages });
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { candidateId, content, senderType, attachmentUrl } = body;

    if (!candidateId || !content?.trim() || !senderType) {
      return NextResponse.json({ error: 'Missing required parameters.' }, { status: 400 });
    }

    // Role-based Security Enforcement
    if (session.user.isAdmin) {
      if (senderType !== SenderType.ADMIN) {
        return NextResponse.json({ error: 'Admins can only send messages as ADMIN.' }, { status: 403 });
      }
    } else {
      if (senderType !== SenderType.CANDIDATE) {
        return NextResponse.json({ error: 'Candidates can only send messages as CANDIDATE.' }, { status: 403 });
      }
      
      const candidate = await prisma.candidate.findUnique({
        where: { id: candidateId },
        select: { googleId: true, fullName: true },
      });
      if (!candidate || candidate.googleId !== session.user.googleId) {
        return NextResponse.json({ error: 'Access denied. Unauthorized chat sender.' }, { status: 403 });
      }
    }

    // Save message to database
    const message = await prisma.message.create({
      data: {
        candidateId,
        content: content.trim(),
        senderType: senderType as SenderType,
        attachmentUrl: attachmentUrl || null,
        isRead: false,
      },
    });

    // Alert HR Admins on new candidate messages
    if (senderType === SenderType.CANDIDATE) {
      const candidateName = session.user.name || 'Candidate';
      const adminEmails = (process.env.ADMIN_EMAILS || 'admin@example.com').split(',');
      const primaryAdmin = adminEmails[0];
      
      sendAdminAlertEmail(
        primaryAdmin,
        candidateName,
        'CHAT',
        content.trim()
      ).catch((e) => console.error('Failed to send admin chat alert email:', e));
    }

    return NextResponse.json({ success: true, message });
  } catch (error) {
    console.error('Error sending chat message:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
