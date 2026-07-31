BEGIN;

ALTER TABLE polysaccharide_records
  ADD CONSTRAINT records_deletion_reason_length CHECK (
    deletion_reason IS NULL
    OR char_length(deletion_reason) BETWEEN 1 AND 500
  );

COMMIT;
