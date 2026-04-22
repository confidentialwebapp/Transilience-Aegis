-- Extend investigations.target_type to allow file-hash investigations.
ALTER TABLE investigations DROP CONSTRAINT IF EXISTS investigations_target_type_check;
ALTER TABLE investigations
  ADD CONSTRAINT investigations_target_type_check
  CHECK (target_type = ANY (ARRAY['url','email','ip','domain','username','phone','hash']));
