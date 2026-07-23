'use client';

import React, { useState, useRef } from 'react';
import { useFormContext } from 'react-hook-form';
import { UploadCloud, FileText, Trash2, CheckCircle2 } from 'lucide-react';

interface ResumeUploadProps {
  name: string;
}

export function ResumeUpload({ name }: ResumeUploadProps) {
  const { setValue, watch, trigger, formState: { errors } } = useFormContext();
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Watch the file value in React Hook Form
  const fileValue = watch(name);
  
  let selectedFile: File | null = null;
  if (fileValue) {
    if (typeof window !== 'undefined' && fileValue instanceof FileList && fileValue.length > 0) {
      selectedFile = fileValue[0];
    } else if (fileValue instanceof File) {
      selectedFile = fileValue;
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setValue(name, e.dataTransfer.files, { shouldValidate: true });
      await trigger(name);
    }
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setValue(name, e.target.files, { shouldValidate: true });
      await trigger(name);
    }
  };

  const handleRemove = async () => {
    setValue(name, null, { shouldValidate: true });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    await trigger(name);
  };

  const fieldError = errors[name]?.message as string | undefined;

  return (
    <div className="w-full">
      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
        Upload Resume / CV <span className="text-rose-500">*</span>
      </label>
      
      <input
        type="file"
        id={name}
        accept=".pdf,.docx,.doc"
        className="hidden"
        ref={fileInputRef}
        onChange={handleChange}
      />

      {!selectedFile ? (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 cursor-pointer transition-all duration-300 group
            ${isDragActive 
              ? 'border-indigo-500 bg-indigo-500/5 shadow-[0_0_15px_rgba(99,102,241,0.1)]' 
              : 'border-slate-800 hover:border-slate-700 bg-slate-950/40 hover:bg-slate-900/40'
            }`}
        >
          <div className="p-3 rounded-full bg-slate-900 text-slate-400 group-hover:text-indigo-400 group-hover:scale-110 transition-all duration-300 mb-3 border border-slate-800">
            <UploadCloud className="w-6 h-6" />
          </div>
          <p className="text-sm font-medium text-slate-300 group-hover:text-slate-200 transition-colors">
            Drag & drop your resume here, or <span className="text-indigo-400 font-semibold group-hover:underline">browse</span>
          </p>
          <p className="text-xs text-slate-500 mt-1.5">
            Supported formats: PDF, DOCX, DOC (Max 5MB)
          </p>
        </div>
      ) : (
        <div className="flex items-center justify-between p-4 rounded-xl border border-slate-800 bg-slate-950/80 backdrop-blur-md shadow-md animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-200 truncate pr-4">
                {selectedFile.name}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-slate-500">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </span>
                <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Ready
                </span>
              </div>
            </div>
          </div>
          
          <button
            type="button"
            onClick={handleRemove}
            className="p-2 rounded-lg hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 border border-transparent hover:border-rose-500/10 transition-all duration-200"
            title="Remove file"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}

      {fieldError && (
        <p className="text-xs font-medium text-rose-400 mt-2 flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0" />
          {fieldError}
        </p>
      )}
    </div>
  );
}
