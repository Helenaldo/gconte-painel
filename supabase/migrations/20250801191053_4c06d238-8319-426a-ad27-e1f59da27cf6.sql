-- Remover plano de contas existente
DELETE FROM public.plano_contas;

-- Inserir novo plano de contas padrão
INSERT INTO public.plano_contas (codigo, nome, tipo, grupo) VALUES
-- 1. ATIVO
('1', 'ATIVO', 'ativo', 'ativo'),
-- 1.1. ATIVO CIRCULANTE
('1.1', 'ATIVO CIRCULANTE', 'ativo', 'ativo_circulante'),
-- 1.1.1. DISPONÍVEL
('1.1.1', 'DISPONÍVEL', 'ativo', 'ativo_circulante'),
('1.1.1.1', 'CAIXA E EQUIVALENTE DE CAIXA', 'ativo', 'ativo_circulante'),
('1.1.1.2', 'BANCOS', 'ativo', 'ativo_circulante'),
('1.1.1.3', 'INVESTIMENTOS DE LIQUIDEZ IMEDIATA', 'ativo', 'ativo_circulante'),
-- 1.1.2. CONTAS A RECEBER
('1.1.2', 'CONTAS A RECEBER', 'ativo', 'ativo_circulante'),
('1.1.2.1', 'CLIENTES', 'ativo', 'ativo_circulante'),
-- 1.1.3. OUTROS VALORES A RECEBER A CURTO PRAZO
('1.1.3', 'OUTROS VALORES A RECEBER A CURTO PRAZO', 'ativo', 'ativo_circulante'),
-- 1.1.4. ESTOQUES
('1.1.4', 'ESTOQUES', 'ativo', 'ativo_circulante'),
-- 1.2. ATIVO NÃO CIRCULANTE
('1.2', 'ATIVO NÃO CIRCULANTE', 'ativo', 'ativo_nao_circulante'),
('1.2.1', 'REALIZAVEL A LONGO PRAZO', 'ativo', 'ativo_nao_circulante'),
('1.2.2', 'INVESTIMENTOS', 'ativo', 'ativo_nao_circulante'),
('1.2.3', 'IMOBILIZADO', 'ativo', 'ativo_nao_circulante'),
('1.2.4', 'INTANGÍVEL', 'ativo', 'ativo_nao_circulante'),

-- 2. PASSIVO
('2', 'PASSIVO', 'passivo', 'passivo'),
-- 2.1. PASSIVO CIRCULANTE
('2.1', 'PASSIVO CIRCULANTE', 'passivo', 'passivo_circulante'),
('2.1.1', 'FORNECEDORES', 'passivo', 'passivo_circulante'),
('2.1.2', 'OBRIGAÇÕES SOCIAIS', 'passivo', 'passivo_circulante'),
('2.1.3', 'OBRIGAÇÕES TRABALHISTAS', 'passivo', 'passivo_circulante'),
('2.1.4', 'OBRIGAÇÕES FISCAIS', 'passivo', 'passivo_circulante'),
('2.1.5', 'PROVISÕES A PAGAR', 'passivo', 'passivo_circulante'),
('2.1.6', 'TRIBUTOS PARCELADOS', 'passivo', 'passivo_circulante'),
('2.1.7', 'EMPRÉSTIMOS E FINANCIAMENTOS', 'passivo', 'passivo_circulante'),
('2.1.8', 'OUTRAS CONTAS A PAGAR DE CURTO PRAZO', 'passivo', 'passivo_circulante'),
-- 2.2. PASSIVO NÃO CIRCULANTE
('2.2', 'PASSIVO NÃO CIRCULANTE', 'passivo', 'passivo_nao_circulante'),
('2.2.1', 'EXIGÍVEL A LONGO PRAZO', 'passivo', 'passivo_nao_circulante'),
('2.2.1.1', 'EMPRESTIMOS E FINANCIAMENTOS', 'passivo', 'passivo_nao_circulante'),
('2.2.1.2', 'TRIBUTOS PARCELADOS', 'passivo', 'passivo_nao_circulante'),
-- 2.3. PATRIMÔNIO LÍQUIDO
('2.3', 'PATRIMÔNIO LÍQUIDO', 'patrimonio', 'patrimonio_liquido'),
('2.3.1', 'CAPITAL SOCIAL', 'patrimonio', 'patrimonio_liquido'),
('2.3.2', 'RESERVAS', 'patrimonio', 'patrimonio_liquido'),
('2.3.3', 'LUCRO OU PREJUÍZOS ACUMULADOS', 'patrimonio', 'patrimonio_liquido'),

-- 3. RECEITAS
('3', 'RECEITAS', 'resultado', 'receitas'),
-- 3.1. RECEITA OPERACIONAL
('3.1', 'RECEITA OPERACIONAL', 'resultado', 'receitas'),
('3.1.1', 'RECEITA BRUTA', 'resultado', 'receitas'),
('3.1.2', 'DEDUÇÕES DA RECEITA', 'resultado', 'receitas'),
('3.1.3', 'RECEITA FINANCEIRA', 'resultado', 'receitas'),
-- 3.2. RECEITA NÃO OPERACIONAL
('3.2', 'RECEITA NÃO OPERACIONAL', 'resultado', 'receitas'),

-- 4. CUSTOS E DESPESAS
('4', 'CUSTOS E DESPESAS', 'resultado', 'custos_despesas'),
-- 4.1. CUSTOS
('4.1', 'CUSTOS', 'resultado', 'custos'),
('4.1.1', 'CUSTOS DOS SERVIÇOS/PRODUTOS/MERCADORIAS VENDIDAS', 'resultado', 'custos'),
('4.1.2', 'CUSTOS COM PESSOAL', 'resultado', 'custos'),
('4.1.3', 'CUSTOS COM ENCARGOS SOCIAIS', 'resultado', 'custos'),
-- 4.2. DESPESAS OPERACIONAIS
('4.2', 'DESPESAS OPERACIONAIS', 'resultado', 'despesas'),
('4.2.1', 'DESPESAS ADMINISTRATIVAS', 'resultado', 'despesas'),
('4.2.2', 'DESPESAS FINANCEIRAS', 'resultado', 'despesas'),
('4.2.3', 'DESPESAS TRIBUTÁRIAS (IRPJ E CSLL)', 'resultado', 'despesas'),
-- 4.3. DESPESAS NÃO OPERACIONAIS
('4.3', 'DESPESAS NÃO OPERACIONAIS', 'resultado', 'despesas');