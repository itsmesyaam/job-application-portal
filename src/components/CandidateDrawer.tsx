'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  X, Mail, Phone, Link2, Calendar, FileText, 
  Eye, Download, Loader2, Send, 
  MessageSquare, Sparkles, Clock, ArrowRight
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { type Candidate } from './CandidateTable';

interface TaskDetails {
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

interface ChatMessage {
  id: string;
  content: string;
  senderType: 'CANDIDATE' | 'ADMIN';
  createdAt: string;
  isRead: boolean;
}

interface CandidateDrawerProps {
  candidate: Candidate | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChange: (id: string, newStatus: string) => Promise<void>;
}

export function CandidateDrawer({ candidate, isOpen, onClose, onStatusChange }: CandidateDrawerProps) {
  const [supabase] = useState(() => createClient());
  const [activeTab, setActiveTab] = useState<'info' | 'task' | 'chat'>('info');
  
  // Task State
  const [task, setTask] = useState<TaskDetails | null>(null);
  const [loadingTask, setLoadingTask] = useState(false);
  const [assigningTask, setAssigningTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskInstructions, setTaskInstructions] = useState('');
  const [reviewingTask, setReviewingTask] = useState<string | null>(null);
  const [taskTimeLeft, setTaskTimeLeft] = useState('--:--:--');

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Status Change State
  const [updatingCandidate, setUpdatingCandidate] = useState<string | null>(null);
  const [signedResumeUrl, setSignedResumeUrl] = useState<string | null>(null);

  // Fetch Task Details
  const fetchTask = useCallback(async () => {
    if (!candidate) return;
    setLoadingTask(true);
    try {
      const isDemo = candidate.id === '00000000-0000-0000-0000-000000000000';
      const response = await fetch(`/api/tasks?candidateId=${candidate.id}${isDemo ? '&isDemo=true' : ''}`);
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (data.success) {
        setTask(data.task);
      }
    } catch (e) {
      console.error('Error fetching task details:', e);
    } finally {
      setLoadingTask(false);
    }
  }, [candidate]);

  // Fetch initial messages and subscribe to Supabase Realtime chat channel
  useEffect(() => {
    if (!candidate || !isOpen) return;

    // 1. Fetch initial message history
    const loadMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('candidate_id', candidate.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading chat history:', error);
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

        if (activeTab !== 'chat') {
          const unread = data.filter(
            (m: any) => m.sender_type === 'CANDIDATE' && !m.is_read
          ).length;
          setUnreadCount(unread);
        }
      }
    };

    loadMessages();
    fetchTask();

    // 2. Subscribe to Postgres INSERTs for chat updates
    const channel = supabase
      .channel(`admin_chat_channel:${candidate.id}`)
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

          if (activeTab !== 'chat' && newMsg.sender_type === 'CANDIDATE') {
            setUnreadCount((c) => c + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, candidate, isOpen, activeTab, fetchTask]);

  // Generate private S3/Supabase Storage signed URL for resume review on mount
  useEffect(() => {
    if (!candidate || !isOpen) return;

    const getSignedUrl = async () => {
      // In local demo simulation mode, use a mock URL
      if (candidate.id === '00000000-0000-0000-0000-000000000000') {
        setSignedResumeUrl(candidate.resumeUrl);
        return;
      }

      const { data, error } = await supabase.storage
        .from('resumes')
        .createSignedUrl(candidate.resumeUrl, 3600); // 1 hour expiry

      if (error) {
        console.error('Error generating signed URL:', error);
        setSignedResumeUrl(candidate.resumeUrl); // Fallback to raw string
      } else if (data) {
        setSignedResumeUrl(data.signedUrl);
      }
    };

    getSignedUrl();
  }, [supabase, candidate, isOpen]);

  // Scroll chat tab to bottom when active
  useEffect(() => {
    if (activeTab === 'chat') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      setUnreadCount(0);
    }
  }, [activeTab, messages]);

  // Task Live Countdown Ticker
  useEffect(() => {
    if (!task || task.status !== 'ASSIGNED') return;

    const deadlineTime = new Date(task.deadline).getTime();

    const updateTimer = () => {
      const now = new Date().getTime();
      const difference = deadlineTime - now;

      if (difference <= 0) {
        setTaskTimeLeft('EXPIRED');
        setTask(t => t ? { ...t, status: 'OVERDUE' } : null);
        return;
      }

      const hours = Math.floor(difference / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTaskTimeLeft(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [task]);

  if (!candidate) return null;

  // General Status Update (Info Tab)
  const handleCandidateUpdate = async (status: string) => {
    setUpdatingCandidate(status);
    try {
      await onStatusChange(candidate.id, status);
    } finally {
      setUpdatingCandidate(null);
    }
  };

  // Assign Challenge (Task Tab)
  const handleAssignTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !taskInstructions.trim() || assigningTask) return;

    setAssigningTask(true);
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId: candidate.id,
          title: taskTitle,
          instructions: taskInstructions,
        }),
      });

