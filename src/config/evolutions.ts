// Évolutions des armes (GDD section 6) : une arme au niveau `EVOLUTION.level` ou plus, avec son objet d'évolution
// possédé, fait apparaître une carte « Évolution » au level-up. Prise, l'arme change de nom et gagne ses bonus
// (`mods`, ajoutés à ses améliorations) ; `evolved` passe à 1, ce que certaines armes lisent pour changer de
// comportement (orbite double, retour vers le joueur, onde à 360 degrés...). L'arme continue ensuite de monter.

import type { ItemId } from './items';
import type { WeaponId } from '../weapons/weapon';

export const EVOLUTION = {
  /** Niveau d'arme à partir duquel l'évolution peut sortir. */
  level: 8,
  /** Couleur de la carte et du badge d'une arme évoluée. */
  color: '#ff7ad9',
} as const;

export type EvolutionDef = { item: ItemId; name: string; text: string; mods: Record<string, number> };

export const EVOLUTIONS: Record<WeaponId, EvolutionDef> = {
  canette: { item: 'tourneeRapide', name: 'Tournée générale', text: 'Des canettes dans toutes les directions', mods: { projectiles: 4, rate: 0.3 } },
  stout: { item: 'biereForte', name: 'Imperial Stout', text: "Une onde de choc à chaque impact", mods: { splash: 2.6, damage: 0.5 } },
  vomi: { item: 'kebab', name: 'Gastro', text: 'Flaques énormes, qui durent et rongent plus vite', mods: { size: 0.6, duration: 0.8, damage: 0.6 } },
  kriek: { item: 'pinteXXL', name: 'Kriek Cerise Bombe', text: 'Grosses explosions collantes à chaque impact', mods: { splash: 1.6, damage: 0.6 } },
  triple: { item: 'culSec', name: 'Quadruple', text: '8 rebonds, et chaque rebond frappe plus fort', mods: { bounces: 6, gain: 0.15 } },
  ipa: { item: 'briquet', name: 'Double IPA', text: 'La brûlure double et se propage aux voisins', mods: { burn: 1, splash: 1.8 } },
  weizen: { item: 'sansAlcool', name: 'Mousse infinie', text: 'Un nuage te suit en permanence', mods: { damage: 0.4 } },
  gueuze: { item: 'ventreABiere', name: 'Gueuze Lambic', text: 'Deux gueuzes de plus, explosions plus larges', mods: { projectiles: 2, radius: 0.4 } },
  biereNoel: { item: 'bonnet', name: 'Couronne de Noël', text: 'Une seconde couronne tourne en sens inverse', mods: { projectiles: 2, damage: 0.4 } },
  des421: { item: 'trefle', name: 'Dés pipés', text: 'Plus jamais de 1, et chaque 4 fait jackpot', mods: { loaded: 1 } },
  sousBock: { item: 'aimantCapsules', name: 'Sous-bock tranchant', text: 'Il revient vers toi et frappe au retour', mods: { returns: 1, damage: 0.4 } },
  fut: { item: 'godasses', name: 'Rouleau compresseur', text: 'Un fût géant qui écrase tout', mods: { size: 0.8, damage: 0.6, knock: 0.5 } },
  flaqueBiere: { item: 'seauAGlace', name: 'Inondation', text: 'Traînée large, les zombies restent sonnés longtemps', mods: { size: 0.7, stun: 0.8 } },
  decapsuleur: { item: 'deuxMains', name: 'Ouvre-tout', text: 'Trois décapsuleurs en éventail', mods: { projectiles: 2, damage: 0.3 } },
  tireuse: { item: 'pression', name: 'Tireuse pression max', text: 'Un jet long qui repousse fort', mods: { size: 0.7, knock: 1.5, damage: 0.3 } },
  plateau: { item: 'gueuleDeBois', name: 'Service en salle', text: 'Chaque coup bloqué est renvoyé aux zombies autour', mods: { projectiles: 1 } },
  bouchons: { item: 'ticketTournee', name: 'Magnum', text: 'La rafale part à 360 degrés', mods: { projectiles: 5, ring: 1 } },
  tabouret: { item: 'gantsVideur', name: 'Bagarre générale', text: "Le tabouret ne s'arrête presque plus de tourner", mods: { rate: 3, damage: 0.3 } },
  flechettes: { item: 'lunettes', name: 'Triple 20', text: 'Trois fléchettes, critiques presque garantis', mods: { projectiles: 2, critChance: 0.4 } },
  corne: { item: 'echarpe', name: 'Hymne du stade', text: 'Une onde à 360 degrés qui étourdit', mods: { size: 0.3 } },
  petanque: { item: 'cochonnet', name: 'Le Carreau', text: 'Les boules renversent tout sur leur passage', mods: { pierce: 6, knock: 2, damage: 0.4 } },
  rot: { item: 'cacahuetes', name: 'Rot du siècle', text: 'Une onde énorme qui étourdit', mods: { size: 0.8, damage: 0.5 } },
  bac: { item: 'cendrier', name: 'Palette de bières', text: 'Deux fois plus de bouteilles dans le bac', mods: { fragments: 8, damage: 0.3 } },
  odeur: { item: 'demarche', name: 'Haleine de fin de soirée', text: 'Aura plus large, confusion plus longue', mods: { size: 0.7, confuse: 1, damage: 0.4 } },
};

/** Nom affiché d'une arme : celui de son évolution si elle a évolué. */
export const weaponTitle = (w: { id: WeaponId; name: string; mods: Record<string, number> }) => (w.mods.evolved ? EVOLUTIONS[w.id].name : w.name);
