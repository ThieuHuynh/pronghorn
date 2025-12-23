UPDATE tech_stacks 
SET parent_id = '545358e5-a03e-4bf8-b494-a1d66a06406a'
WHERE parent_id IS NULL 
  AND type IS NOT NULL;