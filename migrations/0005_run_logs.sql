-- Journaux de parties envoyés par le jeu en prod, pour l'équilibrage (lus avec tools/runs/prod.mjs). Le joueur
-- connecté est noté (user_id), sinon null. Seuls les plus récents sont gardés.

CREATE TABLE run_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  user_id TEXT,
  build TEXT,
  duration REAL,
  kills INTEGER,
  end_reason TEXT,
  data TEXT NOT NULL
);
CREATE INDEX run_logs_at ON run_logs(at);
