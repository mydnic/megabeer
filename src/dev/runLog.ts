/**
 * Journal de run (dev uniquement, GDD section 20) : tout ce qui se passe pendant une run est noté,
 * puis envoyé au serveur de dev à la fin (logs/runs/<id>.json) pour analyser l'équilibrage.
 *
 * Format compact : `events` est une liste de [t, type, ...données] (t = temps de jeu en s, 2
 * décimales) ; `snapshots` est un état complet chaque seconde ; `summary` des totaux prêts à lire.
 */

type Snapshot = Record<string, number | string>;

export function createRunLog() {
  const enabled = import.meta.env.DEV;
  let id = '';
  let started = 0;
  let t = 0;
  let meta: Record<string, unknown> = {};
  let events: (string | number)[][] = [];
  let snapshots: Snapshot[] = [];
  let nextSnap = 0;
  let open = false;
  // Totaux
  const sum = {
    dmgDealt: {} as Record<string, number>, hits: {} as Record<string, number>, overkill: {} as Record<string, number>,
    kills: {} as Record<string, number>, killsByWeapon: {} as Record<string, number>,
    dmgTaken: 0, hitsTaken: 0, hitsBlocked: 0, spawns: {} as Record<string, number>,
    xp: 0, levels: [] as { t: number; level: number }[],
  };
  const add = (o: Record<string, number>, k: string, v: number) => { o[k] = (o[k] ?? 0) + v; };
  const r2 = (x: number) => Math.round(x * 100) / 100;

  function send() {
    if (!enabled || !open) return;
    open = false;
    const durationReal = (performance.now() - started) / 1000;
    const body = JSON.stringify({
      id, meta: { ...meta, durationGame: r2(t), durationReal: r2(durationReal) },
      summary: {
        ...sum,
        dps: Object.fromEntries(Object.entries(sum.dmgDealt).map(([k, v]) => [k, r2(v / Math.max(1, t))])),
        killsTotal: Object.values(sum.kills).reduce((a, b) => a + b, 0),
        killsPerMin: r2(Object.values(sum.kills).reduce((a, b) => a + b, 0) / Math.max(1 / 60, t / 60)),
      },
      snapshots, events,
    });
    // sendBeacon survit à la fermeture de l'onglet
    if (!navigator.sendBeacon?.('/__runlog', new Blob([body], { type: 'application/json' }))) {
      void fetch('/__runlog', { method: 'POST', body, keepalive: true }).catch(() => {});
    }
  }
  if (enabled) addEventListener('pagehide', () => { if (open) { meta.end = 'page fermée'; send(); } });

  return {
    /** Début de run. */
    start(m: Record<string, unknown>) {
      if (!enabled) return;
      if (open) { meta.end = 'interrompue'; send(); }
      const d = new Date();
      const p = (n: number) => String(n).padStart(2, '0');
      id = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
      started = performance.now();
      t = 0; nextSnap = 0; meta = { ...m, version: 1, start: d.toISOString() };
      events = []; snapshots = [];
      for (const k of Object.keys(sum)) {
        const v = (sum as Record<string, unknown>)[k];
        if (Array.isArray(v)) v.length = 0;
        else if (typeof v === 'object') for (const kk of Object.keys(v as object)) delete (v as Record<string, number>)[kk];
        else (sum as Record<string, unknown>)[k] = 0;
      }
      open = true;
    },
    /** Avance le temps de jeu ; prend un instantané chaque seconde. */
    tick(dt: number, snapshot: () => Snapshot) {
      if (!open) return;
      t += dt;
      if (t >= nextSnap) { snapshots.push({ t: r2(t), ...snapshot() }); nextSnap += 1; }
    },
    event(type: string, ...data: (string | number)[]) { if (open) events.push([r2(t), type, ...data]); },

    spawn(model: string) { if (!open) return; add(sum.spawns, model, 1); this.event('spawn', model); },
    /** Coup donné : arme, cible, dégâts, PV restants (négatif = dégâts perdus). */
    hit(weapon: string, target: string, dmg: number, hpAfter: number) {
      if (!open) return;
      add(sum.dmgDealt, weapon, dmg + Math.min(0, hpAfter));
      add(sum.overkill, weapon, -Math.min(0, hpAfter));
      add(sum.hits, weapon, 1);
      this.event('hit', weapon, target, dmg, r2(hpAfter));
    },
    kill(weapon: string, target: string) {
      if (!open) return;
      add(sum.kills, target, 1); add(sum.killsByWeapon, weapon, 1);
      this.event('kill', weapon, target);
    },
    /** Coup reçu (bloqué = ignoré par l'invulnérabilité). */
    hurt(source: string, dmg: number, hpAfter: number, blocked: boolean) {
      if (!open) return;
      if (blocked) { sum.hitsBlocked++; this.event('hurtBlocked', source); return; }
      sum.dmgTaken += dmg; sum.hitsTaken++;
      this.event('hurt', source, dmg, r2(hpAfter));
    },
    xp(amount: number) { if (!open) return; sum.xp += amount; this.event('xp', amount); },
    levelUp(level: number) { if (!open) return; sum.levels.push({ t: r2(t), level }); this.event('level', level); },
    /** Fin de run : envoie le journal. */
    end(reason: string, extra: Record<string, unknown> = {}) {
      if (!open) return;
      meta = { ...meta, ...extra, end: reason };
      send();
    },
  };
}
export type RunLog = ReturnType<typeof createRunLog>;
