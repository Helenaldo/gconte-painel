-- Create access tokens table for Bearer Token management
CREATE TABLE public.access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jti TEXT UNIQUE NOT NULL, -- JWT ID (unique identifier)
  nome TEXT NOT NULL, -- Token name/description
  token_hash TEXT NOT NULL, -- SHA-256 hash of the token (never store plain token)
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant TEXT NOT NULL, -- User's tenant identifier
  scopes TEXT[] NOT NULL DEFAULT '{}', -- Array of scopes like 'obrigacoes.read', 'obrigacoes.write'
  role TEXT NOT NULL DEFAULT 'admin', -- User role
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  revoked_at TIMESTAMP WITH TIME ZONE,
  revoked_by UUID REFERENCES auth.users(id)
);

-- Create index for performance
CREATE INDEX idx_access_tokens_jti ON public.access_tokens(jti);
CREATE INDEX idx_access_tokens_user_tenant ON public.access_tokens(user_id, tenant);
CREATE INDEX idx_access_tokens_status_expires ON public.access_tokens(status, expires_at);

-- Enable RLS
ALTER TABLE public.access_tokens ENABLE ROW LEVEL SECURITY;

-- Policies for access tokens (admin users only)
CREATE POLICY "Only admins can manage access tokens"
ON public.access_tokens
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'administrador'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'administrador'
  )
  AND user_id = auth.uid() -- Users can only create tokens for themselves
);

-- Create token audit log table
CREATE TABLE public.token_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_jti TEXT NOT NULL, -- Reference to the token
  user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL, -- 'created', 'used', 'revoked', 'rotated'
  endpoint TEXT, -- Which endpoint was accessed (for 'used' actions)
  ip_address TEXT,
  user_agent TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for audit logs
CREATE INDEX idx_token_audit_log_token_jti ON public.token_audit_log(token_jti);
CREATE INDEX idx_token_audit_log_user_action ON public.token_audit_log(user_id, action);
CREATE INDEX idx_token_audit_log_created_at ON public.token_audit_log(created_at);

-- Enable RLS on audit log
ALTER TABLE public.token_audit_log ENABLE ROW LEVEL SECURITY;

-- Policy for token audit log (admins can view, system can insert)
CREATE POLICY "Admins can view token audit logs"
ON public.token_audit_log
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'administrador'
  )
);

CREATE POLICY "System can insert audit logs"
ON public.token_audit_log
FOR INSERT
WITH CHECK (true);

-- Add trigger for updating updated_at on access_tokens
CREATE TRIGGER update_access_tokens_updated_at
BEFORE UPDATE ON public.access_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();