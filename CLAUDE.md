# Megabeer

3D low-poly survivors-like (Vampire Survivors clone) built in-browser. Theme: a drunk
survives the night in a procedurally-generated abbey, fighting off zombies with beer
weapons (bottle throws, rolling kegs, beer puddles, coaster shurikens). French UI/copy.

## Stack

- **Vite** (build tool/dev server) + **vanilla JS ES modules** — no UI framework.
- **three.js** (npm package, not CDN) for 3D rendering. `MeshToonMaterial` + a 4-step
  gradient map everywhere for the cel-shaded "anime" look; flat-ish ambient lighting.
- **yarn** as package manager.
- No test framework, no TypeScript, no bundler config beyond Vite defaults.

### Commands

```
yarn install    # install deps
yarn dev        # dev server, http://localhost:5173 (or next free port)
yarn build      # production build → dist/
yarn preview    # serve the production build locally
```

## Architecture

`index.html` loads `src/main.js` as the sole entry module. Everything else is a
small single-purpose ES module imported from there — no bundler magic, no barrel
files. Rough layers:

- **Core**: `scene.js` (renderer/camera/lights/ground), `state.js` (shared mutable
  run state), `input.js` (keyboard + mouse/pointer-lock), `dom.js` (cached DOM refs),
  `util.js`.
- **Systems** (logic + three.js mesh handling, one concern each): `player.js`,
  `enemies.js`, `weapons.js`, `projectiles.js`, `puddles.js`, `xp.js`, `tunas.js`,
  `mapgen.js` (procedural abbey chunks + collision), `hud.js`, `upgrades.js` (level-up
  cards), `menu.js` (main menu + TUNAS shop), `meta.js` (localStorage meta-progression),
  `textures.js` (procedural canvas textures + toon material factory), `devpanel.js`.
- **`src/config/`** — pure data, **zero three.js/DOM imports allowed here**. This is
  the mandatory rule below.

### Rule: all game data lives in `src/config/`

Weapons, enemies, characters, passive items, shop costs, economy tuning — every
number a designer would want to tweak goes in `src/config/*.js` as plain exported
objects/arrays. Systems import config and read from it; they never hardcode balance
numbers inline. Current files:

- `config/characters.js` — playable character base stats (only one today; schema
  supports adding more + a selection screen later).
- `config/enemies.js` — `ENEMY_TYPES` (zombie stats). Has an `effects: []` extension
  point for future special behaviors (on-death explosion, etc.) — currently unused,
  no engine support yet. Add engine handling in `enemies.js` before populating it.
- `config/weapons.js` — `WEAPON_TYPES` (cooldown/range/damage/projectile params),
  `BEER_TYPES` (beer variants rolled by the starter weapon). Each weapon's
  `unlockCard` (level-up pick text) and `shop` (TUNAS cost + description) live on
  the same object — single source of truth, don't duplicate elsewhere.
- `config/items.js` — `PASSIVE_ITEMS`, the level-up stat-upgrade pool. Generic
  `{stat, op: 'mult'|'add', value}` shape, applied by `upgrades.js` — adding an item
  here needs no new code unless it does something non-generic.
- `config/economy.js` — TUNAS pacing formula, see below.

When adding new content (a weapon, an enemy, an item, a character): add a config
entry first, wire the system to read it. Don't inline new balance numbers into
system files.

## TUNAS meta-progression economy

TUNAS drop from kills (`tunas.js` → `maybeDropTunas`, chance/amount from
`config/economy.js`) and persist via `localStorage` (`meta.js`). Spent in the shop
(`menu.js`) to permanently unlock a weapon's *availability* — a purchased weapon can
then appear as an in-run level-up card, it isn't equipped automatically.

**Design target: ~100 runs to unlock everything.** The formula and the current
estimate live as comments in `config/economy.js` — read it before touching drop
rates or shop costs. Short version:

```
avgTunasPerRun ≈ assumedKillsPerRun * tunasDropChance * tunasDropAmount
targetRunsToUnlockAll = totalShopCost / avgTunasPerRun
```

`assumedKillsPerRun` is an **estimate** (not measured from real playtests). If you
add telemetry or just eyeball average runs, update that constant and re-derive
`tunasDropChance`/`tunasDropAmount` (or shop costs) to keep the ~100-run target.
When adding a new purchasable item, size its cost the same way: pick how many runs
it should take to unlock on its own, `cost = round(avgTunasPerRun * targetRuns)`,
and check the new `totalShopCost / avgTunasPerRun` still lands near the target.

There is exactly one income source (kill drops) — don't add a second parallel
currency formula (e.g. an end-of-run bonus computed independently); it'll double
count and blow the pacing target. `state.tunasEarnedThisRun` tallies the run's
actual drops for the end-screen display; it does not grant TUNAS itself.

## Dev panel (dev-only, never ships to production)

`devpanel.js` renders a 🛠 icon (bottom-right) that toggles a debug sidebar.
Currently: **Godmode** (`state.godmode`, checked in `enemies.js` before applying
contact damage). It's loaded via a dynamic `import()` gated on `import.meta.env.DEV`
in `main.js` — Vite/Rollup dead-code-eliminates the whole module from `yarn build`
output (verified by grepping `dist/assets/*.js` for panel strings — should find
nothing). Keep this pattern for any new dev-only tooling: gate behind
`import.meta.env.DEV`, dynamic-import the module, never add dev-only markup to
`index.html` directly (build it in JS so it's excluded the same way).

## Bug / feature tracking

**GitHub Issues** on this repo (`origin` → `github.com/mydnic/megabeer`). File bugs
and feature requests there, not as TODO comments in code.

## Testing / verification

No automated test suite. Verify changes with:
1. `yarn build` — catches syntax/import errors fast, cheap to run after every change.
2. Manual browser testing via the `claude-in-chrome` MCP tools (if available this
   session) — `yarn dev`, navigate, interact, screenshot, check console.

**Gotcha**: automated browser tabs can report `document.visibilityState: "hidden"`
even while "active", which throttles `requestAnimationFrame` hard — real gameplay
time (`state.gameTime`) barely advances even after many real seconds of `wait`.
Don't chase this as a game bug. For testing without waiting on throttled real time,
temporarily expose what you need on `window.__debug` at the bottom of `main.js`
(e.g. `{ state, player, someFn }`), drive it via the JS-exec tool, then **remove the
debug hook before finishing** — don't ship it.

## Working on this project — instructions for future sessions/agents

- Use `yarn` / `yarn dev` to run it, `yarn build` to sanity-check before calling
  anything done.
- Follow the config-driven data rule above for any new weapon/enemy/item/character.
- Update this file when you change architecture, add a new system/config file, or
  change a convention documented here. Update Claude's persistent memory
  (`/Users/mydnic/.claude/projects/.../memory/`) too when you learn something about
  this project that belongs there instead (ongoing decisions, non-obvious context) —
  see the memory system's own rules for what goes where vs. here.
- Bugs/features → GitHub Issues on this repo, not ad-hoc TODOs.
- Only commit/push when the user explicitly asks.
