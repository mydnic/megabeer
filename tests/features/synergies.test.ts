import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BIERE_NOEL, ODEUR, PLATEAU, ROT, SYNERGY_FX } from '../../src/config/arsenal';
import { SYNERGIES } from '../../src/config/weapons';
import type { Zombie } from '../../src/enemies/zombie';
import type { WeaponId } from '../../src/weapons/weapon';
import { createTestGame } from '../support/testGame';

const queue: number[] = [];
beforeEach(() => {
  let s = 11;
  vi.spyOn(Math, 'random').mockImplementation(() => queue.length ? queue.shift()! : ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32));
});
afterEach(() => { vi.restoreAllMocks(); queue.length = 0; });

/** Une run au sol sans zombies, la Canette désarmée, avec les armes `ids`. */
function arena(...ids: WeaponId[]) {
  const t = createTestGame();
  t.startRunAndLand();
  t.noSpawns();
  t.game.loadout.weapons[0].mods.range = 0;
  // Équipées comme par une carte : les synergies s'annoncent
  for (const id of ids) t.game.equip(id);
  const ws = ids.map((id) => t.game.loadout.weapons.find((w) => w.id === id)!);
  return { t, ws };
}
function dummy(t: ReturnType<typeof createTestGame>, dist: number, side = 0, frozen = true): Zombie {
  const z = t.game.spawnZombie('zombie', t.inFront(dist, side), t.game.player.facing.clone().negate())!;
  z.hp = 1e6;
  if (frozen) z.frozen = 1e6;
  return z;
}
const hitsOn = (t: ReturnType<typeof createTestGame>, w: object, z: Zombie) => t.events('zombieHit').filter((e) => e.weapon === w && e.zombie === z);

describe('Les synergies entre armes', () => {
  it('chaque synergie s annonce quand sa seconde arme arrive', () => {
    const { t } = arena('plateau', 'tabouret');
    expect(t.events('synergyActivated').map((e) => e.id)).toContain('serviceMuscle');
    expect(Object.keys(SYNERGIES).length).toBeGreaterThanOrEqual(16);
  });

  it('Service musclé : un ricochet du plateau lance un tour de tabouret', () => {
    const { t, ws } = arena('plateau', 'tabouret');
    const [tray, stool] = ws;
    stool.mods.range = 0;
    // Deux zombies loin du tabouret : seul le ricochet du plateau peut le faire tourner
    dummy(t, 6); dummy(t, 8, 1);
    let spun = false;
    t.playUntil(() => { spun = spun || stool.projectiles.some((p) => p.active); return spun; }, PLATEAU.cooldown + 2);
    expect(t.events('zombieHit').some((e) => e.weapon === tray)).toBe(true);
    expect(spun).toBe(true);
  });

  it('Noël au comptoir : un 421 double les bouteilles de la couronne', () => {
    const { t, ws } = arena('biereNoel', 'des421');
    const [noel, dice] = ws;
    dice.mods.critChance = -1;
    dummy(t, 6);
    t.play(0.2);
    expect(noel.projectiles.filter((p) => p.active)).toHaveLength(BIERE_NOEL.count);
    queue.push(0.55, 0.2, 0.01); // 4, 2, 1
    t.playUntil(() => t.events('weaponExploded').some((e) => e.weapon === dice), 4);
    t.play(0.1);
    expect(noel.projectiles.filter((p) => p.active)).toHaveLength(BIERE_NOEL.count * SYNERGY_FX.noel.mult);
  });

  it('Rot de corne : le rot part en cône et touche un zombie bien plus loin devant', () => {
    const { t, ws } = arena('rot', 'corne');
    const [rot, corne] = ws;
    corne.mods.rate = 0.0001; // la corne ne repousse pas le zombie pendant le test
    const far = dummy(t, ROT.radius * 2);
    const at = far.pos.clone();
    for (let i = 0; i < (ROT.firstDelay + 0.5) * 60; i++) { far.pos.copy(at); far.knockVel.set(0, 0, 0); t.play(1 / 60); }
    expect(hitsOn(t, rot, far).length).toBe(1);
  });

  it('Haleine de feu : avec l IPA, l aura fait deux fois plus mal', () => {
    const a = arena('odeur');
    const za = dummy(a.t, ODEUR.radius * 0.5);
    a.t.play(1);
    const b = arena('odeur', 'ipa');
    b.ws[1].mods.range = 0;
    const zb = dummy(b.t, ODEUR.radius * 0.5);
    b.t.play(1);
    expect(hitsOn(b.t, b.ws[0], zb)[0].damage).toBeCloseTo(hitsOn(a.t, a.ws[0], za)[0].damage * SYNERGY_FX.haleine.damage);
  });

  it('Ricochets : avec la Triple, une fléchette rebondit sur un autre zombie', () => {
    const { t, ws } = arena('flechettes', 'triple');
    const [darts, triple] = ws;
    triple.mods.range = 0;
    darts.mods.rate = 0.01;
    darts.mods.critChance = -1;
    const a = dummy(t, 8, 0);
    const b = dummy(t, 10, 1);
    a.hp = 5000; // le plus solide, visé en premier
    t.play(3);
    expect(hitsOn(t, darts, a).length + hitsOn(t, darts, b).length).toBeGreaterThanOrEqual(2);
  });

  it('Ça flambe : avec l IPA, un zombie dans une flaque de bière prend feu', () => {
    const { t, ws } = arena('ipa', 'flaqueBiere');
    const [ipa] = ws;
    ipa.mods.range = 0; // l'IPA ne lance rien : seul le feu des flaques peut toucher
    t.play(0.1);
    const z = dummy(t, 0.5);
    t.play(2);
    expect(hitsOn(t, ipa, z).length).toBeGreaterThan(0);
  });

  it('Glissade : sur une flaque de bière, le fût roule plus vite', () => {
    const speedOf = (withPuddle: boolean) => {
      const { t, ws } = withPuddle ? arena('fut', 'flaqueBiere') : arena('fut');
      const fut = ws[0];
      dummy(t, 9);
      t.playUntil(() => fut.projectiles.some((p) => p.active), 5);
      const p = fut.projectiles.find((x) => x.active)!;
      // Une grande flaque de bière sur toute la route du fût
      if (withPuddle) {
        const zones = ws[1].zones as { pos: typeof p.pos; radius: number; age: number; life: number; active: boolean }[];
        zones.push({ pos: p.pos.clone(), radius: 30, age: 0, life: 99, active: true });
      }
      const a = p.pos.clone();
      t.play(0.2);
      return p.pos.distanceTo(a);
    };
    expect(speedOf(true)).toBeGreaterThan(speedOf(false) * 1.4);
  });
});
