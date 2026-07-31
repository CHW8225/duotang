BEGIN;

-- Existing data intentionally contains repeated upload_id and DOI values because
-- one source paper can describe multiple polysaccharide records. A database
-- unique index would reject valid scientific records, so import uniqueness is an
-- operation-level contract enforced by a shared transaction advisory lock and a
-- conflict recheck immediately before insertion.
-- Baseline audit (772 records): upload_id has 217 duplicate groups / 762 rows;
-- normalized non-empty DOI has 88 duplicate groups / 311 rows.

COMMIT;
