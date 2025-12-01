-- Add missing permissions for all modules with all actions (view, create, edit, delete)
-- This ensures all modules have complete permission options

-- Activity Logs - add create, edit, delete
INSERT INTO public.permissions (module, action, description)
VALUES 
  ('activity_logs', 'create', 'Create activity log entries'),
  ('activity_logs', 'edit', 'Edit activity log entries'),
  ('activity_logs', 'delete', 'Delete activity log entries')
ON CONFLICT DO NOTHING;

-- Dashboard - add create, edit, delete
INSERT INTO public.permissions (module, action, description)
VALUES 
  ('dashboard', 'create', 'Create dashboard items'),
  ('dashboard', 'edit', 'Edit dashboard items'),
  ('dashboard', 'delete', 'Delete dashboard items')
ON CONFLICT DO NOTHING;

-- Profile - add create, delete
INSERT INTO public.permissions (module, action, description)
VALUES 
  ('profile', 'create', 'Create profile entries'),
  ('profile', 'delete', 'Delete profile entries')
ON CONFLICT DO NOTHING;

-- Settings - add create, delete
INSERT INTO public.permissions (module, action, description)
VALUES 
  ('settings', 'create', 'Create settings'),
  ('settings', 'delete', 'Delete settings')
ON CONFLICT DO NOTHING;

-- Ensure view permissions exist for all modules
INSERT INTO public.permissions (module, action, description)
VALUES 
  ('activity_logs', 'view', 'View activity logs'),
  ('dashboard', 'view', 'View dashboard'),
  ('profile', 'view', 'View profiles'),
  ('profile', 'edit', 'Edit profiles'),
  ('rbac', 'view', 'View RBAC settings'),
  ('rbac', 'create', 'Create roles'),
  ('rbac', 'edit', 'Edit roles'),
  ('rbac', 'delete', 'Delete roles'),
  ('settings', 'view', 'View settings'),
  ('settings', 'edit', 'Edit settings'),
  ('users', 'view', 'View users'),
  ('users', 'create', 'Create users'),
  ('users', 'edit', 'Edit users'),
  ('users', 'delete', 'Delete users')
ON CONFLICT DO NOTHING;