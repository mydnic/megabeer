# Megabeer : consignes pour les agents

Ce projet est développé avec des agents (Claude Code et d'autres). Pour reprendre le travail au
même endroit :

1. `git pull`.
2. Lire [docs/REPRISE.md](docs/REPRISE.md) : où on en est, la prochaine étape, ce qu'on a appris
   avec l'utilisateur, les pièges connus.
3. Lire [CLAUDE.md](CLAUDE.md) : règles du code, architecture, commandes. Elles valent pour tous
   les agents, pas seulement Claude.
4. Quand l'utilisateur dit « reprends », reprendre à la « Prochaine étape » de `docs/REPRISE.md`.
5. À chaque étape terminée : mettre `docs/REPRISE.md` à jour, `corepack yarn test` et
   `corepack yarn build`, puis commit, `git pull` et `git push`.
