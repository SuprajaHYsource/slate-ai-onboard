-- Create app_role enum for role types
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'hr', 'manager', 'employee');

-- Create action_type enum for activity logging
CREATE TYPE public.action_type AS ENUM (
  'login', 'logout', 'failed_login', 'signup',
  'user_created', 'user_updated', 'user_deleted',
  'role_assigned', 'role_changed', 'permission_updated',
  'profile_updated', 'email_changed', 'password_changed',
  'status_changed', 'password_set'
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Create custom_roles table for user-defined roles
CREATE TABLE public.custom_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create permissions table
CREATE TABLE public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT,
  UNIQUE(module, action)
);

-- Create role_permissions mapping table
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role,
  custom_role_id UUID REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(role, permission_id),
  UNIQUE(custom_role_id, permission_id),
  CHECK ((role IS NOT NULL AND custom_role_id IS NULL) OR (role IS NULL AND custom_role_id IS NOT NULL))
);

-- Create activity_logs table
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type public.action_type NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Update profiles table with additional fields
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS profile_picture_url TEXT,
  ADD COLUMN IF NOT EXISTS contact_number TEXT,
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS signup_method TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_sign_in TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;

-- Enable RLS on all tables
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to check if user has any admin role
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'admin')
  )
$$;

-- Create function to check permission
CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _module TEXT, _action TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON ur.role = rp.role
    JOIN public.permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = _user_id
      AND p.module = _module
      AND p.action = _action
  )
$$;

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can assign roles"
  ON public.user_roles FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update roles"
  ON public.user_roles FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE
  USING (public.is_admin(auth.uid()));

-- RLS Policies for custom_roles
CREATE POLICY "Everyone can view active custom roles"
  ON public.custom_roles FOR SELECT
  USING (is_active = true OR public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage custom roles"
  ON public.custom_roles FOR ALL
  USING (public.is_admin(auth.uid()));

-- RLS Policies for permissions
CREATE POLICY "Everyone can view permissions"
  ON public.permissions FOR SELECT
  USING (true);

CREATE POLICY "Only super admins can manage permissions"
  ON public.permissions FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'));

-- RLS Policies for role_permissions
CREATE POLICY "Everyone can view role permissions"
  ON public.role_permissions FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage role permissions"
  ON public.role_permissions FOR ALL
  USING (public.is_admin(auth.uid()));

-- RLS Policies for activity_logs
CREATE POLICY "Users can view their own activity logs"
  ON public.activity_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all activity logs"
  ON public.activity_logs FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Anyone authenticated can insert activity logs"
  ON public.activity_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Update profiles RLS to allow admins to view/edit all profiles
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- Create trigger for custom_roles updated_at
CREATE TRIGGER update_custom_roles_updated_at
  BEFORE UPDATE ON public.custom_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default permissions
INSERT INTO public.permissions (module, action, description) VALUES
  ('dashboard', 'view', 'View dashboard'),
  ('profile', 'view', 'View own profile'),
  ('profile', 'edit', 'Edit own profile'),
  ('users', 'view', 'View users list'),
  ('users', 'create', 'Create new users'),
  ('users', 'edit', 'Edit users'),
  ('users', 'delete', 'Delete users'),
  ('users', 'manage', 'Full user management access'),
  ('rbac', 'view', 'View roles and permissions'),
  ('rbac', 'create', 'Create custom roles'),
  ('rbac', 'edit', 'Edit roles and permissions'),
  ('rbac', 'delete', 'Delete custom roles'),
  ('rbac', 'manage', 'Full RBAC management access'),
  ('activity_logs', 'view', 'View activity logs'),
  ('settings', 'view', 'View settings'),
  ('settings', 'edit', 'Edit settings')
ON CONFLICT (module, action) DO NOTHING;

-- Assign default permissions to super_admin (all permissions)
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'super_admin', id FROM public.permissions
ON CONFLICT DO NOTHING;

-- Assign permissions to admin (all except some RBAC management)
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'admin', id FROM public.permissions
WHERE NOT (module = 'rbac' AND action = 'manage')
ON CONFLICT DO NOTHING;

-- Assign permissions to hr
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'hr', id FROM public.permissions
WHERE module IN ('dashboard', 'profile', 'users', 'activity_logs')
  AND action IN ('view', 'edit', 'create')
ON CONFLICT DO NOTHING;

-- Assign permissions to manager
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'manager', id FROM public.permissions
WHERE module IN ('dashboard', 'profile', 'users')
  AND action IN ('view', 'edit')
ON CONFLICT DO NOTHING;

-- Assign permissions to employee (basic access)
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'employee', id FROM public.permissions
WHERE module IN ('dashboard', 'profile')
  AND action IN ('view', 'edit')
ON CONFLICT DO NOTHING;

-- Create index for performance
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role);
CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX idx_role_permissions_role ON public.role_permissions(role);
CREATE INDEX idx_profiles_is_active ON public.profiles(is_active);
CREATE INDEX idx_profiles_signup_method ON public.profiles(signup_method);