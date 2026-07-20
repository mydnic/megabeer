// Simple fire-and-forget SFX — the game had zero audio before this. Uses plain
// HTMLAudioElement (new Audio() per play) rather than a Web Audio graph: no
// spatialization/mixing needs here, and a fresh element per play lets overlapping
// hits (e.g. a piercing keg) all sound without fighting over a shared instance.
import hit0 from './assets/kenney-impact-sounds/Audio/impactGlass_medium_000.ogg?url';
import hit1 from './assets/kenney-impact-sounds/Audio/impactGlass_medium_001.ogg?url';
import hit2 from './assets/kenney-impact-sounds/Audio/impactGlass_medium_002.ogg?url';
import hit3 from './assets/kenney-impact-sounds/Audio/impactGlass_medium_003.ogg?url';
import hit4 from './assets/kenney-impact-sounds/Audio/impactGlass_medium_004.ogg?url';
import death0 from './assets/kenney-impact-sounds/Audio/impactSoft_heavy_000.ogg?url';
import death1 from './assets/kenney-impact-sounds/Audio/impactSoft_heavy_001.ogg?url';
import death2 from './assets/kenney-impact-sounds/Audio/impactSoft_heavy_002.ogg?url';
import death3 from './assets/kenney-impact-sounds/Audio/impactSoft_heavy_003.ogg?url';
import death4 from './assets/kenney-impact-sounds/Audio/impactSoft_heavy_004.ogg?url';
import pickupUrl from './assets/kenney-ui-audio/Audio/click2.ogg?url';
import levelUpUrl from './assets/kenney-ui-audio/Audio/switch5.ogg?url';
import clickUrl from './assets/kenney-ui-audio/Audio/mouseclick1.ogg?url';

const HIT_URLS = [hit0, hit1, hit2, hit3, hit4];
const DEATH_URLS = [death0, death1, death2, death3, death4];

function play(url, volume) {
  const a = new Audio(url);
  a.volume = volume;
  a.play().catch(() => {}); // blocked until the user has interacted with the page — harmless no-op until then
}

function playRandom(urls, volume) {
  play(urls[Math.floor(Math.random() * urls.length)], volume);
}

export function playHit() { playRandom(HIT_URLS, 0.3); }
export function playDeath() { playRandom(DEATH_URLS, 0.35); }
export function playPickup() { play(pickupUrl, 0.2); }
export function playLevelUp() { play(levelUpUrl, 0.5); }
export function playClick() { play(clickUrl, 0.3); }

// One listener covers every menu/level-up/shop button instead of wiring
// playClick() into each individual onclick handler across menu.js/charSelect.js/
// upgrades.js/hud.js.
document.addEventListener('click', (e) => {
  if (e.target.closest('.btn, .pickCard, .card, .shopCard')) playClick();
});
