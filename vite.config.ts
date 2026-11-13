/// <reference types="node" />
import { cloudflare } from '@cloudflare/vite-plugin';
import { defineConfig, type Plugin } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

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

/**
 * Version affichée sur l'accueil : numéro de build (nombre de commits), début du hash du commit et heure du build.
 * Le dépôt peut être cloné sans tout l'historique (Workers Builds) : le numéro manque alors, le hash reste.
 */
function buildInfo() {
  const git = (cmd: string) => { try { return execSync(`git ${cmd}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; } };
  const shallow = git('rev-parse --is-shallow-repository') === 'true';
  const count = shallow ? '' : git('rev-list --count HEAD');
  const hash = (process.env.WORKERS_CI_COMMIT_SHA ?? git('rev-parse HEAD')).slice(0, 7);
  const at = new Date().toLocaleString('fr-BE', { timeZone: 'Europe/Brussels', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  return [count && `build ${count}`, hash, at].filter(Boolean).join(' · ');
}

export default defineConfig({
  define: { __BUILD__: JSON.stringify(buildInfo()) },
  plugins: [runLog(), cloudflare()],
  // .wrangler : D1 locale et mails simulés ; leur écriture ne doit pas recharger la page
  server: { watch: { ignored: ['**/.wrangler/**', '**/logs/**'] } },
});
