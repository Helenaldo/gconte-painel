-- Adicionar campo para armazenar a chave do reCAPTCHA na tabela office
ALTER TABLE public.office 
ADD COLUMN recaptcha_site_key TEXT;