SELECT
    ps.id AS "id!",
    ps.player_id AS "player_id!",
    ps.score_total,
    ps.score_economy,
    ps.score_research,
    ps.score_military,
    ps.score_defense,
    ps.rank_total,
    ps.rank_economy,
    ps.rank_research,
    ps.rank_military,
    ps.rank_defense,
    ps.recorded_at
FROM player_scores ps
JOIN players pl ON ps.player_id = pl.id
WHERE pl.alliance_id = ?
ORDER BY ps.player_id, ps.recorded_at ASC;
