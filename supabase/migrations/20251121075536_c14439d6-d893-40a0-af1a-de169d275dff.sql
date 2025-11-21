-- Fix Critical Security Issue: Remove public SELECT access to OTP verifications
-- OTP codes should ONLY be accessible via edge functions with service_role access

-- Drop the insecure policy that allows any authenticated user to read all OTPs
DROP POLICY IF EXISTS "Authenticated users can read OTP records" ON public.otp_verifications;

-- OTP verification should only happen server-side in edge functions
-- The service_role policy remains to allow edge functions to access OTPs

-- Activity logs should only be insertable by authenticated users for their own actions
DROP POLICY IF EXISTS "Anyone can insert activity logs" ON public.activity_logs;

-- Create more restrictive policy for activity logs
CREATE POLICY "Users can log their own actions" ON public.activity_logs
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id AND
  auth.uid() = performed_by
);