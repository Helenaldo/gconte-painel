-- Inserir novas contas filhas em 3.1.2 – Deduções da Receita
INSERT INTO public.plano_contas (codigo, nome, tipo, grupo) VALUES
('3.1.2.1', 'ISS', 'RESULTADO', 'RECEITA'),
('3.1.2.2', 'Simples Nacional', 'RESULTADO', 'RECEITA'), 
('3.1.2.3', 'PIS', 'RESULTADO', 'RECEITA'),
('3.1.2.4', 'COFINS', 'RESULTADO', 'RECEITA'),
('3.1.2.5', 'ICMS', 'RESULTADO', 'RECEITA'),
('3.1.2.9', 'Outras Deduções', 'RESULTADO', 'RECEITA');