-- =======================================================
-- SUPABASE PROJECT DATABASE SCHEMA & RLS POLICIES
-- =======================================================

-- 1. Create Position enum type
CREATE TYPE public.candidate_position AS ENUM (
  'UI/UX Designer', 
  'Full Stack Developer', 
  'Mobile Developer', 
  'Tester', 
  'HR', 
  'Digital Marketer', 
  'Intern'
);

-- 2. Create Candidate Status enum type
CREATE TYPE public.candidate_status AS ENUM (
  'PENDING', 
  'SHORTLISTED', 
  'TASK_ASSIGNED', 
  'SUBMITTED', 
  'REJECTED'
);

-- 3. Create Task Status enum type
CREATE TYPE public.task_status AS ENUM (
  'ASSIGNED', 
  'SUBMITTED', 
  'OVERDUE',
  'ACCEPTED',
  'REJECTED'
);

-- 4. Create Sender Type enum type
CREATE TYPE public.sender_type AS ENUM (
  'CANDIDATE', 
  'ADMIN'
);

-- 5. Create Candidates Table
CREATE TABLE public.candidates (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  portfolio_url TEXT,
  resume_url TEXT NOT NULL,
  position public.candidate_position NOT NULL,
  years_of_experience INTEGER NOT NULL,
  cover_letter TEXT,
  status public.candidate_status NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Create Tasks Table
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE UNIQUE,
  title TEXT NOT NULL,
  instructions TEXT NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deadline TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '48 hours'),
  submission_url TEXT,
  submission_notes TEXT,
  submitted_at TIMESTAMPTZ,
  status public.task_status NOT NULL DEFAULT 'ASSIGNED',
  reminder_sent BOOLEAN NOT NULL DEFAULT false
);

-- 7. Create Messages Table
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  sender_type public.sender_type NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Enable Row-Level Security (RLS) on tables
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 9. Admin Identification Helper Function
-- Identifies if the current user claims represent an authorized admin email.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN SECURITY DEFINER AS $$
BEGIN
  RETURN auth.jwt() ->> 'email' = 'admin@yourdomain.com'
         OR auth.jwt() ->> 'email' = 'jane.doe@example.com';
END;
$$ LANGUAGE plpgsql;

-- 10. RLS Policies: Candidates Table
CREATE POLICY "Select Candidates Policy" ON public.candidates
  FOR SELECT USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Insert Candidates Policy" ON public.candidates
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Update Candidates Policy" ON public.candidates
  FOR UPDATE USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Delete Candidates Policy" ON public.candidates
  FOR DELETE USING (public.is_admin());

-- 11. RLS Policies: Tasks Table
CREATE POLICY "Select Tasks Policy" ON public.tasks
  FOR SELECT USING (candidate_id = auth.uid() OR public.is_admin());

CREATE POLICY "Insert Tasks Policy" ON public.tasks
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Update Tasks Policy" ON public.tasks
  FOR UPDATE USING (candidate_id = auth.uid() OR public.is_admin());

CREATE POLICY "Delete Tasks Policy" ON public.tasks
  FOR DELETE USING (public.is_admin());

-- 12. RLS Policies: Messages Table
CREATE POLICY "Select Messages Policy" ON public.messages
  FOR SELECT USING (candidate_id = auth.uid() OR public.is_admin());

CREATE POLICY "Insert Messages Policy" ON public.messages
  FOR INSERT WITH CHECK (candidate_id = auth.uid() OR public.is_admin());

CREATE POLICY "Update Messages Policy" ON public.messages
  FOR UPDATE USING (candidate_id = auth.uid() OR public.is_admin());

CREATE POLICY "Delete Messages Policy" ON public.messages
  FOR DELETE USING (public.is_admin());

-- 13. Create storage buckets for files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('resumes', 'resumes', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('task-submissions', 'task-submissions', false)
ON CONFLICT (id) DO NOTHING;

-- 14. Enable RLS on storage objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 15. Create storage object policies
CREATE POLICY "Select Resumes Policy" ON storage.objects
  FOR SELECT USING (bucket_id = 'resumes' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin()));

CREATE POLICY "Insert Resumes Policy" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'resumes' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin()));

CREATE POLICY "Select Task Submissions Policy" ON storage.objects
  FOR SELECT USING (bucket_id = 'task-submissions' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin()));

CREATE POLICY "Insert Task Submissions Policy" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'task-submissions' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin()));
