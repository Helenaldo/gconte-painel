-- Verificar se existe trigger
SELECT * FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created';

-- Criar o trigger se não existir
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Inserir manualmente o perfil do usuário existente
INSERT INTO public.profiles (id, nome, email, role)
SELECT id, 'Helenaldo', email, 'administrador'::app_role
FROM auth.users 
WHERE email = 'contato@helenaldo.com.br'
ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  email = EXCLUDED.email,
  role = EXCLUDED.role;

-- Inserir também na tabela user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'administrador'::app_role
FROM auth.users 
WHERE email = 'contato@helenaldo.com.br'
ON CONFLICT (user_id) DO UPDATE SET
  role = EXCLUDED.role;