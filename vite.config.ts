/// <reference types="node" />
import { cloudflare } from '@cloudflare/vite-plugin';
import { defineConfig, type Plugin } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Journal de run (dev uniquement) : le jeu envoie le récit complet de chaque run en POST sur
 * /__runlog, enregistré dans logs/runs/ (hors dépôt) pour analyser l'équilibrage.
 */
function runLog(): Plugin {
  return {
    name: 'megabeer-run-log',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__runlog', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
        let body = '';
        req.on('data', (c: Buffer) => { body += c; });
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            const dir = join(process.cwd(), 'logs', 'runs');
            mkdirSync(dir, { recursive: true });
            const name = String(data.id ?? Date.now()).replace(/[^\w-]/g, '_');
            writeFileSync(join(dir, `${name}.json`), JSON.stringify(data));
            res.statusCode = 204;
          } catch (e) {
            res.statusCode = 400;
            console.error('[runlog]', e);
          }
          res.end();
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [runLog(), cloudflare()],
});
