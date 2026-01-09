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
JOIN players p ON p.id = ps.player_id
WHERE p.alliance_id = ?
  AND ps.recorded_at >= datetime('now', '-56 days')
ORDER BY ps.recorded_at DESC, ps.player_id;
