import { Lock } from 'lucide-react';
import Link from 'next/link';

import { createClient } from '@/lib/supabase/server';
import { CandidateTable } from '@/components/CandidateTable';

const ADMIN_LIST = (process.env.ADMIN_EMAILS || 'admin@yourdomain.com,jane.doe@example.com').split(',');

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const isAdmin = user ? ADMIN_LIST.includes(user.email || '') : false;

  // Security Access Check
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
        <div className="max-w-md w-full border border-slate-900 bg-slate-900/40 backdrop-blur-xl p-8 rounded-2xl text-center space-y-6 shadow-2xl relative">
          <div className="absolute top-[-30px] left-1/2 -translate-x-1/2 w-14 h-14 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-center text-rose-400">
            <Lock className="w-6 h-6" />
          </div>
          
          <div className="space-y-2 pt-4">
            <h3 className="text-xl font-bold text-slate-100">Access Denied</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              This area is restricted to authenticated administrator accounts. Your current email ({user?.email || 'Guest'}) does not have administrator privileges.
            </p>
          </div>
          
          <div className="border-t border-slate-800 pt-5 flex flex-col gap-3">
            <Link 
              href="/" 
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-xl shadow-md transition-all text-sm text-center"
            >
              Return to Application Form
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const adminName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Administrator';

  return (
    <div className="relative min-h-screen flex flex-col justify-between overflow-x-hidden bg-slate-950 text-slate-100">
      {/* Background Gradient Mesh */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] pointer-events-none">
        <div className="absolute top-[-10%] left-[5%] w-[45%] h-[60%] rounded-full bg-indigo-600/5 blur-[120px]" />
        <div className="absolute top-[-5%] right-[10%] w-[40%] h-[50%] rounded-full bg-violet-600/5 blur-[120px]" />
      </div>

      {/* Admin Dashboard Header */}
      <header className="w-full border-b border-slate-900 bg-slate-950/60 backdrop-blur-md relative z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400 font-bold text-base">
              A
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-200">Acme Careers</h1>
              <p className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase">Admin Portal</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-slate-200">{adminName}</p>
              <p className="text-[10px] text-emerald-400 font-medium">Administrator</p>
            </div>
            <Link 
              href="/"
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-slate-800 bg-slate-900/10 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-all"
            >
              Exit Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Dashboard Main View */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10 space-y-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Candidate Applications
          </h2>
          <p className="text-xs text-slate-400">Review, shortlist, or reject candidate application records.</p>
        </div>

        <CandidateTable />
      </main>

      {/* Dashboard Footer */}
      <footer className="w-full border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-600 relative z-10">
        <div className="max-w-7xl mx-auto px-4">
          <p>&copy; {new Date().getFullYear()} Acme Enterprise Inc. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
