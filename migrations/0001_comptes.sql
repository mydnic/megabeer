-- Comptes des joueurs (connexion Discord), sessions et sauvegarde de la progression.

CREATE TABLE users (
  id TEXT PRIMARY KEY,           -- identifiant Discord
  name TEXT NOT NULL,            -- pseudo affiché
  avatar TEXT,                   -- hash de l'avatar Discord (null : avatar par défaut)
  created_at INTEGER NOT NULL,
  last_login INTEGER NOT NULL
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,   -- SHA-256 du jeton du cookie (le jeton lui-même n'est jamais stocké)
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

CREATE TABLE saves (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data TEXT NOT NULL,            -- le profil (src/meta/profile.ts) en JSON
  updated_at INTEGER NOT NULL
);
