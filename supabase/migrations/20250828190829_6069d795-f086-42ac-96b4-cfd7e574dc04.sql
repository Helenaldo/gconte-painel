-- Limpar temporariamente a chave do reCAPTCHA para permitir login
UPDATE public.office 
SET recaptcha_site_key = NULL
WHERE recaptcha_site_key IS NOT NULL;

-- Verificar se a operação foi bem-sucedida
SELECT id, nome, recaptcha_site_key, recaptcha_secret_key
FROM public.office;