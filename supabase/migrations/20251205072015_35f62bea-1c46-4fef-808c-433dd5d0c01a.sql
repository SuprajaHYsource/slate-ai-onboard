-- Update existing role to admin for suprajakandula52@gmail.com (user_id: 30615eac-a35c-4b55-9518-64501d56ae9f)
UPDATE public.user_roles 
SET role = 'admin', assigned_at = now()
WHERE user_id = '30615eac-a35c-4b55-9518-64501d56ae9f';