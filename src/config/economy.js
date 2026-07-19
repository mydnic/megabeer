// TUNAS meta-progression economy. Single source of truth for drop income so the
// "everything unlockable in ~N runs" pacing stays tunable in one place.
//
// Formula: avgTunasPerRun ≈ assumedKillsPerRun * tunasDropChance * tunasDropAmount
// targetRunsToUnlockAll = totalShopCost / avgTunasPerRun
//
// totalShopCost is the sum of every WEAPON_TYPES[].shop.cost (src/config/weapons.js).
// Currently 50 (keg) + 80 (puddle) + 120 (coaster) = 250 TUNAS.
// assumedKillsPerRun (~20) is an ESTIMATE, not measured — retune tunasDropChance/
// tunasDropAmount from real playtest data (average kills per run) once available.
//
// When adding a new purchasable item: pick its target unlock-runs, then
// cost = round(avgTunasPerRun * targetRunsForThisItem). Keep totalShopCost /
// avgTunasPerRun close to targetRunsToUnlockAll so "unlock everything" pacing holds.
export const ECONOMY = {
  targetRunsToUnlockAll: 100,
  assumedKillsPerRun: 20,
  tunasDropChance: 0.12,
  tunasDropAmount: 1,
};
