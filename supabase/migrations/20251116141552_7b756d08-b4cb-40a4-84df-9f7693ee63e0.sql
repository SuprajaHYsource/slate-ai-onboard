-- Create trigger function to handle SSO user profiles
CREATE OR REPLACE FUNCTION public.handle_sso_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  signup_provider TEXT;
BEGIN
  -- Determine signup method from app_metadata
  IF NEW.raw_app_meta_data ? 'provider' THEN
    signup_provider := NEW.raw_app_meta_data->>'provider';
  ELSE
    signup_provider := 'manual';
  END IF;

  -- Insert profile for SSO users
  INSERT INTO public.profiles (
    user_id,
    full_name,
    email,
    signup_method,
    is_active,
    password_set,
    email_verified
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    NEW.email,
    signup_provider,
    true,
    CASE WHEN signup_provider = 'manual' THEN true ELSE false END,
    NEW.email_confirmed_at IS NOT NULL
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email_verified = EXCLUDED.email_verified,
    last_sign_in = now();

  -- Assign default employee role if no role exists
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'employee')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Log signup activity for SSO
  IF signup_provider != 'manual' THEN
    INSERT INTO public.activity_logs (
      user_id,
      performed_by,
      action_type,
      description,
      metadata
    ) VALUES (
      NEW.id,
      NEW.id,
      'signup',
      'User signed up via ' || signup_provider,
      jsonb_build_object('method', signup_provider, 'email', NEW.email)
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger for new users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_sso_user();