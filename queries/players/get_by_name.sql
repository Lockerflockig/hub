SELECT
    p.id, p.name, p.alliance_id, p.main_coordinates, p.is_deleted,
    p.inactive_since, p.vacation_since, p.research, p.scores,
    p.combats_total, p.combats_won, p.combats_draw, p.combats_lost,
    p.units_shot, p.units_lost, p.notice, p.status, p.created_at, p.updated_at,
    a.name as alliance_name, a.tag as alliance_tag,
    p.score_buildings, p.score_buildings_rank,
    p.score_research, p.score_research_rank,
    p.score_fleet, p.score_fleet_rank,
    p.score_defense, p.score_defense_rank,
    p.score_total, p.score_total_rank,
    p.honorpoints, p.honorpoints_rank,
    p.fights_honorable, p.fights_dishonorable, p.fights_neutral,
    p.destruction_units_killed, p.destruction_units_lost,
    p.destruction_recycled_metal, p.destruction_recycled_crystal,
    p.real_destruction_units_killed, p.real_destruction_units_lost,
    p.real_destruction_recycled_metal, p.real_destruction_recycled_crystal
FROM players p
LEFT JOIN alliances a ON p.alliance_id = a.id
WHERE LOWER(p.name) = LOWER(?)
