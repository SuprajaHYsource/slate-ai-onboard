-- Add work details columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS employee_id text,
ADD COLUMN IF NOT EXISTS department text,
ADD COLUMN IF NOT EXISTS position text,
ADD COLUMN IF NOT EXISTS join_date date,
ADD COLUMN IF NOT EXISTS location text;