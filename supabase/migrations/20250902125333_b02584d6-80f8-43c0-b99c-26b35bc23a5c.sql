-- Add foreign key constraints to responsible_assignments table
ALTER TABLE public.responsible_assignments 
ADD CONSTRAINT fk_responsible_assignments_client_id 
FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE public.responsible_assignments 
ADD CONSTRAINT fk_responsible_assignments_collaborator_id 
FOREIGN KEY (collaborator_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.responsible_assignments 
ADD CONSTRAINT fk_responsible_assignments_created_by 
FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.responsible_assignments 
ADD CONSTRAINT fk_responsible_assignments_ended_by 
FOREIGN KEY (ended_by) REFERENCES public.profiles(id) ON DELETE SET NULL;