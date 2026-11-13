-- Leaderboard : la meilleure run de chaque joueur (le plus de zombies tués en une run).

CREATE TABLE scores (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  kills INTEGER NOT NULL,        -- zombies tués pendant la run (le classement)
  survived REAL NOT NULL,        -- temps tenu (s), départage à kills égaux
  difficulty TEXT NOT NULL,
  character TEXT NOT NULL,
  at INTEGER NOT NULL            -- date de la run (ms)
);
CREATE INDEX scores_rank ON scores(kills DESC, survived DESC);
