SELECT
    id AS "id!",
    player_id AS "player_id!",
    score_total,
    score_economy,
    score_research,
    score_military,
    score_defense,
    rank_total,
    rank_economy,
    rank_research,
    rank_military,
    rank_defense,
    recorded_at
FROM player_scores
WHERE player_id = ?
ORDER BY recorded_at ASC;
