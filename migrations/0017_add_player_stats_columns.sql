-- Add detailed player stats columns

-- Scores with ranks (replacing JSON scores column)
ALTER TABLE players ADD COLUMN score_buildings INTEGER;
ALTER TABLE players ADD COLUMN score_buildings_rank INTEGER;
ALTER TABLE players ADD COLUMN score_research INTEGER;
ALTER TABLE players ADD COLUMN score_research_rank INTEGER;
ALTER TABLE players ADD COLUMN score_fleet INTEGER;
ALTER TABLE players ADD COLUMN score_fleet_rank INTEGER;
ALTER TABLE players ADD COLUMN score_defense INTEGER;
ALTER TABLE players ADD COLUMN score_defense_rank INTEGER;
ALTER TABLE players ADD COLUMN score_total INTEGER;
ALTER TABLE players ADD COLUMN score_total_rank INTEGER;

-- Honorpoints
ALTER TABLE players ADD COLUMN honorpoints INTEGER;
ALTER TABLE players ADD COLUMN honorpoints_rank INTEGER;

-- Honorfights
ALTER TABLE players ADD COLUMN fights_honorable INTEGER;
ALTER TABLE players ADD COLUMN fights_dishonorable INTEGER;
ALTER TABLE players ADD COLUMN fights_neutral INTEGER;

-- Destruction stats (involved in)
ALTER TABLE players ADD COLUMN destruction_units_killed INTEGER;
ALTER TABLE players ADD COLUMN destruction_units_lost INTEGER;
ALTER TABLE players ADD COLUMN destruction_recycled_metal INTEGER;
ALTER TABLE players ADD COLUMN destruction_recycled_crystal INTEGER;

-- Destruction stats (actually destroyed by player)
ALTER TABLE players ADD COLUMN real_destruction_units_killed INTEGER;
ALTER TABLE players ADD COLUMN real_destruction_units_lost INTEGER;
ALTER TABLE players ADD COLUMN real_destruction_recycled_metal INTEGER;
ALTER TABLE players ADD COLUMN real_destruction_recycled_crystal INTEGER;
