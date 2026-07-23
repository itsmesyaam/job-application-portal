import { JobApplicationForm } from "@/components/JobApplicationForm";
import { Sparkles } from "lucide-react";

export default function Home() {
  return (
    <div className="relative min-h-screen flex flex-col justify-between overflow-x-hidden">
      {/* Background Gradient Mesh */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] pointer-events-none">
        <div className="absolute top-[-10%] left-[5%] w-[45%] h-[60%] rounded-full bg-indigo-600/10 blur-[120px]" />
        <div className="absolute top-[-5%] right-[10%] w-[40%] h-[50%] rounded-full bg-violet-600/10 blur-[120px]" />
      </div>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 relative z-10 flex flex-col items-center">
        {/* Hero Header */}
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" /> We are Hiring
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white bg-clip-text bg-gradient-to-r from-slate-100 via-slate-200 to-indigo-200">
            Join Our Team
          </h1>
          <p className="text-base sm:text-lg text-slate-400 leading-relaxed">
            We are looking for passionate, talented, and driven individuals to help build the future of our enterprise platforms. Fill out the application below to begin your journey.
          </p>
        </div>

        {/* Multi-step Form Wizard */}
        <JobApplicationForm />
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-600 relative z-10">
        <div className="max-w-7xl mx-auto px-4">
          <p>&copy; {new Date().getFullYear()} Acme Enterprise Inc. All rights reserved.</p>
          <p className="mt-1.5 text-[10px] text-slate-700">Built using Next.js App Router, NextAuth, Tailwind CSS, and Zod.</p>
        </div>
      </footer>
    </div>
  );
}
