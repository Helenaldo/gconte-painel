-- Ensure proper admin role setup and create password management function
-- First, let's make sure the admin role checking function works correctly
CREATE OR REPLACE FUNCTION public.ensure_admin_privileges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- When a user is updated to admin role, ensure they have admin in user_roles
  IF NEW.role = 'administrador' THEN
    -- Insert or update user_roles table
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'administrador'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    
    -- Remove any non-admin roles for this user
    DELETE FROM public.user_roles 
    WHERE user_id = NEW.id AND role != 'administrador';
  ELSIF NEW.role = 'operador' THEN
    -- Insert or update user_roles table
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'operador'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    
    -- Remove any admin roles for this user
    DELETE FROM public.user_roles 
    WHERE user_id = NEW.id AND role != 'operador';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to ensure admin privileges are properly set
DROP TRIGGER IF EXISTS ensure_admin_privileges_trigger ON public.profiles;
CREATE TRIGGER ensure_admin_privileges_trigger
  AFTER UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_admin_privileges();