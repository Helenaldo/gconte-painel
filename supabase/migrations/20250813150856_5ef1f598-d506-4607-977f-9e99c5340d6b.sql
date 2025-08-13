-- Permitir acesso público de leitura aos dados do escritório na tela de login
-- Esta política permite que qualquer pessoa veja as informações básicas do escritório
-- que são exibidas na tela de login

CREATE POLICY "Anyone can view office information for login page"
ON public.office
FOR SELECT
USING (true);