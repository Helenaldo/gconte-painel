-- Create clients table
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cnpj TEXT NOT NULL UNIQUE,
  nome_empresarial TEXT NOT NULL,
  nome_fantasia TEXT,
  ramo_atividade TEXT NOT NULL,
  cep TEXT,
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  municipio TEXT,
  uf TEXT,
  cliente_desde DATE NOT NULL DEFAULT CURRENT_DATE,
  fim_contrato DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create contacts table
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create events table
CREATE TABLE IF NOT EXISTS public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  data DATE NOT NULL,
  setor TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create taxation table
CREATE TABLE IF NOT EXISTS public.taxation (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  descricao TEXT,
  data DATE NOT NULL,
  valor DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create office table
CREATE TABLE IF NOT EXISTS public.office (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cnpj TEXT NOT NULL,
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cep TEXT,
  municipio TEXT,
  uf TEXT,
  telefone TEXT,
  instagram TEXT,
  logomarca_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office ENABLE ROW LEVEL SECURITY;

-- Create policies (allowing all operations for now)
CREATE POLICY "Allow all operations on clients" ON public.clients FOR ALL USING (true);
CREATE POLICY "Allow all operations on contacts" ON public.contacts FOR ALL USING (true);
CREATE POLICY "Allow all operations on events" ON public.events FOR ALL USING (true);
CREATE POLICY "Allow all operations on taxation" ON public.taxation FOR ALL USING (true);
CREATE POLICY "Allow all operations on office" ON public.office FOR ALL USING (true);

-- Create update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_taxation_updated_at BEFORE UPDATE ON public.taxation FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_office_updated_at BEFORE UPDATE ON public.office FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();