import { RENDER } from '../config/visual';
import { PLANET } from '../config/world';
import { isTouchDevice } from '../core/input';

/**
 * Qualité du rendu, décidée une fois au chargement : léger sur écran tactile (téléphone, tablette), complet sinon.
 * `?rendu=leger` ou `?rendu=complet` dans l'adresse force l'un ou l'autre (pour comparer sur ordinateur).
 */
function pick() {
  if (typeof location === 'undefined') return false; // tests (Node)
  const forced = new URLSearchParams(location.search).get('rendu');
  if (forced === 'leger') return true;
  if (forced === 'complet') return false;
  return isTouchDevice();
}

export const LIGHT_RENDER = pick();

/** Taille de la carte d'ombres selon la qualité. */
export const SHADOW_MAP_SIZE = LIGHT_RENDER ? RENDER.light.shadowMapSize : RENDER.shadow.mapSize;

/** Finesse du maillage du terrain (le relief, lui, reste celui de heightAt : seul le dessin s'allège). */
export const TERRAIN_DETAIL = LIGHT_RENDER ? RENDER.light.terrainDetail : PLANET.detail;
