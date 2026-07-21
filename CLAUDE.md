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
- **Systems** (logic + three.js mesh handling, one concern each): `player.js`
  (exports `initPlayer(characterId)` — resets every run-scoped stat from
  `config/characters.js`, called once per run right before `state.started = true`,
  safe to call again on replay without a page reload), `enemies.js`, `enemyModels.js`
  (multi-source zombie model loader, see below), `decorModels.js` (map prop model
  loader, see below), `weapons.js`, `projectiles.js`, `puddles.js`, `xp.js`,
  `tunas.js`, `mapgen.js` (procedural abbey chunks + collision), `terrain.js`
  (real 3D mountain terrain, see below), `zones.js` (biome/decor-cluster noise,
  see below), `noise.js` (vendored 2D simplex noise, used by both), `hud.js`,
  `upgrades.js` (level-up cards), `menu.js` (main menu + TUNAS shop), `charSelect.js`
  (character + map pick screen, shown after "Jouer" and before a run starts),
  `meta.js` (localStorage meta-progression), `textures.js` (procedural canvas
  textures + toon material factory), `audio.js` (SFX — see below), `devpanel.js`.
- **`src/config/`** — pure data, **zero three.js/DOM imports allowed here**. This is
  the mandatory rule below.

### Flow: menu → character/map select → run

`main.js` wires `initCharSelect((characterId, mapId) => { initPlayer(characterId);
state.started = true; })` and `initMenu(() => showSelect())` — clicking "Jouer"
opens the select screen (`charSelect.js`) instead of starting a run directly.
Map choice is UI-only today (`config/maps.js` — one real map, two locked
placeholders) since `mapgen.js` only knows how to generate the abbey; wire the
`mapId` through when a second real map exists.

### Rule: all game data lives in `src/config/`

Weapons, enemies, characters, passive items, shop costs, economy tuning — every
number a designer would want to tweak goes in `src/config/*.js` as plain exported
objects/arrays. Systems import config and read from it; they never hardcode balance
numbers inline. Current files:

