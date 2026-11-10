import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { SPRITE_FX, VFX } from '../../src/config/fx';
import { createSprites } from '../../src/fx/sprites';
import { createVfx } from '../../src/fx/vfx';
import { ITEM_ICONS } from '../../src/ui/itemIcons';
import { ITEMS } from '../../src/config/items';

/** Un point au sol de la planète (les effets s'orientent sur la verticale locale). */
const somewhere = () => new THREE.Vector3(0.2, 1, 0.1).normalize().multiplyScalar(60);

describe('Les effets visuels', () => {
  it('une particule vit sa durée, puis disparaît', () => {
    const sprites = createSprites(new THREE.Scene());
    sprites.emit(somewhere(), { kind: 'glow', color: 0xffffff, size: 1, life: 0.5 });
    sprites.update(0.3);
    expect(sprites.count).toBe(1);
    sprites.update(0.3);
    expect(sprites.count).toBe(0);
  });

  it('jeu figé : les particules attendent, elles ne vieillissent pas', () => {
    const sprites = createSprites(new THREE.Scene());
    sprites.emit(somewhere(), { kind: 'smoke', color: 0xffffff, size: 1, life: 0.5 });
    for (let i = 0; i < 100; i++) sprites.update(0);
    expect(sprites.count).toBe(1);
  });

  it("la réserve ne déborde jamais : les plus anciennes laissent leur place", () => {
    const sprites = createSprites(new THREE.Scene());
    for (let i = 0; i < SPRITE_FX.maxLights + 50; i++) sprites.emit(somewhere(), { kind: 'star', color: 0xffffff, size: 1, life: 10 });
    for (let i = 0; i < SPRITE_FX.maxSmoke + 50; i++) sprites.emit(somewhere(), { kind: 'smoke', color: 0xffffff, size: 1, life: 10 });
    sprites.update(0.016);
    expect(sprites.count).toBe(SPRITE_FX.maxLights + SPRITE_FX.maxSmoke);
  });

  it('une explosion lance son éclair, ses braises et sa fumée, puis tout retombe', () => {
    const sprites = createSprites(new THREE.Scene());
    const vfx = createVfx(new THREE.Scene(), sprites);
    vfx.explosion(somewhere(), 3, VFX.wine);
    expect(sprites.count).toBe(3 + VFX.wine.embers + VFX.wine.puffs);
    for (let i = 0; i < 120; i++) { sprites.update(1 / 60); vfx.update(1 / 60); }
    expect(sprites.count).toBe(0);
  });

  it('un ennemi tué part en fumée, un coup critique gicle en étincelles', () => {
    const sprites = createSprites(new THREE.Scene());
    const vfx = createVfx(new THREE.Scene(), sprites);
    vfx.kill(somewhere());
    expect(sprites.count).toBe(1 + VFX.kill.puffs);
    sprites.clear();
    vfx.crit(somewhere());
    expect(sprites.count).toBe(2 + VFX.crit.sparks);
  });

  it("horde qui meurt en chaîne : les effets s'allègent, la fumée ne noie pas l'écran", () => {
    const sprites = createSprites(new THREE.Scene());
    const vfx = createVfx(new THREE.Scene(), sprites);
    for (let i = 0; i < 300; i++) vfx.kill(somewhere());
    expect(sprites.load(true)).toBeLessThan(0.75);
    // Chaque ennemi tué garde au moins une bouffée
    const before = sprites.count;
    vfx.kill(somewhere());
    expect(sprites.count).toBeGreaterThan(before);
  });

  it('retour à l accueil : plus aucune particule', () => {
    const sprites = createSprites(new THREE.Scene());
    const vfx = createVfx(new THREE.Scene(), sprites);
    vfx.beam(somewhere(), 0xffd45a);
    vfx.dust(somewhere(), 8);
    expect(sprites.count).toBeGreaterThan(0);
    sprites.clear();
    vfx.clear();
    expect(sprites.count).toBe(0);
  });
});

describe('Les icônes', () => {
  it('chaque objet de coffre a son icône', () => {
    for (const id of Object.keys(ITEMS)) expect(ITEM_ICONS[id as keyof typeof ITEM_ICONS], id).toBeTruthy();
    expect(Object.keys(ITEM_ICONS).sort()).toEqual(Object.keys(ITEMS).sort());
  });

  it('aucune icône ne contient de valeur invalide (NaN, undefined)', () => {
    for (const [id, svg] of Object.entries(ITEM_ICONS)) expect(/NaN|undefined/.test(svg), id).toBe(false);
  });
});
