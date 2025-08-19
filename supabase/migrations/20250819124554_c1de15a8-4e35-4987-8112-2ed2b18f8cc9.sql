-- Corrigir políticas RLS para permitir acesso aos dados básicos
-- Remover dependência de funções complexas e usar políticas mais simples

-- Policies para clients
DROP POLICY IF EXISTS "Authenticated users can view clients" ON clients;
DROP POLICY IF EXISTS "Authenticated users can insert clients" ON clients;
DROP POLICY IF EXISTS "Authenticated users can update clients" ON clients;
DROP POLICY IF EXISTS "Authenticated users can delete clients" ON clients;

CREATE POLICY "Allow authenticated users full access to clients"
ON clients FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Policies para profiles
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can insert profiles" ON profiles;

CREATE POLICY "Allow authenticated users to view all profiles"
ON profiles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to update all profiles"
ON profiles FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to insert profiles"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policies para taxation
DROP POLICY IF EXISTS "Authenticated users can view taxation" ON taxation;
DROP POLICY IF EXISTS "Authenticated users can insert taxation" ON taxation;
DROP POLICY IF EXISTS "Authenticated users can update taxation" ON taxation;
DROP POLICY IF EXISTS "Authenticated users can delete taxation" ON taxation;

CREATE POLICY "Allow authenticated users full access to taxation"
ON taxation FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Policies para contacts
DROP POLICY IF EXISTS "Authenticated users can view contacts" ON contacts;
DROP POLICY IF EXISTS "Authenticated users can insert contacts" ON contacts;
DROP POLICY IF EXISTS "Authenticated users can update contacts" ON contacts;
DROP POLICY IF EXISTS "Authenticated users can delete contacts" ON contacts;

CREATE POLICY "Allow authenticated users full access to contacts"
ON contacts FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);