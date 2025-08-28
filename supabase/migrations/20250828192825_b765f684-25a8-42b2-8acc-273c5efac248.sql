-- Create login audit log table
CREATE TABLE IF NOT EXISTS public.login_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  action TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.login_audit_log ENABLE ROW LEVEL SECURITY;

-- Create policies for login audit log
CREATE POLICY "Only admins can view login audit logs" 
ON public.login_audit_log 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'administrador'::app_role
  )
);

CREATE POLICY "System can insert login audit logs" 
ON public.login_audit_log 
FOR INSERT 
WITH CHECK (true);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_login_audit_log_user_id ON public.login_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_login_audit_log_action ON public.login_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_login_audit_log_created_at ON public.login_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_login_audit_log_ip ON public.login_audit_log(ip_address);