-- Add partial index for system markers (planet=0) to speed up galaxy status queries
CREATE INDEX IF NOT EXISTS idx_planets_system_markers ON planets(galaxy, system, updated_at) WHERE planet = 0;
