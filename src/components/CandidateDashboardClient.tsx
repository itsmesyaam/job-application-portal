'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Send, FileText, Link2, LogOut, CheckCircle2, 
  XCircle, AlertCircle, Clock, Check, Sparkles, Upload, Loader2,
  Mail, Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { createClient } from '@/lib/supabase/client';
import { Toast, type ToastType } from './Toast';

interface SerializedTask {
  id: string;
  title: string;
  instructions: string;
  assignedAt: string;
  deadline: string;
  submissionUrl?: string;
  submissionNotes?: string;
  submittedAt?: string;
  status: 'ASSIGNED' | 'SUBMITTED' | 'OVERDUE' | 'ACCEPTED' | 'REJECTED';
}

interface SerializedCandidate {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  portfolioUrl?: string;
  resumeUrl: string;
  position: string;
  yearsOfExperience: number;
  coverLetter?: string;
  status: 'PENDING' | 'SHORTLISTED' | 'TASK_ASSIGNED' | 'SUBMITTED' | 'REJECTED';
  createdAt: string;
  task: SerializedTask | null;
}

interface ChatMessage {
  id: string;
  content: string;
  senderType: 'CANDIDATE' | 'ADMIN';
  createdAt: string;
  isRead: boolean;
}

interface CandidateDashboardClientProps {
  initialCandidate: SerializedCandidate;
}

