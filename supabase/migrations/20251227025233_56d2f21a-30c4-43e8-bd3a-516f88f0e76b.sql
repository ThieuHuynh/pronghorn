-- Drop the old uuid-based overload that conflicts with the new text-based one
DROP FUNCTION IF EXISTS public.get_audit_tesseract_cells_with_token(
  uuid, uuid, uuid, integer, integer, double precision, double precision, integer
);