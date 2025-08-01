-- Fix remaining function search path issue for the CNPJ fetch function
CREATE OR REPLACE FUNCTION public.fetch_cnpj_data(cnpj_param text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
    result jsonb;
BEGIN
    -- This is a placeholder function that would need to be implemented
    -- in an edge function to actually fetch CNPJ data
    RETURN jsonb_build_object(
        'status', 'OK',
        'message', 'Function created successfully'
    );
END;
$function$