-- Add responsibilities and rules columns to custom_roles table
ALTER TABLE public.custom_roles 
ADD COLUMN IF NOT EXISTS responsibilities text,
ADD COLUMN IF NOT EXISTS rules text;