---
name: asset-fetch
description: Search for and install free/CC0 3D model or texture asset packs from Kenney, Quaternius, or itch.io into src/assets/. Use when asked to find, download, or add 3D models/game assets to this project.
---

# Asset Fetch

Procedure for finding and installing 3D assets into this project. Downloads are
external files — the standard file-download permission rule always applies: state
filename, source, and size, and get explicit user confirmation **before** running
the actual download command. Searching/browsing/checking file size (HEAD request)
needs no permission; fetching the bytes does.

## Supported sources

### Kenney.nl
- Search: `WebSearch` for `site:kenney.nl <keyword>`, or browse
  `https://kenney.nl/assets?q=<keyword>` / `https://kenney.nl/assets/category:3D`.
- Pack page shows tags, license (almost always CC0), file count, category.
- The real download URL is **not** in the page HTML — it's behind a donation-prompt
  modal, revealed only after clicking through:
  1. `find` the "Download" link on the pack page, click it (opens a donation modal —
     this does not download anything).
  2. `find` "Continue without donating...", then `read_page` on that ref to read its
     `href` (the actual zip URL). Do **not** click it — clicking triggers the real
     download.
  3. `curl -sIL <url> | grep -i content-length` to get the size without downloading.
  4. State filename/source/size to the user, wait for confirmation.
  5. `curl -sL -o /tmp/<name>.zip <url>`, then unzip into
     `src/assets/kenney-<pack-slug>/`.
- Format varies by series — check the extracted files, don't assume. The "Animated
  Characters" series ships **FBX only**: one shared rig (`Model/*.fbx`) + separate
  skin textures (`Skins/*.png`, e.g. `zombieA.png`) + separate per-animation FBX
  clips (`Animations/idle.fbx`, `run.fbx`, ...). Static prop packs are often
  glTF/GLB instead.
- Strip promotional cruft after extracting: `*.url` shortcut files (`Visit
  Kenney.url`, `Visit Patreon.url`). Keep `License.txt`.

### Quaternius (quaternius.com)
- Same shape: pack pages list a direct download. License is CC0 site-wide but
  confirm and quote it from the actual page.
- The "Download" button is a JS-driven `<button>`, not a link with an `href` —
  `WebFetch`/raw HTML won't reveal a URL. Some packs route through itch.io, but
  larger multi-format kits (e.g. Zombie Apocalypse Kit) route through a **Google
  Drive shared folder** instead: clicking "Download" → "Just give me the Download"
  opens a new tab straight to `drive.google.com/drive/folders/...`.
- When it's a Drive folder: browse into the format you want (glTF is usually best —
  self-contained single-file per model, embedded textures + named animation clips,
  avoids the multi-clip-selection footguns FBX has, see below). Files are
  individually browsable/downloadable, no need to grab the whole kit — select just
  the models needed (shift-click in the file list), right-click → "Télécharger"
  (or the Drive UI's language-equivalent "Download"). Multi-file selections get
  zipped server-side by Drive before download starts — wait for "Download ready"
  before checking `~/Downloads/`.
- This is a real browser-triggered download landing in the user's actual
  `~/Downloads/` folder (claude-in-chrome shares their real Chrome profile) — still
  needs the same permission-before-downloading confirmation as a curl fetch, even
  though the mechanism is a UI click instead of a shell command. State what's about
  to be selected/downloaded and get confirmation first. After download, `unzip`
  from `~/Downloads/` into `src/assets/...`, then delete the zip from Downloads to
  avoid leaving stray files in the user's real folder.

### itch.io
- Search: `https://itch.io/game-assets/tag-<tag>` (e.g. `tag-zombies`,
  `tag-low-poly`).
- License **varies per creator** — read the specific page, never assume CC0. Some
  packs are paid; stop and tell the user, don't attempt to download those.
- Free packs: download link resolves through itch.io's JS-driven download flow —
  use the same find-the-link → `read_page` for `href` → confirm → curl approach as
  Kenney.

### Sketchfab
- Downloads require an authenticated Sketchfab account (OAuth) — not reachable via
  anonymous curl/browser in this environment. Tell the user to download manually
  and hand you the file (or drop it in `src/assets/` themselves); don't attempt an
  automated download here.

## Install convention

- Extract into `src/assets/<source>-<pack-slug>/`, e.g.
  `src/assets/kenney-animated-characters-survivors/`.
- Keep the pack's own license file if present; otherwise write a one-line
  `LICENSE.txt` noting the source URL and license terms.
- Delete non-asset cruft (social/donation shortcut files, redundant screenshots)
  but keep a preview image if it helps identify variants at a glance.
- Fetching/staging an asset is not the same as wiring it into game code — report
  what was found (formats present, whether animations are included, which variant
  matches what was asked for, e.g. a "zombie" skin) and let the user decide the
  integration step separately.
- Never commit automatically. Staging files in `src/assets/` is not a request to
  `git add`/`git commit` — only do that if explicitly asked.

## Loading in three.js (once asked to integrate, not part of fetching)

- glTF/GLB → `GLTFLoader` from `three/examples/jsm/loaders/GLTFLoader.js` — ships
  with the `three` npm package already installed here, no new dependency needed.
- FBX → `FBXLoader` from `three/examples/jsm/loaders/FBXLoader.js` — same, already
  available.
- Kenney's rig + separate-animation-clip FBX structure: load the character FBX
  once, load each animation FBX separately, and play its `AnimationClip` on an
  `AnimationMixer` bound to the character's skeleton — they share bone
  names/hierarchy by construction within one Kenney character series, so this
  retargeting works without extra setup.
- **Never pick `loadedObject.animations[0]` blindly.** A single FBX/glTF can bundle
  multiple clips — e.g. Kenney's `run.fbx` actually contains two: a 2-keyframe
  "Targeting Pose" reference (index 0, effectively a frozen T-pose) and the real
  17-keyframe "Run" cycle (index 1). Taking index 0 silently froze every zombie in
  a T-pose with no error anywhere. Log `.animations.map(a => a.name)` after loading
  and pick by name (`animations.find(c => /run/i.test(c.name))`), or at minimum
  eyeball the result in-browser before assuming it's right — a wrong pick fails
  silent, not loud. glTF packs with cleanly named clips (Quaternius: `Run`, `Walk`,
  `Death`, `Crawl`, ...) are far less error-prone here than FBX packs that split
  "reference pose" and "real animation" across clips with similar names.
