'use client';

import React, { useEffect } from 'react';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type: ToastType;
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
}

export function Toast({ message, type, isVisible, onClose, duration = 5000 }: ToastProps) {
  useEffect(() => {
    if (isVisible && duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  if (!isVisible) return null;

  const bgStyles = {
    success: 'bg-slate-900 border-emerald-500/30 text-emerald-100 shadow-emerald-500/10 hover:border-emerald-500/50',
    error: 'bg-slate-900 border-rose-500/30 text-rose-100 shadow-rose-500/10 hover:border-rose-500/50',
    info: 'bg-slate-900 border-indigo-500/30 text-indigo-100 shadow-indigo-500/10 hover:border-indigo-500/50',
  }[type];

  const Icon = {
    success: CheckCircle2,
    error: AlertCircle,
    info: Info,
  }[type];

  const iconColor = {
    success: 'text-emerald-400',
    error: 'text-rose-400',
    info: 'text-indigo-400',
  }[type];

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full p-0.5 rounded-xl bg-gradient-to-r from-transparent via-transparent to-transparent hover:shadow-xl transition-all duration-300">
      <div className={`flex items-start gap-3 p-4 rounded-[11px] border ${bgStyles} backdrop-blur-xl bg-opacity-90/80 transition-all duration-300 transform translate-y-0 scale-100`}>
        <div className="flex-shrink-0 mt-0.5">
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        
        <div className="flex-1">
          <p className="text-sm font-medium leading-relaxed">{message}</p>
        </div>
        
        <button
          onClick={onClose}
          className="flex-shrink-0 p-0.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
          aria-label="Close notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