      if (!response.ok) throw new Error();
      const data = await response.json();
      if (data.success) {
        setTask(data.task);
        // Sync parent list status to TASK_ASSIGNED
        await onStatusChange(candidate.id, 'TASK_ASSIGNED');
        setTaskTitle('');
        setTaskInstructions('');
      }
    } catch {
      console.error('Failed to assign task');
    } finally {
      setAssigningTask(false);
    }
  };

  // Accept/Reject Submission Challenge
  const handleReviewTask = async (status: 'ACCEPTED' | 'REJECTED') => {
    if (!task || reviewingTask) return;
    setReviewingTask(status);
    try {
      const isDemo = candidate.id === '00000000-0000-0000-0000-000000000000';
      const response = await fetch('/api/tasks/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: task.id,
          status,
          isDemo,
        }),
      });

      if (!response.ok) throw new Error();
      const data = await response.json();
      if (data.success) {
        setTask(data.task);
        if (status === 'REJECTED') {
          await onStatusChange(candidate.id, 'REJECTED');
        }
      }
    } catch (e) {
      console.error('Failed to review task:', e);
    } finally {
      setReviewingTask(null);
    }
  };

  // Send Chat message
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
          senderType: 'ADMIN',
          isDemo,
        }),
      });

      if (!response.ok) throw new Error();
      const data = await response.json();
      if (data.success) {
        setNewMessage('');
      }
    } catch (err) {
      console.error('Chat error:', err);
    } finally {
      setSendingMsg(false);
    }
  };

  const statusColors = {
    PENDING: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    SHORTLISTED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    TASK_ASSIGNED: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    SUBMITTED: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    REJECTED: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  }[candidate.status];

  return (
    <>
      {/* Backdrop Overlay */}
      <div 
        className={`fixed inset-0 z-45 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Slide-over Drawer */}
      <div 
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-slate-900 border-l border-slate-800 shadow-2xl transition-transform duration-300 transform flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/40 relative flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${statusColors} mb-1.5`}>
                {candidate.status}
              </span>
              <h3 className="text-lg font-bold text-slate-100">{candidate.fullName}</h3>
              <p className="text-xs text-indigo-400 font-medium">{candidate.position}</p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tab Switcher */}
          <div className="flex gap-2 mt-5 border-t border-slate-900 pt-3 text-xs font-semibold text-slate-400">
            <button
              onClick={() => setActiveTab('info')}
              className={`pb-1 px-1 border-b-2 transition-all cursor-pointer ${
                activeTab === 'info' ? 'text-indigo-400 border-indigo-500 font-bold' : 'border-transparent hover:text-slate-200'
              }`}
            >
              Info Details
            </button>
            <button
              onClick={() => setActiveTab('task')}
              className={`pb-1 px-1 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'task' ? 'text-indigo-400 border-indigo-500 font-bold' : 'border-transparent hover:text-slate-200'
              }`}
            >
              Take-home Task
              {task?.status === 'SUBMITTED' && (
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`pb-1 px-1 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'chat' ? 'text-indigo-400 border-indigo-500 font-bold' : 'border-transparent hover:text-slate-200'
              }`}
            >
              Recruiter Chat
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-indigo-600 text-[9px] text-white font-bold animate-bounce">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Drawer Body content (scrollable) */}
        <div className="flex-1 overflow-y-auto p-5">
          
          {/* TAB 1: Info Details */}
          {activeTab === 'info' && (
            <div className="space-y-6">
              {/* Contact info */}
              <div className="bg-slate-950/40 border border-slate-850 rounded-xl p-4 space-y-3.5">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Contact Details</h4>
                
                <div className="flex items-center gap-3 text-sm text-slate-300">
                  <Mail className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                  <a href={`mailto:${candidate.email}`} className="hover:text-indigo-300 truncate underline decoration-indigo-500/30">
                    {candidate.email}
                  </a>
                </div>

                <div className="flex items-center gap-3 text-sm text-slate-300">
                  <Phone className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                  <a href={`tel:${candidate.phone}`} className="hover:text-indigo-300">
                    {candidate.phone}
                  </a>
                </div>

                {candidate.portfolioUrl && (
                  <div className="flex items-center gap-3 text-sm text-slate-300">
                    <Link2 className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <a href={candidate.portfolioUrl} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-300 truncate underline decoration-indigo-500/30">
                      {candidate.portfolioUrl}
                    </a>
                  </div>
                )}

                <div className="flex items-center gap-3 text-xs text-slate-400 border-t border-slate-900 pt-3 mt-3">
                  <Calendar className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  <span>Applied on {new Date(candidate.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Resume view */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Candidate Resume</h4>
                <div className="flex items-center justify-between p-4 rounded-xl border border-slate-850 bg-slate-950/30">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-200">Resume / CV</p>
                      <p className="text-[10px] text-slate-500">PDF / DOCX document format</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {signedResumeUrl ? (
                      <>
                        <a 
                          href={signedResumeUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-semibold transition-all cursor-pointer"
                        >
                          <Eye className="w-3 h-3" /> View
                        </a>
                        <a 
                          href={signedResumeUrl} 
                          download
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </>
                    ) : (
                      <span className="text-[10px] text-slate-500">Loading Resume URL...</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Cover Letter */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cover Letter / Bio</h4>
                <div className="p-4 rounded-xl border border-slate-855 bg-slate-955/40 text-xs text-slate-300 leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
                  {candidate.coverLetter || 'No cover letter provided.'}
                </div>
              </div>

              {/* General Candidate Status Control Buttons */}
              <div className="border-t border-slate-850 pt-5 space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">General Candidate Status</h4>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleCandidateUpdate('SHORTLISTED')}
                    disabled={candidate.status === 'SHORTLISTED' || !!updatingCandidate}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-800 hover:border-slate-700 text-[10px] font-semibold text-slate-300 hover:text-white cursor-pointer disabled:opacity-40"
                  >
                    {updatingCandidate === 'SHORTLISTED' && <Loader2 className="w-3 h-3 animate-spin" />}
                    Shortlist Candidate
                  </button>
                  <button
                    onClick={() => handleCandidateUpdate('REJECTED')}
                    disabled={candidate.status === 'REJECTED' || !!updatingCandidate}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl border border-rose-500/20 text-[10px] font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/5 cursor-pointer disabled:opacity-40"
                  >
                    {updatingCandidate === 'REJECTED' && <Loader2 className="w-3 h-3 animate-spin" />}
                    Reject
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Take-home Challenge */}
          {activeTab === 'task' && (
            <div className="space-y-5">
              {loadingTask ? (
                <div className="h-40 flex items-center justify-center text-slate-500">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                </div>
              ) : !task ? (
                // 1. Assign Task Template Form
                <form onSubmit={handleAssignTask} className="space-y-4">
                  <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 text-xs text-indigo-300 leading-normal flex gap-2.5 rounded-xl">
                    <Sparkles className="w-5 h-5 flex-shrink-0 text-indigo-400" />
                    <span>
                      Shortlisting this candidate will assign them a take-home coding assignment. 
                      A strict **48-Hour countdown** will begin once the challenge is created, and an email notification will be logged.
                    </span>
                  </div>

                  {/* Task Title */}
                  <div className="space-y-1.5">
                    <label htmlFor="taskTitle" className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Challenge Title
                    </label>
                    <input
                      type="text"
                      id="taskTitle"
                      placeholder="e.g. Build a Responsive SaaS Landing Page"
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      required
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-800 bg-slate-955/60 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 text-xs"
                    />
                  </div>

                  {/* Task Instructions */}
                  <div className="space-y-1.5">
                    <label htmlFor="taskInstructions" className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Instructions & Deliverables
                    </label>
                    <textarea
                      id="taskInstructions"
                      rows={6}
                      placeholder="Detail task requirements, frameworks to use, API integrations, and how to upload the submission..."
                      value={taskInstructions}
                      onChange={(e) => setTaskInstructions(e.target.value)}
                      required
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-800 bg-slate-955/60 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 text-xs resize-none"
                    />
                  </div>

                  <div className="flex items-center justify-end pt-2">
                    <button
                      type="submit"
                      disabled={assigningTask}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white cursor-pointer shadow-md disabled:opacity-40"
                    >
                      {assigningTask ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Shortlisting...
                        </>
                      ) : (
                        <>
                          Shortlist & Assign Challenge <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                // 2. Active Task Status View
                <div className="space-y-5">
                  <div className="flex items-center justify-between p-4 rounded-xl border border-slate-855 bg-slate-955/20">
                    <div>
                      <p className="text-[10px] text-slate-500 font-bold uppercase">Assignment Status</p>
                      <h4 className="text-sm font-bold text-slate-200 mt-1">{task.title}</h4>
                    </div>

                    {/* Status badges */}
                    {task.status === 'ASSIGNED' && (
                      <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
                        <Clock className="w-3.5 h-3.5 text-indigo-400 animate-pulse" /> {taskTimeLeft}
                      </div>
                    )}
                    {task.status === 'SUBMITTED' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
                        Submitted
                      </span>
                    )}
                    {task.status === 'ACCEPTED' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                        Accepted
                      </span>
                    )}
                    {task.status === 'REJECTED' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold">
                        Rejected
                      </span>
                    )}
                    {task.status === 'OVERDUE' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold">
                        Overdue
                      </span>
                    )}
                  </div>

                  {/* Submission details block */}
                  {task.status !== 'ASSIGNED' && task.submissionUrl && (
                    <div className="bg-slate-955/40 border border-slate-855 rounded-xl p-4 space-y-4">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Candidate Submission</h4>
                      
                      <div className="flex items-center justify-between p-3 rounded-lg border border-slate-900 bg-slate-955/20">
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                          <p className="text-xs text-slate-300 truncate" title={task.submissionUrl}>{task.submissionUrl}</p>
                        </div>
                        <a 
                          href={task.submissionUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-semibold"
                        >
                          <Eye className="w-3 h-3" /> View Work
                        </a>
                      </div>

                      {task.submissionNotes && (
                        <div className="space-y-1">
                          <p className="text-[10px] text-slate-500 font-bold uppercase leading-none">Notes</p>
                          <p className="text-xs text-slate-300 leading-normal p-3 rounded border border-slate-900 bg-slate-955/10 whitespace-pre-wrap">
                            {task.submissionNotes}
                          </p>
                        </div>
                      )}

                      {/* Accept / Reject Submission Action buttons */}
                      {task.status === 'SUBMITTED' && (
                        <div className="border-t border-slate-900 pt-3 flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleReviewTask('REJECTED')}
                            disabled={!!reviewingTask}
                            className="flex items-center gap-1 px-3.5 py-2 rounded-lg border border-rose-500/20 text-[10px] font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/5 cursor-pointer"
                          >
                            {reviewingTask === 'REJECTED' && <Loader2 className="w-3 h-3 animate-spin" />}
                            Reject Submission
                          </button>
                          <button
                            onClick={() => handleReviewTask('ACCEPTED')}
                            disabled={!!reviewingTask}
                            className="flex items-center gap-1 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-[10px] font-semibold text-white cursor-pointer shadow-sm"
                          >
                            {reviewingTask === 'ACCEPTED' && <Loader2 className="w-3 h-3 animate-spin" />}
                            Accept & Pass
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Original Challenge instructions */}
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Instructions Assigned</p>
                    <div className="p-4 rounded-xl border border-slate-855 bg-slate-955/20 text-xs text-slate-400 leading-relaxed whitespace-pre-wrap max-h-52 overflow-y-auto">
                      {task.instructions}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: HR Recruiter Chat Feed */}
          {activeTab === 'chat' && (
            <div className="flex flex-col h-[400px] border border-slate-800 bg-slate-955/20 rounded-xl overflow-hidden relative">
              {/* Messages feed */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-955/5">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-4">
                    <MessageSquare className="w-8 h-8 text-slate-700 mb-2" />
                    <p className="text-xs font-semibold text-slate-500">No chat history</p>
                    <p className="text-[10px] text-slate-600 mt-1 max-w-[200px]">
                      Send a message to sync coordinates or prompt for challenges.
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isAdminMsg = msg.senderType === 'ADMIN';
                    return (
                      <div 
                        key={msg.id}
                        className={`flex flex-col max-w-[80%] ${isAdminMsg ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                      >
                        <div 
                          className={`p-2.5 rounded-xl text-xs leading-relaxed
                            ${isAdminMsg 
                              ? 'bg-indigo-600 text-white rounded-tr-none' 
                              : 'bg-slate-900 border border-slate-855 text-slate-200 rounded-tl-none'
                            }`}
                        >
                          {msg.content}
                        </div>
                        <span className="text-[9px] text-slate-500 mt-1 px-1 font-medium">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Chat Input form */}
              <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-855 bg-slate-955/40 flex gap-2 flex-shrink-0">
                <input
                  type="text"
                  placeholder="Type message here..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-800 bg-slate-955/60 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 text-xs"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() || sendingMsg}
                  className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center"
                >
                  {sendingMsg ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
