-- Add planet_id column to planets table
-- This stores the pr0game internal planet ID (from Empire page planet selector)
-- Used for Ajax spy requests

ALTER TABLE planets ADD COLUMN planet_id INTEGER DEFAULT NULL;