export function CandidateDashboardClient({ initialCandidate }: CandidateDashboardClientProps) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [candidate] = useState<SerializedCandidate>(initialCandidate);
  const [task, setTask] = useState<SerializedTask | null>(initialCandidate.task);
  
  // Countdown Timer State
  const [timeLeft, setTimeLeft] = useState<string>('--:--:--');
  const [isUrgent, setIsUrgent] = useState<boolean>(false);
  const [isGlow, setIsGlow] = useState<boolean>(false);

  // Task Submission Form State
  const [submittingTask, setSubmittingTask] = useState(false);
  const [submitFile, setSubmitFile] = useState<File | null>(null);
  const [submitUrl, setSubmitUrl] = useState('');
  const [submitNotes, setSubmitNotes] = useState('');

  // Chat Feed State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Toast Alerts
  const [toast, setToast] = useState<{ message: string; type: ToastType; isVisible: boolean }>({
    message: '',
    type: 'info',
    isVisible: false,
  });

  const showToast = (message: string, type: ToastType) => {
    setToast({ message, type, isVisible: true });
  };

  const closeToast = () => {
    setToast((prev) => ({ ...prev, isVisible: false }));
  };

  // 1. Fetch initial message history and subscribe to Realtime chat channel
  useEffect(() => {
    const loadMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('candidate_id', candidate.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching chat history:', error);
        return;
      }

      if (data) {
        setMessages(
          data.map((m: any) => ({
            id: m.id,
            content: m.content,
            senderType: m.sender_type,
            createdAt: m.created_at,
            isRead: m.is_read,
          }))
        );
      }
    };

    loadMessages();

    // Setup Supabase Realtime channel subscription
    const channel = supabase
      .channel(`chat_channel:${candidate.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `candidate_id=eq.${candidate.id}`,
        },
        (payload) => {
          const newMsg = payload.new as any;
          setMessages((prev) => {
            // Prevent duplicate message additions
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [
              ...prev,
              {
                id: newMsg.id,
                content: newMsg.content,
                senderType: newMsg.sender_type,
                createdAt: newMsg.created_at,
                isRead: newMsg.is_read,
              },
            ];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, candidate.id]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 2. Countdown Ticker Logic
  useEffect(() => {
    if (!task || task.status !== 'ASSIGNED') return;

    const deadlineTime = new Date(task.deadline).getTime();

    const updateTimer = () => {
      const now = new Date().getTime();
      const difference = deadlineTime - now;

      if (difference <= 0) {
        setTimeLeft('EXPIRED');
        setIsUrgent(false);
        setIsGlow(false);
        setTask((t) => (t ? { ...t, status: 'OVERDUE' } : null));
        showToast('Assignment deadline has passed. Submissions locked.', 'error');
        return;
      }

      const hours = Math.floor(difference / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      const formattedHours = String(hours).padStart(2, '0');
      const formattedMinutes = String(minutes).padStart(2, '0');
      const formattedSeconds = String(seconds).padStart(2, '0');

      setTimeLeft(`${formattedHours}:${formattedMinutes}:${formattedSeconds}`);
      setIsUrgent(hours < 2);
      setIsGlow(hours < 12);
    };

    updateTimer();
    const timerInterval = setInterval(updateTimer, 1000);
    return () => clearInterval(timerInterval);
  }, [task]);

  // 3. Send Message Handler
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sendingMsg) return;

    setSendingMsg(true);
    try {
      const isDemo = candidate.id === '00000000-0000-0000-0000-000000000000';
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId: candidate.id,
          content: newMessage,
          senderType: 'CANDIDATE',
          isDemo,
        }),
      });

      if (!response.ok) throw new Error();
      const data = await response.json();
      if (data.success) {
        setNewMessage('');
      }
    } catch {
      showToast('Failed to dispatch message.', 'error');
    } finally {
      setSendingMsg(false);
    }
  };

  // Logout / Terminate Session
  const handleLogout = async () => {
    const isDemo = candidate.id === '00000000-0000-0000-0000-000000000000';
    if (!isGlow && !isDemo) {
      await supabase.auth.signOut();
    }
    showToast('Signed out of Candidate Space.', 'info');
    setTimeout(() => {
      router.push('/');
      router.refresh();
    }, 500);
  };

  // Submit Challenge Solutions
  const handleSubmitTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingTask) return;

    if (!submitFile && !submitUrl.trim()) {
      showToast('Please select a solution zip file or paste your repository link.', 'error');
      return;
    }

    setSubmittingTask(true);
    try {
      const formData = new FormData();
      formData.append('candidateId', candidate.id);
      formData.append('submissionNotes', submitNotes);
      
      const isDemo = candidate.id === '00000000-0000-0000-0000-000000000000';
      if (isDemo) {
        formData.append('isDemo', 'true');
      }

      if (submitFile) {
        formData.append('file', submitFile);
      } else {
        formData.append('url', submitUrl.trim());
      }

      const response = await fetch('/api/tasks/submit', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Submission failed.');
      }

      const data = await response.json();
      if (data.success) {
        showToast('Challenge solution delivered successfully!', 'success');
        setTask(data.task);
      }
    } catch (error: any) {
      console.error(error);
      showToast(error.message || 'Submission delivery failed.', 'error');
    } finally {
      setSubmittingTask(false);
    }
  };

  const statusColorsMap = {
    PENDING: { bg: 'bg-amber-500/10 border-amber-500/20 text-amber-400', desc: 'Your profile registration is verified. Hiring managers are currently reviewing your documents.' },
    SHORTLISTED: { bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400', desc: 'Congratulations! Your profile has been shortlisted. Technical challenges will be assigned here soon.' },
    TASK_ASSIGNED: { bg: 'bg-violet-500/10 border-violet-500/20 text-violet-400', desc: 'You have a pending technical assignment task. Please complete it within the 48-hour window.' },
    SUBMITTED: { bg: 'bg-blue-500/10 border-blue-500/20 text-blue-400', desc: 'Task solution delivered successfully! Hiring managers are currently reviewing your workspace.' },
    REJECTED: { bg: 'bg-rose-500/10 border-rose-500/20 text-rose-400', desc: 'Application review completed. Acme Enterprise decided not to proceed further at this time.' }
  };

  const statusColors = statusColorsMap[candidate.status] || statusColorsMap.PENDING;

  return (
    <div className="relative min-h-screen flex flex-col justify-between overflow-x-hidden bg-slate-950 text-slate-100">
      {/* Background Gradient mesh */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] pointer-events-none">
        <div className="absolute top-[-10%] left-[10%] w-[40%] h-[50%] rounded-full bg-indigo-600/5 blur-[120px]" />
        <div className="absolute top-[-5%] right-[15%] w-[35%] h-[45%] rounded-full bg-violet-600/5 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="w-full border-b border-slate-900 bg-slate-950/60 backdrop-blur-md relative z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400 font-bold text-base shadow-[0_0_15px_rgba(99,102,241,0.05)]">
              A
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-200">Acme Careers</h1>
              <p className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase">Candidate Space</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-slate-200">{candidate.fullName}</p>
              <p className="text-[10px] text-indigo-400 font-medium">{candidate.position}</p>
            </div>
            <button 
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-slate-800 bg-slate-900/10 text-xs font-semibold text-slate-400 hover:text-rose-400 hover:border-rose-500/20 transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left 2 Columns: Task & Info Panel */}
        <div className="lg:col-span-2 space-y-8">
          {/* Welcome Dashboard Block */}
          <div className="border border-slate-850 bg-slate-900/20 backdrop-blur-xl p-6 sm:p-8 rounded-2xl relative overflow-hidden shadow-lg">
            <div className="absolute top-[-40px] right-[-40px] w-40 h-40 bg-indigo-500/5 rounded-full blur-[60px]" />
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="space-y-2">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2">
                  Welcome back, {candidate.fullName.split(' ')[0]}! <Sparkles className="w-5 h-5 text-indigo-400" />
                </h2>
                <p className="text-xs text-slate-400 max-w-md">
                  Track your application checkpoints, review assigned programming exercises, or correspond with coordinators.
                </p>
              </div>

              {/* Status Badge */}
              <div className={`p-4 rounded-xl border ${statusColors.bg} sm:max-w-xs`}>
                <span className="text-xs font-bold uppercase tracking-wider">Application Status: {candidate.status}</span>
                <p className="text-xs text-slate-400 leading-normal mt-1">{statusColors.desc}</p>
              </div>
            </div>
          </div>

          {/* Task Module when status is TASK_ASSIGNED or SUBMITTED */}
          {(candidate.status === 'TASK_ASSIGNED' || candidate.status === 'SUBMITTED' || candidate.status === 'REJECTED') && task && (
            <div className="border border-slate-800 bg-slate-900/40 backdrop-blur-xl rounded-2xl overflow-hidden shadow-xl">
              <div className="p-6 border-b border-slate-800 bg-slate-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    <Sparkles className="w-3 h-3" /> Technical Assignment
                  </span>
                  <h3 className="text-lg font-bold text-slate-100">{task.title}</h3>
                </div>

                {/* Countdown Block */}
                {task.status === 'ASSIGNED' && (
                  <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border backdrop-blur-xl transition-all duration-300
                    ${isGlow 
                      ? 'bg-rose-500/10 border-rose-500/40 text-rose-400 animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.25)]' 
                      : isUrgent
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                        : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                    <div className="text-right">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 leading-none">Time Remaining</p>
                      <p className="text-lg font-extrabold tracking-mono font-mono leading-none mt-1">{timeLeft}</p>
                    </div>
                  </div>
                )}

                {task.status === 'SUBMITTED' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Submitted & Under Review
                  </span>
                )}

                {task.status === 'ACCEPTED' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Assignment Accepted
                  </span>
                )}

                {task.status === 'REJECTED' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold">
                    <XCircle className="w-3.5 h-3.5" /> Assignment Rejected
                  </span>
                )}

                {task.status === 'OVERDUE' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold">
                    <AlertCircle className="w-3.5 h-3.5" /> Submission Overdue
                  </span>
                )}
              </div>

              <div className="p-6 space-y-6">
                {/* Task Instructions */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Instructions</h4>
                  <div className="p-5 rounded-xl border border-slate-800 bg-slate-950/40 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {task.instructions}
                  </div>
                </div>

                {/* Submissions form logic with Lockout screen animation */}
                <AnimatePresence mode="wait">
                  {task.status === 'ASSIGNED' ? (
                    <motion.form 
                      key="submission-form"
                      initial={{ opacity: 1 }}
                      exit={{ opacity: 0, y: -10 }}
                      onSubmit={handleSubmitTask} 
                      className="border-t border-slate-800 pt-6 space-y-5"
                    >
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Submit Assignment</h4>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Submission Link option */}
                        <div className="space-y-1.5">
                          <label htmlFor="url" className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                            Pasted URL (GitHub / Figma / Live link)
                          </label>
                          <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-600">
                              <Link2 className="w-4 h-4" />
                            </span>
                            <input
                              type="url"
                              id="url"
                              placeholder="https://github.com/..."
                              value={submitUrl}
                              onChange={(e) => { setSubmitUrl(e.target.value); setSubmitFile(null); }}
                              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950/60 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 text-xs"
                            />
                          </div>
                        </div>

                        {/* File Upload option */}
                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                            Or Upload Archive file (ZIP/PDF up to 10MB)
                          </label>
                          <div className="flex items-center gap-3">
                            <input
                              type="file"
                              id="submitFile"
                              accept=".zip,.pdf"
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files && e.target.files.length > 0) {
                                  setSubmitFile(e.target.files[0]);
                                  setSubmitUrl('');
                                }
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => document.getElementById('submitFile')?.click()}
                              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900/20 text-slate-300 hover:text-white hover:border-slate-700 text-xs font-semibold cursor-pointer"
                            >
                              <Upload className="w-4 h-4" /> {submitFile ? 'Change file' : 'Select file'}
                            </button>
                            {submitFile && (
                              <span className="text-xs text-slate-400 truncate max-w-[150px]" title={submitFile.name}>
                                {submitFile.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Submission Notes */}
                      <div className="space-y-1.5">
                        <label htmlFor="notes" className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                          Submission Notes
                        </label>
                        <textarea
                          id="notes"
                          rows={4}
                          placeholder="Detail any deployment URLs, execution instructions, or special challenges completed..."
                          value={submitNotes}
                          onChange={(e) => setSubmitNotes(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-slate-800 bg-slate-950/60 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 text-xs resize-none"
                        />
                      </div>

                      <div className="flex items-center justify-end">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          type="submit"
                          disabled={submittingTask}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {submittingTask ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...
                            </>
                          ) : (
                            <>
                              Submit Challenge <Check className="w-3.5 h-3.5" />
                            </>
                          )}
                        </motion.button>
                      </div>
                    </motion.form>
                  ) : task.status === 'OVERDUE' ? (
                    <motion.div 
                      key="lock-screen"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3 }}
                      className="border-t border-slate-850 pt-6 flex flex-col items-center justify-center p-8 text-center space-y-4"
                    >
                      <div className="w-14 h-14 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-center text-rose-450 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                        <Lock className="w-7 h-7" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-200">Submissions Locked</h4>
                        <p className="text-xs text-slate-400 mt-1 max-w-sm leading-relaxed">
                          The 48-hour technical assignment window has expired. Submissions are no longer accepted for review.
                        </p>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                {/* Submission display for Submitted states */}
                {task.status !== 'ASSIGNED' && task.status !== 'OVERDUE' && task.submittedAt && (
                  <div className="border-t border-slate-850 pt-6 space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Your Submission</h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl border border-slate-855 bg-slate-955/30 flex items-center justify-between">
                        <div className="flex items-center gap-2.5 truncate">
                          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="truncate">
                            <p className="text-xs font-semibold text-slate-200">Delivered Work</p>
                            <p className="text-[10px] text-slate-500 truncate" title={task.submissionUrl}>{task.submissionUrl}</p>
                          </div>
                        </div>
                        <a
                          href={task.submissionUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-lg hover:bg-slate-800 text-indigo-400 hover:text-indigo-300 transition-colors"
                        >
                          <Link2 className="w-4 h-4" />
                        </a>
                      </div>

                      <div className="p-4 rounded-xl border border-slate-855 bg-slate-955/30">
                        <p className="text-[10px] text-slate-500 font-bold uppercase leading-none">Submitted On</p>
                        <p className="text-xs font-semibold text-slate-200 mt-1.5">
                          {new Date(task.submittedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {task.submissionNotes && (
                      <div className="space-y-1">
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Submission Notes</p>
                        <p className="text-xs text-slate-300 p-3 rounded-lg border border-slate-900 bg-slate-955/20 leading-relaxed whitespace-pre-wrap">
                          {task.submissionNotes}
                        </p>
                      </div>
                    )}

                    {task.status === 'ACCEPTED' && (
                      <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-xs leading-normal flex gap-2">
                        <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                        <span>
                          <strong>Assignment Approved!</strong> Excellent work. Our hiring managers have accepted this technical submission. We will dispatch contract proposals and onboarding schedules to your email shortly.
                        </span>
                      </div>
                    )}

                    {task.status === 'REJECTED' && (
                      <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 text-rose-400 text-xs leading-normal flex gap-2">
                        <XCircle className="w-5 h-5 flex-shrink-0" />
                        <span>
                          <strong>Assignment Review Completed.</strong> While we appreciate the effort you put into the take-home challenge, our coordinators decided not to move forward with your application.
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right 1 Column: Chat Panel */}
        <div className="lg:col-span-1 border border-slate-800 bg-slate-900/40 backdrop-blur-xl rounded-2xl overflow-hidden flex flex-col h-[580px] shadow-xl relative">
          
          {/* Chat Panel Header */}
          <div className="p-4 border-b border-slate-850 bg-slate-950/40 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <div>
                <h3 className="text-sm font-bold text-slate-100">Acme HR Recruiter</h3>
                <p className="text-[10px] text-slate-500">Live chat channel</p>
              </div>
            </div>
          </div>

          {/* Chat Messages Feed with Framer Motion layout transitions */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-950/10">
            <AnimatePresence initial={false}>
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4">
                  <Mail className="w-8 h-8 text-slate-600 mb-2" />
                  <p className="text-xs font-semibold text-slate-400">Start the conversation</p>
                  <p className="text-[10px] text-slate-500 mt-1 max-w-[180px]">
                    Send a message to HR if you have questions regarding the challenge.
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isAdminMsg = msg.senderType === 'ADMIN';
                  return (
                    <motion.div 
                      key={msg.id}
                      layout
                      initial={{ opacity: 0, y: 15, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                      className={`flex flex-col max-w-[80%] ${isAdminMsg ? 'mr-auto items-start' : 'ml-auto items-end'}`}
                    >
                      <div 
                        className={`p-3 rounded-2xl text-xs leading-relaxed
                          ${isAdminMsg 
                            ? 'bg-slate-900 border border-slate-855 text-slate-200 rounded-tl-none' 
                            : 'bg-indigo-600 text-white rounded-tr-none shadow-[0_0_10px_rgba(99,102,241,0.1)]'
                          }`}
                      >
                        {msg.content}
                      </div>
                      <span className="text-[9px] text-slate-500 mt-1 font-medium px-1">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
            <div ref={chatBottomRef} />
          </div>

          {/* Chat Input form */}
          <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-855 bg-slate-955/40 flex gap-2 flex-shrink-0">
            <input
              type="text"
              placeholder="Type message here..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-955/60 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 text-xs"
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="submit"
              disabled={!newMessage.trim() || sendingMsg}
              className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center justify-center"
            >
              {sendingMsg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </motion.button>
          </form>

        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-600 relative z-10">
        <div className="max-w-7xl mx-auto px-4">
          <p>&copy; {new Date().getFullYear()} Acme Enterprise Inc. All rights reserved.</p>
        </div>
      </footer>

      {/* Global Toast Container */}
      <Toast 
        message={toast.message} 
        type={toast.type} 
        isVisible={toast.isVisible} 
        onClose={closeToast} 
      />
    </div>
  );
}
