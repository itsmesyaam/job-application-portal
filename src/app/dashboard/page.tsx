import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Lock } from 'lucide-react';

import { createClient } from '@/lib/supabase/server';
import { CandidateDashboardClient } from '@/components/CandidateDashboardClient';

export default async function DashboardPage() {
  const supabase = await createClient();
  
  // 1. Authenticate server-side user
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
        <div className="max-w-md w-full border border-slate-900 bg-slate-900/40 backdrop-blur-xl p-8 rounded-2xl text-center space-y-6 shadow-2xl relative">
          <div className="absolute top-[-30px] left-1/2 -translate-x-1/2 w-14 h-14 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-center text-rose-400">
            <Lock className="w-6 h-6" />
          </div>
          
          <div className="space-y-2 pt-4">
            <h3 className="text-xl font-bold text-slate-100">Authentication Required</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Please sign in with your account on the home page to access your applicant dashboard.
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

  // 2. Fetch candidate profile details with assigned task
  const { data: candidate, error } = await supabase
    .from('candidates')
    .select('*, tasks(*)')
    .eq('id', user.id)
    .maybeSingle();

  // Redirect to application form if they haven't applied yet
  if (!candidate) {
    redirect('/');
  }

  const rawTask = candidate.tasks;
  const task = rawTask ? (Array.isArray(rawTask) ? rawTask[0] : rawTask) : null;

  const serializedCandidate = {
    id: candidate.id,
    fullName: candidate.full_name,
    email: candidate.email,
    phone: candidate.phone,
    portfolioUrl: candidate.portfolio_url || undefined,
    resumeUrl: candidate.resume_url,
    position: candidate.position,
    yearsOfExperience: candidate.years_of_experience,
    coverLetter: candidate.cover_letter || undefined,
    status: candidate.status,
    createdAt: candidate.created_at,
    task: task ? {
      id: task.id,
      title: task.title,
      instructions: task.instructions,
      assignedAt: task.assigned_at,
      deadline: task.deadline,
      submissionUrl: task.submission_url || undefined,
      submissionNotes: task.submission_notes || undefined,
      submittedAt: task.submitted_at || undefined,
      status: task.status,
    } : null
  };

  return (
    <CandidateDashboardClient 
      initialCandidate={serializedCandidate} 
    />
  );
}
