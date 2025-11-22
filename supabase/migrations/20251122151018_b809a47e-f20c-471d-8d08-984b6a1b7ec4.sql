-- Fix share token leakage across requests by making the GUC local to each transaction
CREATE OR REPLACE FUNCTION public.set_share_token(token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Use a LOCAL setting so the token only applies within the current transaction
  PERFORM set_config('app.share_token', token, true);
END;
$function$;