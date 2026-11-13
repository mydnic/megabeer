import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from '../../src/config/achievements';
import { emptyProfile, mergeProfiles, readProfile, recordRun } from '../../src/meta/profile';
import { createTestGame } from '../support/testGame';

const def = (id: string) => ACHIEVEMENTS.find((a) => a.id === id)!;

/** Une run au sol, calme. */
function arena() {
  const t = createTestGame();
  t.startRunAndLand();
  t.noSpawns();
  t.game.loadout.weapons[0].mods.range = 0;
  return t;
}

describe('Les succès', () => {
  it('terminer une run : Premier verre, annoncé et listé en fin de run', () => {
    const t = arena();
    t.game.abandon();
    const end = t.events('runEnded').at(-1)!;
    expect(end.achievements).toContain('premierVerre');
    expect(t.events('achievementUnlocked').map((e) => e.id)).toContain('premierVerre');
  });

  it('survivre 5 min : Tenir l alcool tombe pendant la run, une seule fois', () => {
    const t = arena();
    t.game.cheats.god = true;
    t.game.runTime = 300 - 0.5;
    t.play(1);
    expect(t.events('achievementUnlocked').filter((e) => e.id === 'tenirAlcool')).toHaveLength(1);
    t.play(1);
    expect(t.events('achievementUnlocked').filter((e) => e.id === 'tenirAlcool')).toHaveLength(1);
  });

  it('un succès déjà gagné ne retombe pas', () => {
    const t = createTestGame();
    t.game.achievements.owned = new Set(['premierVerre']);
    t.startRunAndLand();
    t.game.abandon();
    expect(t.events('runEnded').at(-1)!.achievements).not.toContain('premierVerre');
  });

  it('tuer le Frère Sonneur, puis l Abbé : Sonné et Dernière messe ; en Pompette, Pompette confirmé', () => {
    const t = arena();
    t.game.difficulty = 'pompette';
    t.game.cheats.god = true;
    const sonneur = t.game.spawnBoss(t.inFront(12))!;
    t.game.hitZombie(sonneur.zombie, 1e6, false, sonneur.zombie.pos, t.game.player.facing.clone());
    const at = t.inFront(12);
    const abbe = t.game.spawnAbbe(at, t.game.player.pos.clone().sub(at))!;
    t.game.hitZombie(abbe.zombie, 1e6, false, abbe.zombie.pos, t.game.player.facing.clone());
    const ids = t.events('achievementUnlocked').map((e) => e.id);
    expect(ids).toEqual(expect.arrayContaining(['sonne', 'derniereMesse', 'pompetteConfirme']));
    expect(ids).not.toContain('bourreConfirme');
  });

  it('compteurs de la run (élites, objets) et de toujours (kills)', () => {
    const t = arena();
    for (let i = 0; i < 10; i++) t.game.gainItem('biereForte');
    expect(t.events('achievementUnlocked').map((e) => e.id)).toContain('collectionneur');
    const u = createTestGame();
    u.game.achievements.lifetimeKills = 10_000 - 1;
    u.startRunAndLand();
    u.noSpawns();
    const z = u.game.spawnZombie('zombie', u.inFront(10), u.game.player.facing.clone())!;
    u.game.hitZombie(z, z.hp + 1, false, z.pos, u.game.player.facing.clone());
    u.play(0.1);
    expect(u.events('achievementUnlocked').map((e) => e.id)).toContain('boucher');
  });

  it('gardés dans le profil, leurs TUNAS ajoutés une seule fois, réunis à la connexion', () => {
    let p = recordRun(emptyProfile(), { survived: 10, kills: 0, tunas: 5, achievements: ['premierVerre'] }, 1);
    expect(p.achievements).toEqual(['premierVerre']);
    expect(p.tunas).toBe(5 + def('premierVerre').tunas);
    p = recordRun(p, { survived: 10, kills: 0, tunas: 0, achievements: ['premierVerre'] }, 2);
    expect(p.tunas).toBe(5 + def('premierVerre').tunas);
    expect(readProfile(JSON.parse(JSON.stringify(p))).achievements).toEqual(['premierVerre']);
    const m = mergeProfiles(p, recordRun(emptyProfile(), { survived: 1, kills: 0, tunas: 0, achievements: ['sonne'] }, 3), 4);
    expect(m.achievements).toEqual(expect.arrayContaining(['premierVerre', 'sonne']));
  });
});
