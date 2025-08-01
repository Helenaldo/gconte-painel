-- Alterar conta 1.2.4 - INTANGÍVEL para 1.2.9 - INTANGÍVEL
UPDATE public.plano_contas 
SET codigo = '1.2.9', nome = 'INTANGÍVEL'
WHERE codigo = '1.2.4' AND nome = 'INTANGÍVEL';

-- Adicionar nova conta 1.2.4 - ( - ) Depreciação Acumulada
INSERT INTO public.plano_contas (codigo, nome, grupo, tipo)
VALUES ('1.2.4', '( - ) Depreciação Acumulada', 'ativo_nao_circulante', 'ativo');