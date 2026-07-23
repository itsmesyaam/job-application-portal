import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Lock } from 'lucide-react';

import { authOptions } from '../api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { CandidateDashboardClient } from '@/components/CandidateDashboardClient';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
        <div className="max-w-md w-full border border-slate-900 bg-slate-900/40 backdrop-blur-xl p-8 rounded-2xl text-center space-y-6 shadow-2xl relative">
          <div className="absolute top-[-30px] left-1/2 -translate-x-1/2 w-14 h-14 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-center text-rose-400">
            <Lock className="w-6 h-6" />
          </div>
          
          <div className="space-y-2 pt-4">
            <h3 className="text-xl font-bold text-slate-100">Authentication Required</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Please sign in with Google on the home page to access your applicant dashboard.
            </p>
          </div>
          
          <div className="border-t border-slate-800 pt-5">
            <Link 
              href="/" 
              className="w-full inline-block bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-xl shadow-md transition-all text-sm text-center"
            >
              Go to Login Page
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Find candidate by email or googleId
  const candidate = await prisma.candidate.findFirst({
    where: {
      OR: [
        { email: session.user.email || '' },
        { googleId: session.user.googleId || '' }
      ]
    },
    include: {
      task: true
    }
  });

  // Redirect to application form if they haven't applied yet
  if (!candidate) {
    redirect('/');
  }

  // Map database enum to human friendly text
  const formatPosition = (pos: string) => {
    return pos.split('_').map(word => 
      word.charAt(0) + word.slice(1).toLowerCase()
    ).join(' ').replace('Ui Ux', 'UI/UX');
  };

  const serializedCandidate = {
    id: candidate.id,
    googleId: candidate.googleId,
    fullName: candidate.fullName,
    email: candidate.email,
    phone: candidate.phone,
    portfolioUrl: candidate.portfolioUrl || undefined,
    resumeUrl: candidate.resumeUrl,
    position: formatPosition(candidate.position),
    yearsOfExperience: candidate.yearsOfExperience,
    coverLetter: candidate.coverLetter || undefined,
    status: candidate.status,
    createdAt: candidate.createdAt.toISOString(),
    task: candidate.task ? {
      id: candidate.task.id,
      title: candidate.task.title,
      instructions: candidate.task.instructions,
      taskFileUrl: candidate.task.taskFileUrl || undefined,
      assignedAt: candidate.task.assignedAt.toISOString(),
      deadline: candidate.task.deadline.toISOString(),
      submissionUrl: candidate.task.submissionUrl || undefined,
      submissionNotes: candidate.task.submissionNotes || undefined,
      submittedAt: candidate.task.submittedAt ? candidate.task.submittedAt.toISOString() : undefined,
      status: candidate.task.status,
    } : null
  };

  return (
    <CandidateDashboardClient 
      initialCandidate={serializedCandidate} 
    />
  );
}
