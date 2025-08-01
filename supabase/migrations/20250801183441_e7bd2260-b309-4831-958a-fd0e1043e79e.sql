-- Create balancetes table
CREATE TABLE IF NOT EXISTS public.balancetes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa TEXT NOT NULL,
  cnpj TEXT NOT NULL,
  periodo TEXT NOT NULL, -- formato "MM/YYYY"
  ano INTEGER NOT NULL,
  mes INTEGER NOT NULL,
  arquivo_nome TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente, parametrizando, parametrizado
  total_contas INTEGER DEFAULT 0,
  contas_parametrizadas INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create contas_balancete table
CREATE TABLE IF NOT EXISTS public.contas_balancete (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  balancete_id UUID NOT NULL REFERENCES public.balancetes(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  saldo_atual DECIMAL(15,2) NOT NULL,
  natureza TEXT NOT NULL CHECK (natureza IN ('devedora', 'credora')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.balancetes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas_balancete ENABLE ROW LEVEL SECURITY;