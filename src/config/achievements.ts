// Succès (GDD section 14) : liste validée par l'utilisateur le 2026-11-13. Chaque succès se gagne une seule fois et
// rapporte des TUNAS. Conditions lues par game/achievements.ts ; « run » : dans une même run, « total » : depuis le début.

import { CLOSING } from './closing';

export type AchievementRule =
  | { kind: 'runEnded' }
  | { kind: 'survive'; seconds: number }
  | { kind: 'boss'; boss: 'sonneur' | 'abbe'; difficulty?: 'pompette' | 'bourre' }
  | { kind: 'runKills'; n: number }
  | { kind: 'totalKills'; n: number }
  | { kind: 'weapons'; n: number }
  | { kind: 'synergy' }
  | { kind: 'elites'; n: number }
  | { kind: 'items'; n: number }
  | { kind: 'bins'; n: number }
  | { kind: 'tunas'; n: number };

/** `unlocks` : articles de la boutique que seul ce succès débloque (ils ne s'achètent pas, GDD section 14). */
export type AchievementDef = { id: string; name: string; text: string; tunas: number; rule: AchievementRule; unlocks?: readonly string[] };

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'premierVerre', name: 'Premier verre', text: 'Terminer une run', tunas: 10, rule: { kind: 'runEnded' } },
  { id: 'tenirAlcool', name: "Tenir l'alcool", text: 'Survivre 5 min', tunas: 20, rule: { kind: 'survive', seconds: 300 } },
  { id: 'fermeture', name: "Jusqu'à la fermeture", text: "Survivre jusqu'à 10:00", tunas: 40, rule: { kind: 'survive', seconds: CLOSING.at } },
  { id: 'defierMort', name: 'Défier la Mort', text: 'Tenir 1 min après la fermeture', tunas: 60, rule: { kind: 'survive', seconds: CLOSING.at + 60 } },
  { id: 'sonne', name: 'Sonné', text: 'Tuer le Frère Sonneur', tunas: 30, rule: { kind: 'boss', boss: 'sonneur' }, unlocks: ['character:videur'] },
  { id: 'derniereMesse', name: 'Dernière messe', text: "Tuer l'Abbé", tunas: 60, rule: { kind: 'boss', boss: 'abbe' }, unlocks: ['item:secondeTournee'] },
  { id: 'pompetteConfirme', name: 'Pompette confirmé', text: "Tuer l'Abbé en Pompette", tunas: 100, rule: { kind: 'boss', boss: 'abbe', difficulty: 'pompette' } },
  { id: 'bourreConfirme', name: 'Bourré confirmé', text: "Tuer l'Abbé en Bourré", tunas: 150, rule: { kind: 'boss', boss: 'abbe', difficulty: 'bourre' } },
  { id: 'tourneeGenerale', name: 'Tournée générale', text: '1 000 zombies dans une run', tunas: 50, rule: { kind: 'runKills', n: 1000 } },
  { id: 'boucher', name: 'Boucher', text: '10 000 zombies au total', tunas: 100, rule: { kind: 'totalKills', n: 10000 } },
  { id: 'arsenal', name: 'Arsenal complet', text: '4 armes équipées en même temps', tunas: 20, rule: { kind: 'weapons', n: 4 } },
  { id: 'caMatch', name: 'Ça match', text: 'Activer une synergie', tunas: 20, rule: { kind: 'synergy' } },
  { id: 'chasseurElites', name: "Chasseur d'élites", text: '5 élites dans une run', tunas: 30, rule: { kind: 'elites', n: 5 } },
  { id: 'collectionneur', name: 'Collectionneur', text: '10 objets dans une run', tunas: 30, rule: { kind: 'items', n: 10 } },
  { id: 'eboueur', name: 'Éboueur', text: 'Casser 50 poubelles dans une run', tunas: 20, rule: { kind: 'bins', n: 50 } },
  { id: 'pleinAuxAs', name: 'Plein aux as', text: '100 TUNAS ramassés dans une run', tunas: 30, rule: { kind: 'tunas', n: 100 } },
];

/** Bannière en run quand un succès tombe (s). */
export const ACHIEVEMENT_BANNER = { duration: 3 } as const;
