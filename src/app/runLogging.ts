import { FUT, GUEUZE, WEAPONS } from '../config/weapons';
import { RARITIES } from '../config/upgrades';
import { ENEMIES } from '../config/enemies';
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
    weapons: Object.fromEntries(game.loadout.weapons.map((w) => [w.id, w.id === 'fut' ? FUT : w.id === 'gueuze' ? GUEUZE : WEAPONS[w.id]])),
    enemies: ENEMIES,
  }));
  game.events.on('landed', () => runLog.event('landed'));
  game.events.on('zombieSpawned', ({ zombie }) => runLog.spawn(zombie.enemy));
  game.events.on('zombieHit', ({ weapon, zombie, damage, hpAfter, crit, killed }) => {
    const w = weapon?.id ?? 'dev';
    runLog.hit(w, zombie.enemy, damage, hpAfter, crit);
    if (killed) runLog.kill(w, zombie.enemy);
  });
  game.events.on('playerHurt', ({ zombie, damage, hp, blocked }) => runLog.hurt(zombie?.enemy ?? 'piege', damage, hp, blocked));
  game.events.on('xpCollected', ({ amount }) => runLog.xp(amount));
  game.events.on('levelGained', ({ level }) => runLog.levelUp(level));
  game.events.on('levelUpOffered', ({ cards }) => runLog.event('cardsOffered', ...cards.map((c) => c.kind === 'weapon' ? `nouvelle:${c.weaponId}` : c.kind === 'stat' ? `stat:${c.stat}` : c.kind === 'item' ? `objet:${c.item}` : `${c.weapon.id}:${c.upgrade.id}:${RARITIES[c.tier].id}`)));
  game.events.on('pumpFilled', ({ pump, cards }) => runLog.event('pump', pump.tier, ...cards.map((c) => (c.kind === 'stat' ? c.stat : ''))));
  game.events.on('cardPicked', ({ card }) => {
    if (card.kind === 'weapon') runLog.event('cardPicked', `nouvelle:${card.weaponId}`);
    else if (card.kind === 'stat') runLog.event('statPicked', card.stat, card.value, card.tier);
    else if (card.kind === 'item') runLog.event('itemPicked', card.item, RARITIES[card.rarity].id);
    else runLog.event('cardPicked', `${card.weapon.id}:${card.upgrade.id}`, RARITIES[card.tier].id, card.weapon.mods.level);
  });
  game.events.on('chestTrapped', ({ price, hit, zombies }) => runLog.event('chestTrap', price, hit ? 1 : 0, zombies.length));
  game.events.on('bossSpawned', ({ boss }) => runLog.event('boss', boss.kind));
  game.events.on('bossPhase', ({ phase }) => runLog.event('bossPhase', phase));
  game.events.on('bossKilled', ({ boss }) => runLog.event('bossKill', boss.kind));
  game.events.on('doorOpened', () => runLog.event('door'));
  game.events.on('closingStarted', () => runLog.event('closing'));
  game.events.on('eliteSpawned', ({ zombie }) => runLog.event('elite', zombie.enemy));
  game.events.on('eliteKilled', ({ zombie, chest }) => runLog.event('eliteKill', zombie.enemy, chest ? 1 : 0));
  game.events.on('tourneeTaken', ({ id }) => runLog.event('tournee', id));
  game.events.on('lastCallRung', ({ source, pulled }) => runLog.event('lastCall', source, pulled));
  game.events.on('binBroken', ({ by, loot }) => runLog.event('bin', by, loot));
  game.events.on('snackEaten', ({ heal, hp }) => runLog.event('snack', heal, Math.round(hp)));
  game.events.on('chestOpened', ({ price, rarity, cards }) => runLog.event('chest', price, RARITIES[rarity].id, ...cards.map((c) => (c.kind === 'item' ? c.item : ''))));
  game.events.on('chestDenied', ({ price, coins }) => runLog.event('chestDenied', price, coins));
  game.events.on('bellsLanding', ({ enemy }) => runLog.event('bells', enemy));
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
