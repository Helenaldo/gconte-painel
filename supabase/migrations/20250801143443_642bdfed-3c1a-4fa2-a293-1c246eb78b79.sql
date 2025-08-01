-- Remove restrições de administrador para colaboradores
-- Permitir todos os usuários autenticados gerenciarem profiles e user_roles

-- Atualizar políticas da tabela profiles
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile during signup" ON public.profiles;

-- Novas políticas mais permissivas para profiles
CREATE POLICY "Authenticated users can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert profiles" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update all profiles" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

-- Atualizar políticas da tabela user_roles
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view all roles" ON public.user_roles;

-- Novas políticas mais permissivas para user_roles
CREATE POLICY "Authenticated users can view all roles" 
ON public.user_roles 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage all roles" 
ON public.user_roles 
FOR ALL 
USING (auth.uid() IS NOT NULL);

-- Atualizar políticas da tabela invitations
DROP POLICY IF EXISTS "Admins can manage invitations" ON public.invitations;

CREATE POLICY "Authenticated users can manage invitations" 
ON public.invitations 
FOR ALL 
USING (auth.uid() IS NOT NULL);