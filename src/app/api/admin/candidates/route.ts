import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Position, ApplicationStatus, Prisma } from '@prisma/client';

import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    // 1. Authorize Admin Session
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized access. Admins only.' }, { status: 401 });
    }

    // 2. Parse Query Parameters
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const position = searchParams.get('position') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const skip = (page - 1) * limit;

    // 3. Build Prisma Conditions
    const where: Prisma.CandidateWhereInput = {};

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status as ApplicationStatus;
    }

    if (position) {
      where.position = position as Position;
    }

    // 4. Query DB for candidates list & totals
    const [candidates, filteredTotal] = await Promise.all([
      prisma.candidate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.candidate.count({ where }),
    ]);

    // 5. Gather dashboard aggregation stats
    const statsGroup = await prisma.candidate.groupBy({
      by: ['status'],
      _count: {
        id: true,
      },
    });

    const stats = {
      total: await prisma.candidate.count(),
      pending: statsGroup.find((s) => s.status === ApplicationStatus.PENDING)?._count.id || 0,
      reviewed: statsGroup.find((s) => s.status === ApplicationStatus.REVIEWED)?._count.id || 0,
      shortlisted: statsGroup.find((s) => s.status === ApplicationStatus.SHORTLISTED)?._count.id || 0,
      rejected: statsGroup.find((s) => s.status === ApplicationStatus.REJECTED)?._count.id || 0,
    };

    return NextResponse.json({
      candidates,
      pagination: {
        total: filteredTotal,
        page,
        limit,
        totalPages: Math.ceil(filteredTotal / limit),
      },
      stats,
    });
  } catch (error) {
    console.error('Error fetching candidates for admin:', error);
    return NextResponse.json({ error: 'Failed to retrieve candidates.' }, { status: 500 });
  }
}
