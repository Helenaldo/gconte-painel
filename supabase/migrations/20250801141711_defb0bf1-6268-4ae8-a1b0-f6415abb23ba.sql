-- Insert the first admin user directly into auth.users and profiles
-- First, we need to create the user through Supabase Auth admin functions
-- This will be done through the interface, but let's prepare the profile data

-- Create a function to make a user admin after signup
CREATE OR REPLACE FUNCTION public.make_user_admin(user_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Update the user's role to administrator
  UPDATE public.profiles 
  SET role = 'administrador' 
  WHERE email = user_email;
  
  -- Update user_roles table
  UPDATE public.user_roles 
  SET role = 'administrador' 
  WHERE user_id = (SELECT id FROM public.profiles WHERE email = user_email);
  
  -- If no user_roles record exists, insert one
  INSERT INTO public.user_roles (user_id, role)
  SELECT id, 'administrador'::app_role
  FROM public.profiles 
  WHERE email = user_email
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = (SELECT id FROM public.profiles WHERE email = user_email)
  );
END;
$$;