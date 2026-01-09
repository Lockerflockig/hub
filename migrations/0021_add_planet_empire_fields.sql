-- Add empire-specific fields to planets table
-- These fields store data from the Empire page

-- Fields usage (e.g., "252 / 254")
ALTER TABLE planets ADD COLUMN fields_used INTEGER DEFAULT 0;
ALTER TABLE planets ADD COLUMN fields_max INTEGER DEFAULT 0;

-- Temperature in Celsius
ALTER TABLE planets ADD COLUMN temperature INTEGER DEFAULT 0;

-- Production per resource (stored separately for quick access)
ALTER TABLE planets ADD COLUMN metal_prod_h INTEGER DEFAULT 0;
ALTER TABLE planets ADD COLUMN crystal_prod_h INTEGER DEFAULT 0;
ALTER TABLE planets ADD COLUMN deut_prod_h INTEGER DEFAULT 0;
ALTER TABLE planets ADD COLUMN energy_used INTEGER DEFAULT 0;
ALTER TABLE planets ADD COLUMN energy_max INTEGER DEFAULT 0;

-- Points from empire page
ALTER TABLE planets ADD COLUMN points INTEGER DEFAULT 0;
