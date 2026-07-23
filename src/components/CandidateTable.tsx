'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, Briefcase, Filter, ChevronLeft, ChevronRight, 
  Users, Sparkles, CheckCircle2, AlertCircle, XCircle, ArrowUpDown
} from 'lucide-react';
import { CandidateDrawer } from './CandidateDrawer';
import { Toast, type ToastType } from './Toast';

export interface Candidate {
  id: string;
  googleId: string;
  fullName: string;
  email: string;
  phone: string;
  portfolioUrl?: string;
  resumeUrl: string;
  position: 'UI_UX_DESIGNER' | 'FULL_STACK_DEVELOPER' | 'MOBILE_DEVELOPER' | 'TESTER' | 'HR' | 'DIGITAL_MARKETER' | 'INTERN';
  yearsOfExperience: number;
  coverLetter?: string;
  status: 'PENDING' | 'REVIEWED' | 'SHORTLISTED' | 'REJECTED';
  createdAt: string;
}

interface StatsSummary {
  total: number;
  pending: number;
  reviewed: number;
  shortlisted: number;
  rejected: number;
}

export function CandidateTable() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [stats, setStats] = useState<StatsSummary>({ total: 0, pending: 0, reviewed: 0, shortlisted: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Filter States
  const [search, setSearch] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Selected Candidate Drawer State
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Toast notifications state
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

  // Fetch Candidates Data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '8',
        search,
        position: positionFilter,
        status: statusFilter,
      });

      const response = await fetch(`/api/admin/candidates?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch data');
      
      const data = await response.json();
      setCandidates(data.candidates);
      setTotalPages(data.pagination.totalPages);
      setStats(data.stats);
    } catch (error) {
      console.error(error);
      showToast('Error loading candidate records.', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, search, positionFilter, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchData]);

  // Handle Candidate Status Change inside Drawer
  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/admin/candidates/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error('Status update failed');
      
      const data = await response.json();
      
      if (data.success) {
        showToast(`Candidate status updated to ${newStatus}.`, 'success');
        // Update local candidate list and selected candidate details
        setCandidates(prev => 
          prev.map(c => c.id === id ? { ...c, status: newStatus as Candidate['status'] } : c)
        );
        if (selectedCandidate && selectedCandidate.id === id) {
          setSelectedCandidate(prev => prev ? { ...prev, status: newStatus as Candidate['status'] } : null);
        }
        // Refresh aggregate stats count
        fetchData();
      }
    } catch (error) {
      console.error(error);
      showToast('Could not update applicant status.', 'error');
    }
  };

  const formatPosition = (pos: string) => {
    return pos.split('_').map(word => 
      word.charAt(0) + word.slice(1).toLowerCase()
    ).join(' ').replace('Ui Ux', 'UI/UX');
  };

  const statusBadges = {
    PENDING: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    REVIEWED: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    SHORTLISTED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    REJECTED: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  };

  return (
    <div className="w-full space-y-8">
      {/* 1. Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Candidates */}
        <div className="border border-slate-800 bg-slate-900/30 backdrop-blur-xl p-5 rounded-2xl relative overflow-hidden">
          <div className="absolute top-4 right-4 text-indigo-400/20">
            <Users className="w-8 h-8" />
          </div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Applicants</p>
          <h3 className="text-3xl font-extrabold text-slate-100 mt-2">{stats.total}</h3>
          <div className="w-full h-1 bg-indigo-500/20 rounded-full mt-4 overflow-hidden">
            <div className="h-full bg-indigo-500" style={{ width: '100%' }} />
          </div>
        </div>

        {/* Pending Review */}
        <div className="border border-slate-800 bg-slate-900/30 backdrop-blur-xl p-5 rounded-2xl relative overflow-hidden">
          <div className="absolute top-4 right-4 text-amber-400/20">
            <AlertCircle className="w-8 h-8" />
          </div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pending Review</p>
          <h3 className="text-3xl font-extrabold text-amber-400 mt-2">{stats.pending}</h3>
          <div className="w-full h-1 bg-amber-500/20 rounded-full mt-4 overflow-hidden">
            <div 
              className="h-full bg-amber-500 transition-all duration-500" 
              style={{ width: `${stats.total > 0 ? (stats.pending / stats.total) * 100 : 0}%` }} 
            />
          </div>
        </div>

        {/* Shortlisted */}
        <div className="border border-slate-800 bg-slate-900/30 backdrop-blur-xl p-5 rounded-2xl relative overflow-hidden">
          <div className="absolute top-4 right-4 text-emerald-400/20">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Shortlisted</p>
          <h3 className="text-3xl font-extrabold text-emerald-400 mt-2">{stats.shortlisted}</h3>
          <div className="w-full h-1 bg-emerald-500/20 rounded-full mt-4 overflow-hidden">
            <div 
              className="h-full bg-emerald-500 transition-all duration-500" 
              style={{ width: `${stats.total > 0 ? (stats.shortlisted / stats.total) * 100 : 0}%` }} 
            />
          </div>
        </div>

        {/* Rejected */}
        <div className="border border-slate-800 bg-slate-900/30 backdrop-blur-xl p-5 rounded-2xl relative overflow-hidden">
          <div className="absolute top-4 right-4 text-rose-400/20">
            <XCircle className="w-8 h-8" />
          </div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Rejected</p>
          <h3 className="text-3xl font-extrabold text-rose-500 mt-2">{stats.rejected}</h3>
          <div className="w-full h-1 bg-rose-500/20 rounded-full mt-4 overflow-hidden">
            <div 
              className="h-full bg-rose-500 transition-all duration-500" 
              style={{ width: `${stats.total > 0 ? (stats.rejected / stats.total) * 100 : 0}%` }} 
            />
          </div>
        </div>
      </div>

      {/* 2. Filters & Table Container */}
      <div className="border border-slate-800 bg-slate-900/20 backdrop-blur-xl rounded-2xl overflow-hidden shadow-2xl">
        
        {/* Filters Panel */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/20 flex flex-col md:flex-row items-center gap-4">
          {/* Search Bar */}
          <div className="w-full md:w-80 relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Search candidate by name or email..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950/60 focus:bg-slate-950/90 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto md:ml-auto">
            {/* Position filter */}
            <div className="relative w-full sm:w-auto">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Briefcase className="w-3.5 h-3.5" />
              </span>
              <select
                value={positionFilter}
                onChange={(e) => { setPositionFilter(e.target.value); setPage(1); }}
                className="w-full sm:w-44 pl-9 pr-8 py-2.5 rounded-xl border border-slate-800 bg-slate-950/60 text-slate-300 focus:outline-none focus:border-indigo-500 transition-all text-xs appearance-none cursor-pointer"
              >
                <option value="">All Positions</option>
                <option value="UI_UX_DESIGNER">UI/UX Designer</option>
                <option value="FULL_STACK_DEVELOPER">Full Stack Developer</option>
                <option value="MOBILE_DEVELOPER">Mobile Developer</option>
                <option value="TESTER">Software Tester / QA</option>
                <option value="HR">HR Manager</option>
                <option value="DIGITAL_MARKETER">Digital Marketer</option>
                <option value="INTERN">Intern</option>
              </select>
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-500">
                <Filter className="w-3 h-3" />
              </div>
            </div>

            {/* Status filter */}
            <div className="relative w-full sm:w-auto">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Sparkles className="w-3.5 h-3.5" />
              </span>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="w-full sm:w-40 pl-9 pr-8 py-2.5 rounded-xl border border-slate-800 bg-slate-950/60 text-slate-300 focus:outline-none focus:border-indigo-500 transition-all text-xs appearance-none cursor-pointer"
              >
                <option value="">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="REVIEWED">Reviewed</option>
                <option value="SHORTLISTED">Shortlisted</option>
                <option value="REJECTED">Rejected</option>
              </select>
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-500">
                <Filter className="w-3 h-3" />
              </div>
            </div>
          </div>
        </div>

        {/* Candidate Table Grid */}
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-850 text-slate-400 bg-slate-950/10 text-[10px] uppercase tracking-wider font-semibold">
                <th className="p-4 pl-6">Applicant Name</th>
                <th className="p-4">Applied Position</th>
                <th className="p-4 flex items-center gap-1 cursor-default">
                  Experience <ArrowUpDown className="w-3 h-3" />
                </th>
                <th className="p-4">Submission Date</th>
                <th className="p-4">Status</th>
                <th className="p-4 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850 text-slate-300 text-xs">
              {loading ? (
                // Skeletons Table Loading State
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="p-4 pl-6">
                      <div className="h-4 bg-slate-800 rounded w-36 mb-1.5" />
                      <div className="h-3 bg-slate-800 rounded w-24" />
                    </td>
                    <td className="p-4">
                      <div className="h-4 bg-slate-800 rounded w-28" />
                    </td>
                    <td className="p-4">
                      <div className="h-4 bg-slate-800 rounded w-12" />
                    </td>
                    <td className="p-4">
                      <div className="h-4 bg-slate-800 rounded w-20" />
                    </td>
                    <td className="p-4">
                      <div className="h-5 bg-slate-800 rounded-full w-24" />
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <div className="h-8 bg-slate-800 rounded w-16 ml-auto" />
                    </td>
                  </tr>
                ))
              ) : candidates.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-slate-500">
                    No candidate applications found matching filters.
                  </td>
                </tr>
              ) : (
                candidates.map((candidate) => (
                  <tr 
                    key={candidate.id} 
                    onClick={() => { setSelectedCandidate(candidate); setIsDrawerOpen(true); }}
                    className="hover:bg-slate-950/20 transition-all cursor-pointer group"
                  >
                    <td className="p-4 pl-6">
                      <p className="font-semibold text-slate-200 group-hover:text-indigo-400 transition-colors">{candidate.fullName}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{candidate.email}</p>
                    </td>
                    <td className="p-4 font-medium">{formatPosition(candidate.position)}</td>
                    <td className="p-4">{candidate.yearsOfExperience} {candidate.yearsOfExperience === 1 ? 'year' : 'years'}</td>
                    <td className="p-4 text-slate-400">
                      {new Date(candidate.createdAt).toLocaleDateString(undefined, { 
                        month: 'short', day: 'numeric', year: 'numeric' 
                      })}
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${statusBadges[candidate.status]}`}>
                        {candidate.status}
                      </span>
                    </td>
                    <td className="p-4 pr-6 text-right" onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={() => { setSelectedCandidate(candidate); setIsDrawerOpen(true); }}
                        className="px-3 py-1.5 rounded-lg border border-slate-800 text-[10px] font-semibold hover:border-indigo-500 hover:text-indigo-400 transition-all cursor-pointer"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Panel */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-850 flex items-center justify-between text-xs text-slate-400 bg-slate-950/10">
            <span>Page {page} of {totalPages}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(p - 1, 1))}
                disabled={page === 1 || loading}
                className="p-1.5 rounded-lg border border-slate-800 hover:border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-950/20 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                disabled={page === totalPages || loading}
                className="p-1.5 rounded-lg border border-slate-800 hover:border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-950/20 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Candidate Details Side Drawer */}
      <CandidateDrawer 
        candidate={selectedCandidate}
        isOpen={isDrawerOpen}
        onClose={() => { setIsDrawerOpen(false); setSelectedCandidate(null); }}
        onStatusChange={handleStatusChange}
      />

      {/* Local Toast Notification Container */}
      <Toast 
        message={toast.message} 
        type={toast.type} 
        isVisible={toast.isVisible} 
        onClose={closeToast} 
      />
    </div>
  );
}
