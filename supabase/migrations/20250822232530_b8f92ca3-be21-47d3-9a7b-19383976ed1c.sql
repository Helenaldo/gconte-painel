-- Add foreign key constraint between certificados_digitais and clients
ALTER TABLE public.certificados_digitais 
ADD Constraint certificados_digitais_client_id_fkey 
FOREIGN KEY (client_id) REFERENCES public.clients(id);