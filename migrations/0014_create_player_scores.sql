-- Player Scores table (Score-Verlauf für Charts)
CREATE TABLE player_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,

    score_total INTEGER DEFAULT 0,
    score_economy INTEGER DEFAULT 0,
    score_research INTEGER DEFAULT 0,
    score_military INTEGER DEFAULT 0,
    score_defense INTEGER DEFAULT 0,

    rank_total INTEGER,
    rank_economy INTEGER,
    rank_research INTEGER,
    rank_military INTEGER,
    rank_defense INTEGER,

    recorded_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (player_id) REFERENCES players(id)
);

CREATE INDEX idx_player_scores_player ON player_scores(player_id);
CREATE INDEX idx_player_scores_time ON player_scores(recorded_at);
