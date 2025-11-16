-- Update RLS policy for activity_logs to allow unauthenticated inserts for signup tracking
DROP POLICY IF EXISTS "Anyone authenticated can insert activity logs" ON public.activity_logs;

-- Allow anyone to insert activity logs (including unauthenticated for signup tracking)
CREATE POLICY "Anyone can insert activity logs"
  ON public.activity_logs FOR INSERT
  WITH CHECK (true);

-- Keep existing select policies as they are
-- Users can still only view their own logs or admins can view all