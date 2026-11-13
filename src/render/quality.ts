import { RENDER } from '../config/visual';
import { PLANET } from '../config/world';
import { isTouchDevice } from '../core/input';
import { loadSettings, type ShadowChoice } from '../core/settings';

/**
 * Qualité du rendu, décidée une fois au chargement : le choix des Options (Graphismes), ou en automatique léger sur
 * écran tactile (téléphone, tablette) et complet sinon. `?rendu=leger` ou `?rendu=complet` dans l'adresse force l'un
 * ou l'autre (pour comparer sur ordinateur).
 */
function pick() {
  if (typeof location === 'undefined') return false; // tests (Node)
  const forced = new URLSearchParams(location.search).get('rendu');
  if (forced === 'leger') return true;
  if (forced === 'complet') return false;
  const q = loadSettings().quality;
  if (q !== 'auto') return q === 'leger';
  return isTouchDevice();
}

export const LIGHT_RENDER = pick();

/** Ombres selon le choix des Options : en automatique, coupées en rendu léger (elles font planter des puces PowerVR). */
export const shadowsOn = (c: ShadowChoice) => (c === 'auto' ? !LIGHT_RENDER : c === 'oui');

/** Taille de la carte d'ombres selon la qualité. */
export const SHADOW_MAP_SIZE = LIGHT_RENDER ? RENDER.light.shadowMapSize : RENDER.shadow.mapSize;

/** Finesse du maillage du terrain (le relief, lui, reste celui de heightAt : seul le dessin s'allège). */
export const TERRAIN_DETAIL = LIGHT_RENDER ? RENDER.light.terrainDetail : PLANET.detail;
