import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ITEMS, ITEM_EFFECTS, type ItemDef, type ItemId, type ItemStatId } from '../../src/config/items';
import { ENEMIES } from '../../src/config/enemies';
import { CHESTS } from '../../src/config/chests';
import { PLANET_RADIUS } from '../../src/config/world';
import { RARITIES } from '../../src/config/upgrades';
import { NO_INPUT } from '../../src/game/game';
import { itemCardText } from '../../src/game/levelUpCards';
import { heightAt } from '../../src/world/terrain';
import { createTestGame, FPS } from '../support/testGame';

/** Arène calme ; le joueur ne tire pas ; `random` : hasard des objets (0 : tout se déclenche). */
function arena(random = () => 0) {
  const t = createTestGame(1, { random });
  t.startRunAndLand();
  t.noSpawns();
  t.game.loadout.weapons[0].mods.range = 0;
  t.game.stats.random = random;
  return t;
}
type T = ReturnType<typeof arena>;
const weapon = (t: T) => t.game.loadout.weapons[0];
const facing = (t: T) => t.game.player.facing.clone();
/** Coup d'arme de `dmg` sur un zombie (comme un projectile qui le touche). */
const shoot = (t: T, z: { pos: THREE.Vector3 }, dmg: number) => t.game.hitZombie(z as never, dmg, false, z.pos, facing(t), weapon(t));
const stat = (t: T, k: ItemStatId) => (k === 'maxHp' ? t.game.health.max : (t.game.stats as unknown as Record<string, number>)[k]);
/** Hauteur du joueur au-dessus du sol (m). */
const height = (t: T) => t.game.player.pos.length() - PLANET_RADIUS - heightAt(t.game.player.pos.clone().normalize());

