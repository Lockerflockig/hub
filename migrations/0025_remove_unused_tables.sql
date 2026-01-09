-- Remove unused tables: flights, log_players, galaxy_views
-- These tables were created but never used in the application

DROP TABLE IF EXISTS flights;
DROP TABLE IF EXISTS log_players;
DROP TABLE IF EXISTS galaxy_views;
