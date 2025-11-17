-- Allow authenticated users to read OTP records for verification
-- This is needed for the forgot password flow where users verify OTPs from the client
CREATE POLICY "Authenticated users can read OTP records"
ON otp_verifications
FOR SELECT
TO authenticated
USING (true);