describe('Tous les objets', () => {
  it('chaque carte d objet a un texte complet, à chaque rareté où il sort', () => {
    for (const id of Object.keys(ITEMS) as ItemId[]) {
      const def: ItemDef = ITEMS[id];
      for (let r = def.minRarity ?? 0; r < RARITIES.length; r++) {
        const text = itemCardText({ kind: 'item', item: id, rarity: r, mult: def.fixed ? 1 : RARITIES[r].mult });
        expect(text, id).not.toMatch(/[{}]|NaN|undefined|Infinity/);
      }
    }
  });

  it('les objets à stats montent leurs stats de leur valeur (x la rareté)', () => {
    const t = arena();
    for (const id of Object.keys(ITEMS) as ItemId[]) {
      const def: ItemDef = ITEMS[id];
      if (!def.stats) continue;
      const r = def.minRarity ?? 1;
      const mult = def.fixed ? 1 : RARITIES[r].mult;
      const before = Object.fromEntries(Object.keys(def.stats).map((k) => [k, stat(t, k as ItemStatId)]));
      t.game.gainItem(id, r);
      for (const [k, v] of Object.entries(def.stats)) expect(stat(t, k as ItemStatId), `${id}.${k}`).toBeCloseTo(before[k] + v * mult, 5);
    }
  });

  it('Glaçons : un ennemi touché gèle, il ne bouge plus le temps du gel', () => {
    const t = arena();
    t.game.gainItem('glacons', 0);
    const z = t.game.spawnZombie('zombie', t.inFront(8), facing(t).negate())!;
    t.play(0.5);
    shoot(t, z, 1);
    expect(t.events('zombieFrozen')).toHaveLength(1);
    // Gelé : il ne marche plus (seul le recul du coup le fait glisser), puis repart
    let walked = 0;
    for (let i = 0; i < ITEM_EFFECTS.freezeChance.time * 0.9 * 60; i++) { t.play(1 / 60); walked += z.walkSpeed; }
    expect(walked).toBe(0);
    t.play(1);
    expect(z.walkSpeed).toBeGreaterThan(0);
  });

  it('Seau à glace : les ennemis touchés ralentissent ; la stat Durée (Kebab) allonge le ralenti', () => {
    const t = arena();
    t.game.gainItem('seauAGlace', 0);
    t.game.gainItem('kebab', 0);
    const z = t.game.spawnZombie('zombie', t.inFront(8), facing(t).negate())!;
    shoot(t, z, 1);
    expect(z.slowMul).toBeCloseTo(1 - ITEMS.seauAGlace.value, 5);
    expect(z.slowTime).toBeCloseTo(ITEM_EFFECTS.slowOnHit.time * (1 + ITEMS.kebab.stats.duration), 5);
  });

  it('Gants de videur, Lunettes, Last order : plus de dégâts aux bonnes cibles', () => {
    const t = arena();
    t.game.gainItem('gantsVideur', 0);
    const near = t.game.spawnZombie('tonnelier', t.inFront(2), facing(t).negate())!;
    const far = t.game.spawnZombie('tonnelier', t.inFront(10), facing(t).negate())!;
    const h0 = near.hp;
    shoot(t, near, 2); shoot(t, far, 2);
    expect(h0 - near.hp).toBeCloseTo((h0 - far.hp) * (1 + ITEMS.gantsVideur.value), 5);

    const u = arena();
    u.game.gainItem('lunettes', 0);
    const big = u.game.spawnZombie('tonnelier', u.inFront(10), facing(u).negate())!;
    const small = u.game.spawnZombie('zombie', u.inFront(10, 3), facing(u).negate())!;
    const b0 = big.hp, s0 = small.hp;
    shoot(u, big, 2); shoot(u, small, 2);
    expect(ENEMIES.tonnelier.hp).toBeGreaterThanOrEqual(ITEM_EFFECTS.eliteDamage.minHp);
    expect(b0 - big.hp).toBeCloseTo((s0 - small.hp) * (1 + ITEMS.lunettes.value), 5);

    const v = arena();
    v.game.gainItem('lastOrder', 0);
    const z = v.game.spawnZombie('tonnelier', v.inFront(10), facing(v).negate())!;
    const z0 = z.hp;
    shoot(v, z, 2);
    const full = z0 - z.hp;
    v.game.health.hp = v.game.health.max * ITEM_EFFECTS.lowHpDamage.below * 0.5;
    const z1 = z.hp;
    shoot(v, z, 2);
    expect(z1 - z.hp).toBeCloseTo(full * (1 + ITEMS.lastOrder.value), 5);
  });

  it('Paille : une part des dégâts infligés revient en PV', () => {
    const t = arena();
    t.game.gainItem('paille', 0);
    t.game.health.hp = 50;
    const z = t.game.spawnZombie('tonnelier', t.inFront(10), facing(t).negate())!;
    const before = z.hp;
    shoot(t, z, 10);
    expect(t.game.health.hp).toBeCloseTo(50 + (before - z.hp) * ITEMS.paille.stats.lifeSteal, 5);
  });

  it('Démarche de pochtron : un coup esquivé ne fait rien', () => {
    const t = arena();
    t.game.cheats.god = false;
    t.game.gainItem('demarche', 0);
    const hp = t.game.health.hp;
    t.game.spawnZombie('novice', t.inFront(1.2), facing(t).negate());
    expect(t.playUntil(() => t.events('playerDodged').length > 0, 5)).toBe(true);
    expect(t.game.health.hp).toBe(hp);
  });

  it('Gueule de bois : l armure retire des PV à chaque coup reçu', () => {
    const t = arena(() => 0.99);
    t.game.cheats.god = false;
    t.game.gainItem('gueuleDeBois', 0);
    t.game.spawnZombie('novice', t.inFront(1.2), facing(t).negate());
    expect(t.playUntil(() => t.events('playerHurt').some((h) => !h.blocked), 5)).toBe(true);
    const hit = t.events('playerHurt').find((h) => !h.blocked)!;
    expect(hit.damage).toBeCloseTo(ENEMIES.novice.damage * t.game.mods.damage - ITEMS.gueuleDeBois.stats.armor, 5);
  });

  it('Ardoise du bar : le coup reçu tombe en quelques secondes, pas d un coup', () => {
    const t = arena(() => 0.99);
    t.game.cheats.god = false;
    t.game.gainItem('ardoise', 0);
    const hp = t.game.health.hp;
    const z = t.game.spawnZombie('novice', t.inFront(1.2), facing(t).negate())!;
    expect(t.playUntil(() => t.events('playerHurt').length > 0, 5)).toBe(true);
    z.hp = -1; t.clearZombies();
    const dmg = t.events('playerHurt')[0].damage;
    expect(t.game.health.hp).toBeGreaterThan(hp - dmg * 0.2);
    t.play(ITEMS.ardoise.value + 0.2);
    expect(t.game.health.hp).toBeCloseTo(hp - dmg, 3);
  });

  it('Bière sans alcool et Casquette : les PV remontent (la Casquette seulement sans bouger)', () => {
    const t = arena();
    t.game.gainItem('sansAlcool', 0);
    t.game.health.hp = 50;
    t.play(2);
    expect(t.game.health.hp).toBeCloseTo(50 + 2 * ITEMS.sansAlcool.stats.regen, 1);

    const u = arena();
    u.game.gainItem('casquette', 0);
    u.game.health.hp = 50;
    u.play(1);
    expect(u.game.health.hp).toBeCloseTo(50 + ITEMS.casquette.value, 1);
    u.play(1, { moveY: 1 });
    expect(u.game.health.hp).toBeLessThan(50 + 1.5 * ITEMS.casquette.value);
  });

  it("Sifflet d'arbitre : toutes les 15 s, les ennemis proches sont étourdis", () => {
    const t = arena();
    t.game.gainItem('sifflet', 0);
    const near = t.game.spawnZombie('zombie', t.inFront(4), facing(t).negate())!;
    t.play(ITEM_EFFECTS.whistle.every + 0.1);
    expect(t.events('whistleBlown')).toHaveLength(1);
    expect(t.events('zombieFrozen').some((f) => f.zombie === near)).toBe(true);
  });

  it('Juke-box : un niveau gagné repousse les ennemis proches', () => {
    const t = arena();
    t.game.gainItem('jukeBox', 0);
    const z = t.game.spawnZombie('zombie', t.inFront(3), facing(t).negate())!;
    t.game.addXp(t.game.progression.next);
    expect(t.events('shockwave')).toHaveLength(1);
    expect(z.knockVel.dot(facing(t))).toBeGreaterThan(0);
  });

  it('Seconde tournée : à la mort, le joueur revient une fois, puis meurt pour de bon', () => {
    const t = arena();
    t.game.gainItem('secondeTournee', 4);
    t.game.health.invuln = 0;
    t.game.health.damage(9999);
    t.play(0.1);
    expect(t.game.phase).toBe('run');
    expect(t.game.health.hp).toBeCloseTo(t.game.health.max * ITEMS.secondeTournee.value, 5);
    expect(t.events('revived')).toHaveLength(1);
    t.game.health.invuln = 0;
    t.game.health.damage(9999);
    t.play(0.1);
    expect(t.game.phase).toBe('dead');
  });

  it('Bonnet du Père Noël : un coffre gratuit apparaît près du joueur, il s ouvre sans capsule', () => {
    const t = arena();
    t.game.gainItem('bonnet', 0);
    t.game.coins = 0;
    t.play(ITEM_EFFECTS.freeChest.every + 0.1);
    const spawned = t.events('freeChestSpawned');
    expect(spawned).toHaveLength(1);
    const chest = spawned[0].chest;
    expect(chest.pos.distanceTo(t.game.player.pos)).toBeLessThan(ITEM_EFFECTS.freeChest.dist + 2);
    expect(t.game.chests.priceOf(chest)).toBe(0);
  });

  it('Carte de fidélité et Bon de réduction : les coffres coûtent moins, ou rien', () => {
    const t = arena(() => 0.99);
    t.game.gainItem('carteFidelite', 4);
    expect(t.game.chests.price).toBe(Math.round(CHESTS.basePrice * (1 - ITEMS.carteFidelite.stats.chestDiscount * RARITIES[4].mult)));

    const u = arena();
    u.game.gainItem('bonReduction', 0);
    u.game.coins = 0;
    const chest = u.game.chests.list[0];
    const up = chest.pos.clone().normalize();
    const side = new THREE.Vector3(1, 0, 0).cross(up).normalize();
    u.game.player.reset(chest.pos.clone().addScaledVector(side, 1.8).normalize(), side.clone().negate());
    u.play(0.1);
    u.game.step(1 / FPS, { ...NO_INPUT, action: true, actionPressed: true });
    expect(u.events('chestRevealing')).toHaveLength(1);
    expect(u.game.coins).toBe(0);
  });

  it('Ressort de canapé : un second saut en l air ; Tongs : le saut est moins haut', () => {
    const jump = (t: T, twice: boolean) => {
      t.game.step(1 / FPS, { ...NO_INPUT, jump: true, jumpPressed: true });
      let top = 0;
      for (let i = 0; i < 3 * FPS; i++) {
        const press = twice && i === Math.round(0.3 * FPS);
        t.game.step(1 / FPS, { ...NO_INPUT, jump: press, jumpPressed: press });
        top = Math.max(top, height(t));
      }
      return top;
    };
    const plain = jump(arena(), false);
    const spring = arena();
    spring.game.gainItem('ressort', 2);
    expect(jump(spring, true)).toBeGreaterThan(plain * 1.3);
    const noSpring = jump(arena(), true);
    expect(noSpring).toBeCloseTo(plain, 1);
    const tongs = arena();
    tongs.game.gainItem('tongs', 0);
    expect(jump(tongs, false)).toBeLessThan(plain * 0.9);
  });

  it('Porte-monnaie : plus de capsules ramassées', () => {
    const t = createTestGame(1, { coins: 'always' });
    t.startRunAndLand();
    t.noSpawns();
    t.game.gainItem('porteMonnaie', 4);
    for (let i = 0; i < 10; i++) t.game.coinDrops.drop(t.inFront(1, (i - 5) * 0.1), 1);
    t.playUntil(() => t.game.coinDrops.drops.length === 0, 5);
    expect(t.game.coins).toBe(Math.floor(10 * (1 + ITEMS.porteMonnaie.stats.coinGain * RARITIES[4].mult) + 1e-9));
  });

  it('Tabouret réservé : les pompes se remplissent plus vite', () => {
    const t = arena();
    t.game.gainItem('tabouret', 0);
    const pump = t.game.pumps.list[0];
    t.game.pumps.update(1, pump.pos, t.game.stats.pumpSpeed);
    expect(pump.fill).toBeGreaterThan(1 / 6 * (1 + ITEMS.tabouret.stats.pumpSpeed) - 1e-6);
  });

  it('Cochonnet : parfois un projectile de plus dans la volée', () => {
    const t = arena();
    t.game.gainItem('cochonnet', 0);
    t.play(0.1);
    expect(t.game.stats.volleyBonus()).toBe(t.game.stats.extraProjectiles + 1);
    t.game.stats.random = () => 0.99;
    expect(t.game.stats.volleyBonus()).toBe(t.game.stats.extraProjectiles);
  });

  it('Écharpe de supporter : entouré de beaucoup d ennemis, le joueur court plus vite', () => {
    const t = arena();
    t.game.gainItem('echarpe', 0);
    t.play(0.1);
    const speed = t.game.player.speed;
    for (let i = 0; i < ITEM_EFFECTS.crowdBoost.count; i++) {
      const a = (i / ITEM_EFFECTS.crowdBoost.count) * Math.PI * 2;
      t.game.spawnZombie('zombie', t.inFront(4 * Math.cos(a), 4 * Math.sin(a)), facing(t));
    }
    t.play(0.1);
    expect(t.game.effects.crowded).toBe(true);
    expect(t.game.player.speed).toBeCloseTo(speed * (1 + ITEMS.echarpe.value), 5);
  });

  it('Pinte XXL : les explosions du Cendrier sont plus grandes', () => {
    const t = arena();
    t.game.gainItem('cendrier', 0);
    t.game.gainItem('pinteXXL', 0);
    const z = t.game.spawnZombie('zombie', t.inFront(6), facing(t))!;
    shoot(t, z, 9999);
    expect(t.events('itemExploded')[0].radius).toBeCloseTo(ITEM_EFFECTS.explodeOnKill.radius * (1 + ITEMS.pinteXXL.stats.size), 5);
  });
});
