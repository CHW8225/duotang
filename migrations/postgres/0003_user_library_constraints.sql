BEGIN;
ALTER TABLE saved_searches ADD CONSTRAINT saved_searches_name_length CHECK (char_length(name) BETWEEN 1 AND 60);
COMMIT;
