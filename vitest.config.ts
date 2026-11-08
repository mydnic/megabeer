import { defineConfig } from 'vitest/config';

/**
 * Tests fonctionnels (tests/) : ils pilotent le noyau du jeu (src/game) comme un joueur, sans
 * navigateur ni carte graphique. Config séparée de vite.config.ts (pas de plugin Cloudflare ici).
 */
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
