-- Add custom_role_id column to user_roles to support custom role assignments
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS custom_role_id uuid REFERENCES public.custom_roles(id) ON DELETE SET NULL;

-- Make role column nullable to allow either system role OR custom role
ALTER TABLE public.user_roles 
ALTER COLUMN role DROP NOT NULL;

-- Add check constraint to ensure either role or custom_role_id is set (but not both)
ALTER TABLE public.user_roles 
ADD CONSTRAINT user_roles_role_check 
CHECK (
  (role IS NOT NULL AND custom_role_id IS NULL) OR 
  (role IS NULL AND custom_role_id IS NOT NULL)
);

-- Create index for custom_role_id
CREATE INDEX IF NOT EXISTS idx_user_roles_custom_role_id ON public.user_roles(custom_role_id);