-- Criar tabela para o plano padrão de contas
CREATE TABLE public.plano_contas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL, -- ativo, passivo, resultado
  grupo TEXT NOT NULL, -- ativo_circulante, ativo_nao_circulante, etc
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela para parametrizações (vinculo entre plano padrão e contas do balancete)
CREATE TABLE public.parametrizacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_cnpj TEXT NOT NULL,
  plano_conta_id UUID NOT NULL REFERENCES public.plano_contas(id) ON DELETE CASCADE,
  conta_balancete_codigo TEXT NOT NULL,
  conta_balancete_nome TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(empresa_cnpj, plano_conta_id, conta_balancete_codigo)
);

-- Inserir contas do plano padrão básico
INSERT INTO public.plano_contas (codigo, nome, tipo, grupo) VALUES
-- ATIVO
('1.1.01', 'Caixa', 'ativo', 'ativo_circulante'),
('1.1.02', 'Bancos', 'ativo', 'ativo_circulante'),
('1.1.03', 'Aplicações Financeiras', 'ativo', 'ativo_circulante'),
('1.1.04', 'Duplicatas a Receber', 'ativo', 'ativo_circulante'),
('1.1.05', 'Estoque', 'ativo', 'ativo_circulante'),
('1.1.06', 'Despesas Antecipadas', 'ativo', 'ativo_circulante'),
('1.2.01', 'Imobilizado', 'ativo', 'ativo_nao_circulante'),
('1.2.02', 'Intangível', 'ativo', 'ativo_nao_circulante'),
-- PASSIVO
('2.1.01', 'Fornecedores', 'passivo', 'passivo_circulante'),
('2.1.02', 'Contas a Pagar', 'passivo', 'passivo_circulante'),
('2.1.03', 'Salários a Pagar', 'passivo', 'passivo_circulante'),
('2.1.04', 'Impostos a Recolher', 'passivo', 'passivo_circulante'),
('2.1.05', 'Empréstimos Bancários', 'passivo', 'passivo_circulante'),
('2.2.01', 'Financiamentos LP', 'passivo', 'passivo_nao_circulante'),
-- PATRIMÔNIO LÍQUIDO
('3.1.01', 'Capital Social', 'patrimonio', 'patrimonio_liquido'),
('3.1.02', 'Reservas', 'patrimonio', 'patrimonio_liquido'),
('3.1.03', 'Lucros Acumulados', 'patrimonio', 'patrimonio_liquido'),
-- RECEITAS
('4.1.01', 'Receita de Vendas', 'resultado', 'receitas'),
('4.1.02', 'Receita de Serviços', 'resultado', 'receitas'),
('4.1.03', 'Receitas Financeiras', 'resultado', 'receitas'),
-- DESPESAS
('5.1.01', 'Custo das Mercadorias Vendidas', 'resultado', 'custos'),
('5.1.02', 'Despesas Administrativas', 'resultado', 'despesas'),
('5.1.03', 'Despesas Comerciais', 'resultado', 'despesas'),
('5.1.04', 'Despesas Financeiras', 'resultado', 'despesas');

-- Habilitar RLS
ALTER TABLE public.plano_contas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parametrizacoes ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS
CREATE POLICY "Allow all operations on plano_contas" 
ON public.plano_contas 
FOR ALL 
USING (true);

CREATE POLICY "Allow all operations on parametrizacoes" 
ON public.parametrizacoes 
FOR ALL 
USING (true);

-- Criar trigger para updated_at
CREATE TRIGGER update_plano_contas_updated_at
BEFORE UPDATE ON public.plano_contas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_parametrizacoes_updated_at
BEFORE UPDATE ON public.parametrizacoes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();