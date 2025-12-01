-- Add new columns to activity_logs table for comprehensive logging
ALTER TABLE public.activity_logs
ADD COLUMN IF NOT EXISTS module text DEFAULT 'auth',
ADD COLUMN IF NOT EXISTS target text,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'success';

-- Add new action types to the enum (they can be used after commit)
ALTER TYPE public.action_type ADD VALUE IF NOT EXISTS 'otp_verification';
ALTER TYPE public.action_type ADD VALUE IF NOT EXISTS 'otp_resend';
ALTER TYPE public.action_type ADD VALUE IF NOT EXISTS 'forgot_email';
ALTER TYPE public.action_type ADD VALUE IF NOT EXISTS 'forgot_password';
ALTER TYPE public.action_type ADD VALUE IF NOT EXISTS 'password_reset';
ALTER TYPE public.action_type ADD VALUE IF NOT EXISTS 'password_set';
ALTER TYPE public.action_type ADD VALUE IF NOT EXISTS 'custom_role_created';
ALTER TYPE public.action_type ADD VALUE IF NOT EXISTS 'custom_role_updated';
ALTER TYPE public.action_type ADD VALUE IF NOT EXISTS 'custom_role_deleted';
ALTER TYPE public.action_type ADD VALUE IF NOT EXISTS 'permission_updated';
ALTER TYPE public.action_type ADD VALUE IF NOT EXISTS 'user_role_assigned';
ALTER TYPE public.action_type ADD VALUE IF NOT EXISTS 'user_status_changed';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_activity_logs_module ON public.activity_logs(module);
CREATE INDEX IF NOT EXISTS idx_activity_logs_status ON public.activity_logs(status);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);