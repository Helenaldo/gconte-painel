-- Add unique constraint to user_roles if it doesn't exist
DO $$
BEGIN
    -- Add unique constraint to user_roles on (user_id, role) if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'user_roles_user_id_role_key' 
        AND table_name = 'user_roles'
    ) THEN
        ALTER TABLE public.user_roles 
        ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);
    END IF;
END $$;

-- Now create the missing profile for the collaborator manually
INSERT INTO public.profiles (id, nome, email, role, status)
VALUES (
  '7f8f9e99-6f4b-46f4-b6f6-f0abd5c9c978',
  'contador',
  'contador@gconte.com.br',
  'administrador',
  'ativo'
) ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  email = EXCLUDED.email,
  role = EXCLUDED.role;

-- Create the user_roles entry
INSERT INTO public.user_roles (user_id, role)
VALUES (
  '7f8f9e99-6f4b-46f4-b6f6-f0abd5c9c978',
  'administrador'
) ON CONFLICT (user_id, role) DO NOTHING;