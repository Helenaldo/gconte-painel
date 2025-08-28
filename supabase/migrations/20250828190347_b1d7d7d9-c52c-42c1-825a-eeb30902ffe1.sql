-- Adicionar campo para chave secreta do reCAPTCHA na tabela office
ALTER TABLE public.office 
ADD COLUMN recaptcha_secret_key text;

COMMENT ON COLUMN public.office.recaptcha_secret_key IS 'Chave secreta do Google reCAPTCHA v2 para validação no backend';