-- Create the private `resumes` storage bucket used for PDF uploads.
-- The RLS policies on storage.objects (owner-only, folder = auth.uid()) are
-- created in the earlier migration; this migration just ensures the bucket
-- itself exists when applying migrations to a fresh Supabase project.
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', false)
ON CONFLICT (id) DO NOTHING;
