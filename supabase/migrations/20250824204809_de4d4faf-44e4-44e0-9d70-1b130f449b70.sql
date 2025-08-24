-- Add new columns to obligations_documents for API enhancements
ALTER TABLE public.obligations_documents 
ADD COLUMN checksum TEXT,
ADD COLUMN idempotency_key TEXT;

-- Create index for checksum to optimize duplicate detection
CREATE INDEX idx_obligations_documents_checksum ON public.obligations_documents(checksum, uploaded_by);

-- Create unique index for idempotency key per user
CREATE UNIQUE INDEX idx_obligations_documents_idempotency 
ON public.obligations_documents(idempotency_key, uploaded_by) 
WHERE idempotency_key IS NOT NULL;

-- Create audit log table for tracking actions
CREATE TABLE public.obligations_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  document_id UUID,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.obligations_audit_log ENABLE ROW LEVEL SECURITY;

-- Create policies for audit log (admin only)
CREATE POLICY "Only admins can view audit logs" 
ON public.obligations_audit_log 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'administrador'
  )
);

CREATE POLICY "System can insert audit logs" 
ON public.obligations_audit_log 
FOR INSERT 
WITH CHECK (true);

-- Create storage bucket for obligations documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('obligations-documents', 'obligations-documents', false);

-- Create storage policies for obligations-documents bucket
CREATE POLICY "Admins can view obligations documents" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'obligations-documents' AND 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'administrador'
  )
);

CREATE POLICY "Admins can upload obligations documents" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'obligations-documents' AND 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'administrador'
  )
);

CREATE POLICY "Admins can update obligations documents" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'obligations-documents' AND 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'administrador'
  )
);

CREATE POLICY "Admins can delete obligations documents" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'obligations-documents' AND 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'administrador'
  )
);