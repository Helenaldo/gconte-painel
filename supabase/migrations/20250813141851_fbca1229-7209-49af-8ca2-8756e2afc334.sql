-- Fix the handle_new_user function to properly handle constraints
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_role app_role;
  user_nome text;
BEGIN
  -- Extract user metadata with fallbacks
  user_nome := COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1));
  user_role := COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'operador');
  
  -- Insert into profiles table (use INSERT ... ON CONFLICT DO UPDATE)
  INSERT INTO public.profiles (id, nome, email, role)
  VALUES (
    NEW.id,
    user_nome,
    NEW.email,
    user_role
  ) ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    email = EXCLUDED.email,
    role = EXCLUDED.role;
  
  -- Insert into user_roles table (remove unique constraint issue)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- If user is admin, remove any other roles
  IF user_role = 'administrador' THEN
    DELETE FROM public.user_roles 
    WHERE user_id = NEW.id AND role != 'administrador';
  ELSIF user_role = 'operador' THEN
    DELETE FROM public.user_roles 
    WHERE user_id = NEW.id AND role != 'operador';
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error for debugging
    RAISE LOG 'Error in handle_new_user: %', SQLERRM;
    -- Don't block user creation, just return
    RETURN NEW;
END;
$$;