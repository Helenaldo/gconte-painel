-- Create table for PDF obligations documents
CREATE TABLE public.obligations_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/pdf',
  uploaded_by UUID NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.obligations_documents ENABLE ROW LEVEL SECURITY;

-- Create policies for obligations_documents
CREATE POLICY "Only authenticated users can view obligations_documents" 
ON public.obligations_documents 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only authenticated users can insert obligations_documents" 
ON public.obligations_documents 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = uploaded_by);

CREATE POLICY "Only authenticated users can update obligations_documents" 
ON public.obligations_documents 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only authenticated users can delete obligations_documents" 
ON public.obligations_documents 
FOR DELETE 
USING (auth.uid() IS NOT NULL);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_obligations_documents_updated_at
BEFORE UPDATE ON public.obligations_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();