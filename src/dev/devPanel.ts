/**
 * Panneau admin de développement (yarn dev seulement : importé dynamiquement derrière
 * import.meta.env.DEV, donc absent du build final). Volontairement sans style.
 * Le curseur est verrouillé en run : Échap (pause) pour cliquer dedans.
 */
export interface DevApi {
  models: readonly string[];
  spawn(model: string | 'mix', count: number, rMin: number, rMax: number): void;
  killAll(withXp: boolean): void;
  clearZombies(): void;
  setPassive(v: boolean): void;
  /** Arrivées automatiques de zombies (directeur de vagues). */
  setAutoSpawn(v: boolean): void;
  /** Avance le chrono de la run (la courbe de difficulté suit). */
  skipTime(seconds: number): void;
  /** Déclenche l'événement de la map tout de suite (Abbaye : les cloches). */
  triggerMapEvent(): void;
  difficulties: readonly { id: string; label: string }[];
  setDifficulty(id: string): void;
  giveXp(amount: number): void;
  levelUp(): void;
  heal(): void;
  giveCoins(amount: number): void;
  /** Pose une poubelle, ou un coffre piégé, devant le joueur. */
  placeBin(): void;
  placeTrap(): void;
  /** Lâche une clochette du Dernier service devant le joueur. */
  dropBell(): void;
  /** Tournées du bar : en lâcher une devant le joueur. */
  tournees: readonly string[];
  dropTournee(id: string): void;
  /** Armes qu'on peut donner, et donner l'une d'elles (si l'arsenal a une place). */
  weapons: readonly string[];
  giveWeapon(id: string): void;
  /** Objets de coffre qu'on peut donner, à la rareté choisie (index dans les raretés). */
  items: readonly string[];
  rarities: readonly string[];
  giveItem(id: string, rarity: number): void;
  die(): void;
  cheats: { god: boolean };
  toggleCombatMusic(): string;
  setTimeScale(k: number): void;
  status(): string;
  /** Une run est-elle en cours ? Les blocs Ennemis et Joueur ne marchent que pendant une run. */
  inRun(): boolean;
}

