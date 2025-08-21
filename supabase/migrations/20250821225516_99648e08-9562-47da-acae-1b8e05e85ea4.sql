-- Add foreign key constraint between certificados_digitais and clients
ALTER TABLE public.certificados_digitais 
ADD CONSTRAINT fk_certificados_digitais_client_id 
FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;