- `config/characters.js` — `CHARACTERS` (base stats + `startWeapon` id, each
  character locked to one weapon it starts the run with) and `CHARACTER_ORDER`
  (display order on the select screen — add a character here too or it won't show).
- `config/maps.js` — `MAPS`, `locked: true` entries render as greyed-out "???"
  placeholders on the select screen. Only `locked: false` ones are pickable.
- `config/enemies.js` — `ENEMY_TYPES` (zombie stats). `unlockAt` (seconds) gates
  when each type can start spawning — edit that field directly per entry, there's
  no separate pacing constant. Has an `effects: []` extension point for future
  special behaviors (on-death explosion, etc.) — currently unused, no engine
  support yet. Add engine handling in `enemies.js` before populating it.
- `config/weapons.js` — `WEAPON_TYPES` (cooldown/range/damage/projectile params),
  `BEER_TYPES` (beer variants rolled by the default 'beer' weapon only — 'stout'
  and 'vomit' are character-exclusive starters and don't roll variants). Each
  weapon's `unlockCard` (level-up pick text) and `shop` (TUNAS cost + description)
  live on the same object — single source of truth, don't duplicate elsewhere.
  Character-exclusive starters omit both (not obtainable any other way).
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

## Terrain

`terrain.js` is real walkable 3D terrain (actual mountains), not decoration —
`getTerrainHeight(x, z)` is a pure deterministic function of world x/z, and
`buildTerrainChunk(chunkSize, originX, originZ)` builds one mesh per chunk
sampling that exact same function at each vertex. Because both the height query
and the mesh vertices come from the same formula, whatever `getTerrainHeight()`
returns for a given (x, z) is *exactly* the surface height rendered there — no
separate collision heightmap to keep in sync, no floating/clipping. `mapgen.js`'s
`generateChunk` adds a terrain mesh to every chunk unconditionally
(`buildTerrainChunk` doesn't depend on `decorModels` loading — it's pure
geometry, no GLB), before the spawn-clear-radius branch that skips decor.

**Height is two layered noise octaves**, both sampled only at `DETAIL_SPACING`
(5 units) grid corners so the height query and the mesh's flat-shaded triangles
always agree exactly (see the triangle-split comment in `getTerrainHeight`):
- Coarse mountain massif: `noise.js`'s `simplex2()` (a vendored public-domain
  2D simplex noise, not the hand-rolled bilinear lattice hash the first attempt
  used — that looked grid-aligned/boxy, real gradient noise reads organic) at
  `MOUNTAIN_SPACING` (55 units), raised to a power (`Math.pow(raw, 2.4)`) before
  scaling by `MOUNTAIN_AMPLITUDE` (26). **The power curve is load-bearing, not
  decorative** — simplex noise averages ~0.5 almost everywhere, so without it
  the whole map sits at roughly half amplitude (a uniformly elevated plateau,
  no distinct peaks/valleys, and every screen looks the same monotone grey — a
  real bug hit and fixed here). The curve pushes the bulk of the range down
  toward 0 so mountains read as actual rising features over open low ground.
- Fine rocky detail: the original per-vertex hash lattice, `DETAIL_AMPLITUDE`
  (1.8) on top, for low-poly ruggedness at mesh-vertex resolution.

**Rendering gotchas actually hit, in case they recur**: (1) `MeshToonMaterial`
has no `flatShading` property (unlike `MeshStandardMaterial`) — passing it in
the constructor is a silent no-op (`Material.setValues` only assigns keys that
already exist on the instance). Real flat facets need `geometry.toNonIndexed()`
before `computeVertexNormals()` so triangles don't share vertices/normals with
their neighbors. (2) Triangle winding matters for a horizontal mesh: get it
backwards and every face normal points down, so the default `FrontSide`
material culls the *entire* terrain from a camera looking down at it — geometry
data was correct the whole time, nothing rendered, and the giant fallback plane
underneath made it look like "the terrain never has any elevation" when it was
actually "invisible, not flat." Caught only by directly inspecting live scene
state (a temporary `window.__debug = {...}` at the bottom of `main.js`, removed
after) — screenshots alone repeatedly showed stale/frozen frames in this
environment and were not trustworthy for this kind of check.

**Height/slope → color** (`terrainColor()`): per-vertex color, not a texture
map — `BAND_LOW`/`BAND_MID`/`BAND_HIGH` blend by height (valley moss → bare
rock → pale summit), then blend further toward `CLIFF_COLOR` on steep faces
(low `normal.y`) so a cliff reads distinctly from a gentle slope at the same
elevation. Material has `vertexColors: true` with a white base color so these
show through unmixed; geometry gets a `color` `BufferAttribute` alongside
`position`/`normal` in `buildTerrainChunk`.

**Zones** (`zones.js`): `zoneAt(x, z)` is a second, decorrelated simplex field
(different seed, `ZONE_SCALE` 140 units — wide, so a zone spans several chunks)
returning `'forest'`/`'ruins'`/`'graveyard'`/`'open'`. `mapgen.js`'s
`ZONE_DECOR` table gives each zone a weighted decor pool (forest ≈70% tree,
ruins ≈splits across wall/pillar/arch/crypt, etc. — `'open'` keeps roughly the
old flat global mix as the transition zone) so decor actually clusters into
recognizable forests/ruin fields/graveyards instead of one independently-random
prop per chunk with no larger structure. Forest zone chunks spawn a real
2-4-tree cluster (`spawnForestCluster`) rather than a single tree — one trunk
per chunk never reads as "forest" even when every neighboring chunk also rolls
a tree.

Every entity/prop that touches the ground reads `getTerrainHeight()` for its Y:
`player.js`'s gravity/jump physics snaps to it instead of a hardcoded `y=0`
(`updatePlayer`'s grounded check), `enemies.js` re-samples it every frame per
enemy (`updateEnemies`) and at spawn, `mapgen.js`'s prop spawners
(`spawnWall`/`spawnTree`/etc.) place decor on it, and `puddles.js`/`xp.js`/
`tunas.js` float their meshes above it. `weapons.js`/`projectiles.js`'s
`fireProjectile` spawns bottles/kegs at `player.y + originY`, not absolute
`originY` — otherwise a weapon fired while standing on a mountain launches from
underground. `enemies.js`'s `DODGE_HEIGHT` jump-dodge check is relative to the
*current* ground height under the player
(`player.y - getTerrainHeight(player.x, player.z)`), not absolute `player.y` —
it has to be, since standing on a hill already puts `player.y` well above 0.
XZ collision (`resolveCollisions` in `mapgen.js`, walls/pillars/graves/etc.)
stays 2D/height-agnostic on purpose — a full 3D collision system (can't walk up
a cliff face) was judged out of scope for this game; slopes are always walkable
by simply snapping the Y position, which is also what makes climbing/descending
work with zero extra physics code.

`getTerrainHeight()` is cheap (a handful of arithmetic ops, no allocation) so
calling it every frame per entity is fine — don't cache/memoize it without a
measured perf reason.

The chunk-generation radius (`VIEW_RADIUS` in `mapgen.js`, currently 5, ~110
units) exists so terrain mesh coverage keeps pace with camera draw distance —
past that radius there's no terrain mesh (though `getTerrainHeight()` still
returns a valid height for any x/z, chunk-independent) and the old flat
procedural `stoneMaterial` ground plane in `scene.js` shows through as a
fallback, tinted close to the terrain's low-band color so the edge — deep in
fog at that distance — blends instead of popping.

Terrain casts shadows now too (`mesh.castShadow = true` in `buildTerrainChunk`)
— mountains shadowing their own lower slopes/neighboring valleys is the single
biggest depth-readability cue for real elevation, a flat plane never needed it.
Shadow map type moved from `THREE.PCFSoftShadowMap` (deprecated in this
three.js version — confirmed via an actual browser console warning; it was
silently falling back to hard `PCFShadowMap`) to `THREE.VSMShadowMap` in
`scene.js`, plus `moon.shadow.normalBias` (fixes self-shadow acne on the
terrain's steep faces — depth bias alone wasn't enough) and
`radius`/`blurSamples` for VSM softness.

**Libraries considered and not adopted** (asked about repeatedly during this
work, documenting so it isn't re-litigated): literal-voxel Minecraft clones
(`zailleh/minecraft-terrain-threejs`, `0kzh/minicraft`) don't apply — this is a
smooth heightmap, not cubes. A full alternate engine (`SterlyDolce/
Infinite-Engine`) would mean rewriting this project's whole architecture for no
stated benefit. `IceCreamYou/THREE.Terrain` was checked directly against its
source (`core.js`, `analysis.js`) — it's a one-shot mesh generator with no
runtime `getHeightAt(x,z)` API, so it wouldn't remove the hand-written
height-query code this project actually depends on for collision, and its
height/slope texture-blend shader is the same technique already implemented
above via vertex colors.

## Dev panel (dev-only, never ships to production)

`devpanel.js` renders a 🛠 icon (bottom-right) that toggles a debug sidebar.
Currently: **Godmode** (`state.godmode`, checked in `enemies.js` before applying
contact damage), **Freeze time** (toggles `state.paused` directly), and **Spawn
enemy** (dropdown of `ENEMY_TYPES` + button, calls `spawnEnemyById` from
`enemies.js` to drop one ~6 units from the player for quick inspection). Prefer
extending this panel over ad-hoc `window.__debug` hooks when the need is
recurring (inspecting enemies/animations, forcing state) — it's real UI, not a
throwaway. It's loaded via a dynamic `import()` gated on `import.meta.env.DEV` in
`main.js` — Vite/Rollup dead-code-eliminates the whole module from `yarn build`
output (verified by grepping `dist/assets/*.js` for panel strings — should find
nothing). Keep this pattern for any new dev-only tooling: gate behind
`import.meta.env.DEV`, dynamic-import the module, never add dev-only markup to
`index.html` directly (build it in JS so it's excluded the same way).

## Lighting / art direction

`scene.js` sets a night palette (desaturated blue-grey, not neutral grey) with low
ambient + a directional "moon" key light that **follows the player** every frame
(`updateSceneLighting(px, pz)`, called from `main.js`'s update loop) so its shadow
camera frustum (35 units, tuned for close-range readability) stays centered on the
action across the infinite procedural map. Shadows are on
(`renderer.shadowMap.enabled`); player/zombies/map props all cast+receive. If you
add a new light, either make it follow the player the same way or keep it a cheap
non-shadow-casting fill — a fixed-position shadow-casting light won't cover the
map as the player roams. Ambient is intentionally low: `MeshToonMaterial`'s
gradient-map banding only reads when there's real light/shadow contrast, high
ambient flattens it back to a wash.

## 3D assets

`src/assets/` holds downloaded model/texture packs, all CC0:

- `kenney-animated-characters-survivors/` — FBX rig + zombie/survivor skins +
  idle/run/jump clips.
- `quaternius-zombies/` — 4 self-contained glTF zombie models (Basic/Chubby/
  Arm/Ribcage), each with 16 named animation clips (Run/Walk/Death/Crawl/Attack/
  etc).

**Both wired in** via `enemyModels.js`, which unifies the two asset families (FBX
rigs with separate skin textures vs. glTF models each with their own baked
material) behind one `cloneEnemyModel(modelId, tint, r)` call — see its comment
about the Kenney `run.fbx` two-clip trap (index 0 is a frozen T-pose, the real
cycle is picked by name). `config/enemies.js` now has 8 zombie types split across
both sources (`model: 'kenney_zombieA'` vs `model: 'quat_ribcage'` etc.) — add a
new visual variant by adding a rig+variant entry in `enemyModels.js` if it's a new
source, or just a new `ENEMY_TYPES` entry reusing an existing `model` id with
different stats/tint if not.
- `quaternius-vehicles/` — 6 glTF vehicles (Pickup/Truck/Sports, each with an
  Armored variant). Staged for issue #8 (véhicule écrase-zombies), not wired in.
- `kenney-castle-kit/` and `kenney-graveyard-kit/` — structural (walls/pillars/
  arches) and atmospheric (gravestones/crypts/pines/rocks) props for the map.
  **Wired in** via `decorModels.js` (13-model curated subset of the ~170 available
  across both kits — add a key + `?url` import there to pull in more), consumed by
  `mapgen.js`'s chunk generator in place of the old procedural box/cylinder props.
  Walls still get multi-point colliders along their length (open doorways on
  arches stay walkable); compact props (pillars/graves/crypts/trees/barrels) get
  one circle collider sized from the model's bounding box. The decorative barrel
  prop uses the real `kegBarrel` model (see `quaternius-props/` below) — neither
  Castle nor Graveyard kit has one, so it's borrowed from the weapon-projectile set.
  **Gotcha**: Kenney's GLB props ship `MeshStandardMaterial` (PBR) — under this
  scene's low-ambient lighting (tuned for `MeshToonMaterial`'s stepped gradient,
  see Lighting below) they render near-black instead of matching the game's flat
  cel-shaded look. `decorModels.js` converts every loaded material to
  `toonMaterial()` on load, reusing the original texture map. Do this for any new
  GLB/glTF prop pack — don't leave PBR materials as-is.
- `quaternius-food-pack/` — 50 CC0 food/drink glTF models from Quaternius (via
  Poly Pizza), fetched primarily for a real beer bottle but broad enough to cover
  future food/drink pickups (apéro snacks, healing items — see the issue #3/#6
  brainstorm). `Bottle.glb` is **wired in** (see below); the other 48 are staged,
  not used yet.
- `quaternius-props/` — standalone single-model fetches from Poly Pizza (not
  bundles). Currently just `barrel.glb` (CC0, Quaternius), **wired in** as the keg
  weapon's projectile and the map's decorative barrel.

Beer bottle and keg weapon projectiles (`weapons.js`) use `decorModels.js`'s
`beerBottle`/`kegBarrel` entries instead of procedural capsule/cylinder geometry —
`cloneDecorModel(key, height, tint)`'s third arg recolors per beer type (Blonde/
Kriek/Brune/Triple), which needs its own material clone since decor normally
shares one material across every instance of a template (see the function's
comment). A procedural fallback geometry stays in `weapons.js` for the brief
window before `decorModels.js` finishes loading, so the starter weapon never goes
silent at the very start of a run.

**Poly Pizza note**: unlike Kenney/Quaternius's own sites, Poly Pizza aggregates
models from many authors — licenses vary per model (CC0, CC-BY, sometimes paid).
Check each model's license line before fetching; don't assume CC0 just because
the search result looks free. Prefer results explicitly authored by Quaternius
(consistently CC0 site-wide) when there's a choice.

To find/install more, use the `asset-fetch` skill
(`.claude/skills/asset-fetch/SKILL.md`) — covers Kenney, Quaternius (including its
Google Drive-hosted kits), and itch.io, plus the file-download permission rule and
the animation-clip-selection lesson above in more detail.

## Audio

`audio.js` — Kenney Impact Sounds + UI Audio packs (`src/assets/kenney-impact-sounds/`,
`src/assets/kenney-ui-audio/`), played via plain `new Audio(url).play()` per
trigger (no Web Audio graph — no spatialization/mixing need here, and a fresh
element per play lets overlapping hits all sound instead of fighting over one
shared instance). Exports `playHit`/`playDeath`/`playPickup`/`playLevelUp`/
`playClick`, wired into `projectiles.js` (bullet-enemy hit), `enemies.js`
(death), `xp.js`/`tunas.js` (pickup), `upgrades.js` (level-up screen opening).
`playClick` is **not** wired individually into every button — `audio.js`
registers one `document`-level click listener matching `.btn, .pickCard, .card,
.shopCard`, covering menu/select/shop/upgrade buttons in one place. Add a new
button style class to that selector if a future UI element should click-sound too.

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

- **Start every session with `git pull`.** This repo has more than one person
  (with their own Claude Code sessions) pushing to it — pull first or you'll work
  from a stale tree and hit avoidable merge conflicts. Do this before reading
  code, planning, or editing anything.
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
- **Never add Claude/AI co-author attribution to commits** — no "Co-Authored-By:
  Claude", no "🤖 Generated with Claude Code" trailer, nothing. Commit as the human
  developer who's actually driving the session, full stop.