export function createDevPanel(api: DevApi) {
  const el = document.createElement('details');
  el.open = true;
  el.style.cssText = 'position:fixed;top:8px;right:8px;z-index:100;background:#fff;color:#000;font:12px monospace;padding:6px 8px;border:1px solid #000;max-width:260px;opacity:.92';
  el.innerHTML = `
    <summary style="cursor:pointer"><b>DEV</b> <span data-k="status"></span></summary>
    <fieldset data-run><legend>Ennemis</legend>
      <select data-k="model"><option value="mix">mélange</option>${api.models.map((m) => `<option>${m}</option>`).join('')}</select>
      x <input data-k="count" type="number" value="50" min="1" max="2000" style="width:5em">
      <br>distance <input data-k="rmin" type="number" value="15" style="width:3.5em"> à <input data-k="rmax" type="number" value="30" style="width:3.5em">
      <br><button data-a="spawn">Faire apparaître</button>
      <br><button data-a="killXp">Tuer tout (+XP)</button> <button data-a="clear">Effacer tout</button>
      <br><label><input data-k="passive" type="checkbox"> passifs</label> <label><input data-k="auto" type="checkbox" checked> vagues</label>
      <br>chrono <button data-a="skip60">+1 min</button> <button data-a="skip300">+5 min</button>
      <br><button data-a="bells">Cloches maintenant</button>
    </fieldset>
    <fieldset data-run><legend>Joueur</legend>
      <label><input data-k="god" type="checkbox"> godmode</label>
      <br><input data-k="xp" type="number" value="25" min="1" style="width:5em"> <button data-a="xp">+XP</button> <button data-a="level">+1 niveau</button>
      <br><select data-k="weapon">${api.weapons.map((w) => `<option>${w}</option>`).join('')}</select> <button data-a="weapon">Donner l'arme</button>
      <br><select data-k="item">${api.items.map((w) => `<option>${w}</option>`).join('')}</select> <select data-k="rarity">${api.rarities.map((r, i) => `<option value="${i}">${r}</option>`).join('')}</select> <button data-a="item">Donner l'objet</button>
      <br><button data-a="coins">+50 capsules</button>
      <br><button data-a="bin">Poubelle devant</button> <button data-a="trap">Coffre piégé devant</button>
      <br><button data-a="bell">Clochette devant</button>
      <br><select data-k="tournee">${api.tournees.map((w) => `<option>${w}</option>`).join('')}</select> <button data-a="tournee">Tournée devant</button>
      <br><button data-a="heal">Soigner</button> <button data-a="die">Mourir</button>
    </fieldset>
    <fieldset><legend>Monde</legend>
      difficulté <select data-k="diff">${api.difficulties.map((d) => `<option value="${d.id}">${d.label}</option>`).join('')}</select> (run suivante)<br>
      vitesse <select data-k="time"><option>0.1</option><option>0.25</option><option>0.5</option><option selected>1</option><option>2</option><option>4</option></select>
      <br><button data-a="music">Musique : run</button>
    </fieldset>`;
  document.body.appendChild(el);

  const q = <T extends HTMLElement>(k: string) => el.querySelector<T>(`[data-k="${k}"]`)!;
  const num = (k: string) => Number(q<HTMLInputElement>(k).value);
  const actions: Record<string, (b: HTMLButtonElement) => void> = {
    spawn: () => api.spawn(q<HTMLSelectElement>('model').value, num('count'), num('rmin'), num('rmax')),
    killXp: () => api.killAll(true),
    clear: () => api.clearZombies(),
    xp: () => api.giveXp(num('xp')),
    level: () => api.levelUp(),
    heal: () => api.heal(),
    coins: () => api.giveCoins(50),
    bin: () => api.placeBin(),
    trap: () => api.placeTrap(),
    bell: () => api.dropBell(),
    tournee: () => api.dropTournee(q<HTMLSelectElement>('tournee').value),
    weapon: () => api.giveWeapon(q<HTMLSelectElement>('weapon').value),
    item: () => api.giveItem(q<HTMLSelectElement>('item').value, num('rarity')),
    die: () => api.die(),
    skip60: () => api.skipTime(60),
    skip300: () => api.skipTime(300),
    bells: () => api.triggerMapEvent(),
    music: (b) => { b.textContent = `Musique : ${api.toggleCombatMusic()}`; },
  };
  for (const b of el.querySelectorAll<HTMLButtonElement>('button')) {
    b.addEventListener('click', (e) => { e.stopPropagation(); actions[b.dataset.a!](b); b.blur(); });
  }
  q<HTMLInputElement>('god').addEventListener('change', (e) => { api.cheats.god = (e.target as HTMLInputElement).checked; });
  q<HTMLInputElement>('passive').addEventListener('change', (e) => api.setPassive((e.target as HTMLInputElement).checked));
  q<HTMLInputElement>('auto').addEventListener('change', (e) => api.setAutoSpawn((e.target as HTMLInputElement).checked));
  q<HTMLSelectElement>('diff').addEventListener('change', (e) => api.setDifficulty((e.target as HTMLSelectElement).value));
  q<HTMLSelectElement>('time').addEventListener('change', (e) => api.setTimeScale(Number((e.target as HTMLSelectElement).value)));
  // Taper dans un champ ne pilote pas le jeu (sauf Échap)
  el.addEventListener('keydown', (e) => { if (e.code !== 'Escape') e.stopPropagation(); });
  // Le panneau ne déclenche ni le verrouillage du curseur ni le démarrage de l'audio
  el.addEventListener('pointerdown', (e) => e.stopPropagation());

  const status = q('status');
  const runOnly = [...el.querySelectorAll<HTMLFieldSetElement>('fieldset[data-run]')];
  const refresh = () => {
    status.textContent = api.status();
    const off = !api.inRun();
    for (const f of runOnly) f.disabled = off;
  };
  refresh();
  setInterval(refresh, 250);
}
