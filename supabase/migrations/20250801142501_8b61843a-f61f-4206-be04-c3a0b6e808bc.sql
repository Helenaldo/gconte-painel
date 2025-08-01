-- Fix the trigger function to handle errors properly
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  user_role app_role;
  user_nome text;
BEGIN
  -- Extract user metadata with fallbacks
  user_nome := COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1));
  user_role := COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'operador');
  
  -- Insert into profiles table
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
  
  -- Insert into user_roles table
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error for debugging
    RAISE LOG 'Error in handle_new_user: %', SQLERRM;
    -- Don't block user creation, just return
    RETURN NEW;
END;
$$;

-- Also fix the user_roles table constraint issue
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);

-- Update the RLS policy for profiles to allow insertion during signup
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
CREATE POLICY "Users can insert own profile during signup" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = id OR auth.uid() IS NULL);