import { WEAPONS } from '../config/weapons';
import { RARITIES } from '../config/upgrades';
import { ZOMBIE_ATTACK, ZOMBIE_STATS } from '../config/zombies';
import type { createRunLog } from '../dev/runLog';
import type { Game } from '../game/game';

/**
 * Journal de run (dev) : tout ce que le noyau annonce est noté pour analyser l'équilibrage (coups,
 * morts, XP, cartes, PV, instantané chaque seconde). `meta()` donne ce que le noyau ne connaît pas
 * (seed de la planète, fps).
 */
export function wireRunLog(game: Game, runLog: ReturnType<typeof createRunLog>, meta: () => { seed: number; fps: number }) {
  game.events.on('runStarted', () => runLog.start({
    character: 'buveur', map: 'abbaye', seed: meta().seed, difficulty: game.difficulty,
    stats: { ...game.stats, maxHp: game.health.max },
    weapons: Object.fromEntries(game.loadout.weapons.map((w) => [w.id, WEAPONS[w.id]])),
    zombie: ZOMBIE_STATS,
  }));
  game.events.on('landed', () => runLog.event('landed'));
  game.events.on('zombieSpawned', ({ zombie }) => runLog.spawn(zombie.model));
  game.events.on('zombieHit', ({ weapon, zombie, damage, hpAfter, crit, killed }) => {
    const w = weapon?.id ?? 'dev';
    runLog.hit(w, zombie.model, damage, hpAfter, crit);
    if (killed) runLog.kill(w, zombie.model);
  });
  game.events.on('playerHurt', ({ zombie, hp, blocked }) => runLog.hurt(zombie.model, ZOMBIE_ATTACK.damage, hp, blocked));
  game.events.on('xpCollected', ({ amount }) => runLog.xp(amount));
  game.events.on('levelGained', ({ level }) => runLog.levelUp(level));
  game.events.on('levelUpOffered', ({ cards }) => runLog.event('cardsOffered', ...cards.map((c) => `${c.weapon.id}:${c.upgrade.id}:${RARITIES[c.tier].id}`)));
  game.events.on('cardPicked', ({ card }) => runLog.event('cardPicked', `${card.weapon.id}:${card.upgrade.id}`, RARITIES[card.tier].id, card.weapon.mods.level));
  game.events.on('bellsLanding', ({ model }) => runLog.event('bells', model));
  game.events.on('bellsSurgeEnded', ({ count }) => runLog.event('bellsEnd', count));
  game.events.on('runEnded', ({ reason, survived, kills }) => runLog.end(reason, { survived, kills }));
  game.events.on('tick', ({ dt }) => runLog.tick(dt, () => {
    let alive = 0, near5 = 0, near10 = 0;
    for (const z of game.horde.zombies) {
      if (z.dead) continue;
      alive++;
      const d = z.pos.distanceTo(game.player.pos);
      if (d < 5) near5++;
      if (d < 10) near10++;
    }
    const s = game.stats;
    return { hp: game.health.hp, level: game.progression.level, xp: Math.round(game.progression.xp), alive, near5, near10, kills: game.kills, spawnRate: +game.director.rate.toFixed(2), fps: Math.round(meta().fps), atkSpd: s.attackSpeed, proj: s.extraProjectiles };
  }));
}
