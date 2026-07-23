'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { 
  User as UserIcon, Mail, Phone, Link2, Briefcase, GraduationCap, 
  ArrowRight, ArrowLeft, Check, Sparkles, LogOut, Loader2 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

import { createClient } from '@/lib/supabase/client';
import { jobApplicationSchema } from '@/schemas/application';
import { ResumeUpload } from './ResumeUpload';
import { Toast, type ToastType } from './Toast';

interface JobApplicationFormValues {
  fullName: string;
  email: string;
  phoneNumber: string;
  portfolioUrl?: string;
  resume: FileList | File | string | null;
  position: 'UI/UX Designer' | 'Full Stack Developer' | 'Mobile Developer' | 'Tester' | 'HR' | 'Digital Marketer' | 'Intern' | '';
  yearsOfExperience: number | '';
  coverLetter: string;
}

const steps = [
  { id: 1, name: 'Authentication' },
  { id: 2, name: 'Personal Details' },
  { id: 3, name: 'Position to Apply' },
  { id: 4, name: 'Additional Info' },
];

export function JobApplicationForm() {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<any>(null);
  const [isDemoUser, setIsDemoUser] = useState(false);
  const [demoProfile, setDemoProfile] = useState<{ name: string; email: string } | null>(null);
  
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Toast Notification State
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

  // Form Setup
  const methods = useForm<JobApplicationFormValues>({
    resolver: zodResolver(jobApplicationSchema) as unknown as undefined,
    mode: 'onTouched',
    defaultValues: {
      fullName: '',
      email: '',
      phoneNumber: '',
      portfolioUrl: '',
      position: '',
      yearsOfExperience: '',
      coverLetter: '',
    },
  });

  const { register, handleSubmit, setValue, trigger, formState: { errors }, reset } = methods;

  // Listen to Supabase auth state change
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  // Auto-fill form fields when Google authentication succeeds
  useEffect(() => {
    if (user) {
      const name = user.user_metadata?.full_name || user.email?.split('@')[0] || '';
      const email = user.email || '';

      setValue('fullName', name, { shouldValidate: true });
      setValue('email', email, { shouldValidate: true });

      const timer = setTimeout(() => {
        if (isDemoUser) {
          setIsDemoUser(false);
        }
        if (currentStep === 1) {
          setCurrentStep(2);
          showToast(`Welcome, ${name}! Verified details auto-filled.`, 'success');
        }
      }, 0);

      return () => clearTimeout(timer);
    }
  }, [user, setValue, currentStep, isDemoUser]);

  // Google Login Handler
  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    if (error) {
      showToast(error.message, 'error');
    }
  };

  // Demo Login Handler for testing without actual OAuth configuration
  const handleDemoLogin = () => {
    const mockUser = {
      name: 'Jane Doe',
      email: 'jane.doe@example.com',
    };
    setDemoProfile(mockUser);
    setIsDemoUser(true);
    setValue('fullName', mockUser.name, { shouldValidate: true });
    setValue('email', mockUser.email, { shouldValidate: true });
    setCurrentStep(2);
    showToast('Signed in with simulated developer credentials.', 'info');
  };

  const handleLogout = async () => {
    if (isDemoUser) {
      setIsDemoUser(false);
      setDemoProfile(null);
    } else {
      await supabase.auth.signOut();
      setUser(null);
    }
    reset({
      fullName: '',
      email: '',
      phoneNumber: '',
      portfolioUrl: '',
      resume: null,
      position: '',
      yearsOfExperience: '',
      coverLetter: '',
    });
    setCurrentStep(1);
    showToast('Signed out successfully.', 'info');
  };

  const isUserAuthenticated = !!user || isDemoUser;
  const activeUser = user 
    ? { name: user.user_metadata?.full_name || user.email?.split('@')[0], email: user.email, image: user.user_metadata?.avatar_url } 
    : demoProfile 
      ? { name: demoProfile.name, email: demoProfile.email, image: null } 
      : null;

  const isAdmin = activeUser?.email === 'admin@yourdomain.com' || activeUser?.email === 'jane.doe@example.com';

  // Move to next step with validation check
  const nextStep = async () => {
    let fieldsToValidate: (keyof JobApplicationFormValues)[] = [];
    
    if (currentStep === 1) {
      if (!isUserAuthenticated) {
        showToast('Please sign in to proceed to the next step.', 'error');
        return;
      }
      setCurrentStep(2);
      return;
    }
    
    if (currentStep === 2) {
      fieldsToValidate = ['fullName', 'email', 'phoneNumber', 'portfolioUrl', 'resume'];
    } else if (currentStep === 3) {
      fieldsToValidate = ['position'];
    }

    const isStepValid = await trigger(fieldsToValidate);
    if (isStepValid) {
      setCurrentStep((prev) => prev + 1);
    } else {
      showToast('Please fix validation errors before proceeding.', 'error');
    }
  };

  const prevStep = () => {
    setCurrentStep((prev) => prev - 1);
  };

  // Submit Handler
  const onSubmit = async (data: JobApplicationFormValues) => {
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('fullName', data.fullName);
      formData.append('email', data.email);
      formData.append('phoneNumber', data.phoneNumber);
      formData.append('portfolioUrl', data.portfolioUrl || '');
      formData.append('position', data.position);
      formData.append('yearsOfExperience', String(data.yearsOfExperience));
      formData.append('coverLetter', data.coverLetter);
      
      if (isDemoUser) {
        formData.append('isDemo', 'true');
      }
      
      // Extract FileList or File
      if (data.resume) {
        if (data.resume instanceof FileList && data.resume.length > 0) {
          formData.append('resume', data.resume[0]);
        } else if (data.resume instanceof File) {
          formData.append('resume', data.resume);
        }
      }

      const response = await fetch('/api/apply', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result.success) {
        showToast(result.message, 'success');
        
        // Trigger celebratory confetti animation
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 }
        });

        // Reset form and go back to step 1 (or show success screen)
        setTimeout(() => {
          reset();
          handleLogout();
        }, 3000);
      } else {
        const errorMsg = result.error || 'Submission failed. Please check form details.';
        showToast(errorMsg, 'error');
      }
    } catch (error) {
      console.error('Submission error:', error);
      showToast('An unexpected error occurred during submission.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-8">
      {/* Step Progress Indicator */}
      <div className="border border-slate-800 bg-slate-900/20 backdrop-blur-xl p-5 rounded-2xl">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const isCompleted = currentStep > step.id;
            const isActive = currentStep === step.id;
            
            return (
              <React.Fragment key={step.id}>
                {index > 0 && (
                  <div className={`flex-1 h-[2px] mx-2 transition-colors duration-300 ${
                    isCompleted ? 'bg-indigo-500' : 'bg-slate-850'
                  }`} />
                )}
                
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs border transition-all duration-300 ${
                    isCompleted 
                      ? 'bg-indigo-500 border-indigo-500 text-white shadow-[0_0_10px_rgba(99,102,241,0.3)]' 
                      : isActive 
                        ? 'border-indigo-500 text-indigo-400 font-extrabold bg-indigo-500/10' 
                        : 'border-slate-800 text-slate-500 bg-slate-950'
                  }`}>
                    {isCompleted ? <Check className="w-4 h-4" /> : step.id}
                  </div>
                  <span className={`text-[11px] font-semibold hidden md:inline transition-colors duration-300 ${
                    isActive ? 'text-indigo-400' : isCompleted ? 'text-slate-300' : 'text-slate-500'
                  }`}>
                    {step.name}
                  </span>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Main Container */}
      <div className="border border-slate-800 bg-slate-900/40 backdrop-blur-xl rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-violet-500/10 rounded-full blur-[100px] pointer-events-none" />

        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <AnimatePresence mode="wait">
              {/* STEP 1: Authentication */}
              {currentStep === 1 && (
                <motion.div
                  key="step-1"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-6 py-4 text-center"
                >
                  <div className="max-w-md mx-auto space-y-4">
                    <div className="mx-auto w-14 h-14 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.05)]">
                      <Sparkles className="w-7 h-7" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-100">Step 1: Verify Your Identity</h3>
                    <p className="text-sm text-slate-400 leading-relaxed">
                      To start your application, please authenticate with your Google account. 
                      This verifies your contact details and securely auto-fills the application form.
                    </p>
                  </div>

                  {!isUserAuthenticated ? (
                    <div className="flex flex-col gap-3 max-w-sm mx-auto pt-4">
                      {/* Google Login Button */}
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="button"
                        onClick={handleGoogleLogin}
                        className="flex items-center justify-center gap-3 w-full bg-white text-slate-900 hover:bg-slate-100 transition-all font-medium py-3 px-4 rounded-xl shadow-md cursor-pointer text-sm"
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          />
                        </svg>
                        Sign in with Google
                      </motion.button>

                      <div className="flex items-center gap-2 py-1">
                        <div className="flex-1 h-[1px] bg-slate-800" />
                        <span className="text-xs text-slate-500 font-medium">OR</span>
                        <div className="flex-1 h-[1px] bg-slate-800" />
                      </div>

                      {/* Simulation Button for Local Testing */}
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="button"
                        onClick={handleDemoLogin}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 px-4 rounded-xl shadow-[0_0_15px_rgba(99,102,241,0.2)] hover:shadow-[0_0_20px_rgba(99,102,241,0.4)] transition-all cursor-pointer text-sm"
                      >
                        Simulate Demo Login (No Setup Required)
                      </motion.button>
                    </div>
                  ) : (
                    <div className="max-w-sm mx-auto p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 flex flex-col items-center gap-3">
                      <div className="flex items-center gap-3 w-full">
                        {activeUser?.image ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img 
                            src={activeUser.image} 
                            alt={activeUser.name || 'User'} 
                            className="w-10 h-10 rounded-full border border-indigo-500/30"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-semibold border border-indigo-500/30">
                            {(activeUser?.name || 'U').charAt(0)}
                          </div>
                        )}
                        <div className="text-left min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-200 truncate">{activeUser?.name}</p>
                          <p className="text-xs text-slate-400 truncate">{activeUser?.email}</p>
                        </div>
                        
                        <button
                          type="button"
                          onClick={handleLogout}
                          className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors"
                          title="Sign Out"
                        >
                          <LogOut className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <div className="w-full border-t border-slate-800 pt-3 flex flex-col gap-3">
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span className="flex items-center gap-1 text-emerald-400 font-medium">
                            <Check className="w-3.5 h-3.5" /> Authenticated
                          </span>
                          <button
                            type="button"
                            onClick={nextStep}
                            className="text-indigo-400 font-semibold hover:underline flex items-center gap-1"
                          >
                            Proceed to Step 2 <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        
                        {isAdmin && (
                          <div className="flex justify-center pt-1 border-t border-slate-800/40">
                            <Link 
                              href="/admin" 
                              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-400 text-xs font-semibold transition-all"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Go to Admin Dashboard
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* STEP 2: Personal Details */}
              {currentStep === 2 && (
                <motion.div
                  key="step-2"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-5"
                >
                  <div className="border-b border-slate-800 pb-3 mb-2">
                    <h3 className="text-lg font-bold text-slate-200">Step 2: Personal Details</h3>
                    <p className="text-xs text-slate-500">Provide your verified information and resume.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {/* Full Name */}
                    <div className="space-y-1.5">
                      <label htmlFor="fullName" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Full Name <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                          <UserIcon className="w-4 h-4" />
                        </span>
                        <input
                          type="text"
                          id="fullName"
                          {...register('fullName')}
                          className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-800 bg-slate-950/60 focus:bg-slate-950/90 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
                          placeholder="Jane Doe"
                        />
                      </div>
                      {errors.fullName && (
                        <p className="text-xs font-medium text-rose-400 mt-1 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          {errors.fullName.message}
                        </p>
                      )}
                    </div>

                    {/* Email */}
                    <div className="space-y-1.5">
                      <label htmlFor="email" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Email Address <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                          <Mail className="w-4 h-4" />
                        </span>
                        <input
                          type="email"
                          id="email"
                          {...register('email')}
                          readOnly
                          className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-850 bg-slate-950/20 text-slate-400 cursor-not-allowed text-sm focus:outline-none"
                          placeholder="jane.doe@example.com"
                        />
                      </div>
                      {errors.email && (
                        <p className="text-xs font-medium text-rose-400 mt-1 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          {errors.email.message}
                        </p>
                      )}
                    </div>

                    {/* Phone Number */}
                    <div className="space-y-1.5">
                      <label htmlFor="phoneNumber" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Phone Number <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                          <Phone className="w-4 h-4" />
                        </span>
                        <input
                          type="tel"
                          id="phoneNumber"
                          {...register('phoneNumber')}
                          className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-800 bg-slate-955/60 focus:bg-slate-955/90 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
                          placeholder="+1 555-0199"
                        />
                      </div>
                      {errors.phoneNumber && (
                        <p className="text-xs font-medium text-rose-400 mt-1 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          {errors.phoneNumber.message}
                        </p>
                      )}
                    </div>

                    {/* Portfolio Link */}
                    <div className="space-y-1.5">
                      <label htmlFor="portfolioUrl" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Portfolio Website Link
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                          <Link2 className="w-4 h-4" />
                        </span>
                        <input
                          type="url"
                          id="portfolioUrl"
                          {...register('portfolioUrl')}
                          className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-800 bg-slate-955/60 focus:bg-slate-955/90 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
                          placeholder="https://janedoe.dev"
                        />
                      </div>
                      {errors.portfolioUrl && (
                        <p className="text-xs font-medium text-rose-400 mt-1 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          {errors.portfolioUrl.message}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* File Uploader Component */}
                  <div className="pt-2">
                    <ResumeUpload name="resume" />
                  </div>
                </motion.div>
              )}

              {/* STEP 3: Position to Apply */}
              {currentStep === 3 && (
                <motion.div
                  key="step-3"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-5"
                >
                  <div className="border-b border-slate-800 pb-3 mb-2">
                    <h3 className="text-lg font-bold text-slate-200">Step 3: Target Role</h3>
                    <p className="text-xs text-slate-500">Select the vacancy you are applying for.</p>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="position" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Target Position <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                        <Briefcase className="w-4 h-4" />
                      </span>
                      <select
                        id="position"
                        {...register('position')}
                        className="w-full pl-10 pr-10 py-3.5 rounded-xl border border-slate-800 bg-slate-955/60 focus:bg-slate-955/90 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm appearance-none cursor-pointer"
                      >
                        <option value="" className="text-slate-600 bg-slate-950">-- Select a Role --</option>
                        <option value="UI/UX Designer" className="bg-slate-950 text-slate-200">UI/UX Designer</option>
                        <option value="Full Stack Developer" className="bg-slate-950 text-slate-200">Full Stack Developer</option>
                        <option value="Mobile Developer" className="bg-slate-950 text-slate-200">Mobile Developer</option>
                        <option value="Tester" className="bg-slate-950 text-slate-200">Tester</option>
                        <option value="HR" className="bg-slate-950 text-slate-200">HR</option>
                        <option value="Digital Marketer" className="bg-slate-950 text-slate-200">Digital Marketer</option>
                        <option value="Intern" className="bg-slate-950 text-slate-200">Intern</option>
                      </select>
                      <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                    {errors.position && (
                      <p className="text-xs font-medium text-rose-400 mt-1 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        {errors.position.message}
                      </p>
                    )}
                  </div>

                  <div className="p-4 rounded-xl border border-slate-800 bg-slate-955/20 text-xs text-slate-400 leading-relaxed flex gap-3">
                    <GraduationCap className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                    <span>
                      Our engineering and creative positions undergo technical reviews. 
                      Ensure that your portfolios are accessible and public so that team coordinators can view your code/assets.
                    </span>
                  </div>
                </motion.div>
              )}

              {/* STEP 4: Additional Information */}
              {currentStep === 4 && (
                <motion.div
                  key="step-4"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-5"
                >
                  <div className="border-b border-slate-800 pb-3 mb-2">
                    <h3 className="text-lg font-bold text-slate-200">Step 4: Additional Experience</h3>
                    <p className="text-xs text-slate-500">Tell us a little more about yourself.</p>
                  </div>

                  {/* Years of Experience */}
                  <div className="space-y-1.5">
                    <label htmlFor="yearsOfExperience" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Years of Experience <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      id="yearsOfExperience"
                      {...register('yearsOfExperience')}
                      className="w-full px-4 py-3 rounded-xl border border-slate-800 bg-slate-955/60 focus:bg-slate-955/90 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
                      placeholder="e.g. 3"
                      min="0"
                    />
                    {errors.yearsOfExperience && (
                      <p className="text-xs font-medium text-rose-400 mt-1 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        {errors.yearsOfExperience.message}
                      </p>
                    )}
                  </div>

                  {/* Cover Letter / Bio */}
                  <div className="space-y-1.5">
                    <label htmlFor="coverLetter" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider flex justify-between">
                      <span>Cover Letter / Short Bio <span className="text-rose-500">*</span></span>
                      <span className="text-[10px] text-slate-500 font-normal">Min. 50 characters</span>
                    </label>
                    <textarea
                      id="coverLetter"
                      rows={6}
                      {...register('coverLetter')}
                      className="w-full px-4 py-3 rounded-xl border border-slate-800 bg-slate-955/60 focus:bg-slate-955/90 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm resize-y"
                      placeholder="Briefly describe your career background, key projects, and why you are excited to join our company..."
                    />
                    {errors.coverLetter && (
                      <p className="text-xs font-medium text-rose-400 mt-1 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        {errors.coverLetter.message}
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Stepper Navigation Buttons */}
            <div className="flex items-center justify-between pt-6 border-t border-slate-800 mt-6">
              {currentStep > 1 ? (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={prevStep}
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-800 bg-slate-900/20 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-all cursor-pointer text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </motion.button>
              ) : (
                <div />
              )}

              {currentStep < 4 ? (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={nextStep}
                  disabled={currentStep === 1 && !isUserAuthenticated}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.2)] hover:shadow-[0_0_20px_rgba(99,102,241,0.4)] transition-all cursor-pointer text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next <ArrowRight className="w-4 h-4" />
                </motion.button>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold shadow-[0_0_15px_rgba(99,102,241,0.3)] transition-all cursor-pointer text-sm disabled:opacity-80 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Submitting...
                    </>
                  ) : (
                    <>
                      Submit Application <Check className="w-4 h-4" />
                    </>
                  )}
                </motion.button>
              )}
            </div>

          </form>
        </FormProvider>
      </div>

      {/* Global Custom Toast Render */}
      <Toast 
        message={toast.message} 
        type={toast.type} 
        isVisible={toast.isVisible} 
        onClose={closeToast} 
      />
    </div>
  );
}
