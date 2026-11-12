import { describe, expect, it } from 'vitest';
import { emptyProfile, isEmpty, mergeProfiles, readProfile, recordRun } from '../../src/meta/profile';

describe('La progression du joueur', () => {
  it('un nouveau joueur part de zéro', () => {
    const p = emptyProfile();
    expect(isEmpty(p)).toBe(true);
    expect(p.runs).toBe(0);
  });

  it('chaque run terminée compte : runs, kills additionnés, meilleur temps gardé', () => {
    let p = recordRun(emptyProfile(), { survived: 300, kills: 120 }, 1000);
    p = recordRun(p, { survived: 200, kills: 80 }, 2000);
    expect(p.runs).toBe(2);
    expect(p.totalKills).toBe(200);
    expect(p.bestTime).toBe(300);
    expect(p.updatedAt).toBe(2000);
    expect(isEmpty(p)).toBe(false);
  });

  it('la première connexion rattache la progression invitée au compte, sans rien perdre', () => {
    const account = recordRun(emptyProfile(), { survived: 400, kills: 50 }, 1);
    const guest = recordRun(recordRun(emptyProfile(), { survived: 500, kills: 10 }, 2), { survived: 100, kills: 5 }, 3);
    const m = mergeProfiles(account, guest, 9);
    expect(m.runs).toBe(3);
    expect(m.totalKills).toBe(65);
    expect(m.bestTime).toBe(500);
    expect(m.updatedAt).toBe(9);
  });

  it('une sauvegarde abîmée ou d un autre format ne plante pas : les champs faux repartent de zéro', () => {
    expect(readProfile(null)).toEqual(emptyProfile());
    expect(readProfile('n importe quoi')).toEqual(emptyProfile());
    const p = readProfile({ runs: 4, bestTime: -3, totalKills: 'beaucoup', updatedAt: 7 });
    expect(p.runs).toBe(4);
    expect(p.bestTime).toBe(0);
    expect(p.totalKills).toBe(0);
    expect(p.updatedAt).toBe(7);
  });
});
