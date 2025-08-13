-- Create the missing profile for the collaborator that was created but failed to get a profile
-- First, let's get the user info and create the profile manually
INSERT INTO public.profiles (id, nome, email, role, status)
SELECT 
  id,
  COALESCE(raw_user_meta_data->>'nome', 'contador'),
  email,
  COALESCE((raw_user_meta_data->>'role')::app_role, 'administrador'::app_role),
  'ativo'
FROM auth.users 
WHERE email = 'contador@gconte.com.br'
ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  email = EXCLUDED.email,
  role = EXCLUDED.role;

-- Also create the user_roles entry
INSERT INTO public.user_roles (user_id, role)
SELECT 
  id,
  COALESCE((raw_user_meta_data->>'role')::app_role, 'administrador'::app_role)
FROM auth.users 
WHERE email = 'contador@gconte.com.br'
ON CONFLICT (user_id, role) DO NOTHING;