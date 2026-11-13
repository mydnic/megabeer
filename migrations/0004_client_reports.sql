-- Rapports de diagnostic envoyés par le jeu (rendu léger : téléphones). Appareil (navigateur, puce graphique),
-- erreurs, pixels lus à l'écran pendant la run. Aucune donnée de compte. Seuls les plus récents sont gardés.

CREATE TABLE client_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  data TEXT NOT NULL
);
