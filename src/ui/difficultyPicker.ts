import { DIFFICULTIES, type DifficultyId } from '../config/spawn';

const CSS = `
.diff { position: relative; z-index: 1; display: flex; gap: 10px; margin-bottom: -1vh; font-family: 'Lilita One', system-ui, sans-serif; }
.diff button { font: inherit; font-size: 18px; letter-spacing: .04em; cursor: pointer; padding: 5px 16px 7px; border: 3px solid #1a120c;
  border-radius: 14px; color: #f3e6cf; background: rgba(42,22,8,.75); box-shadow: 0 4px 0 #1a120c; transition: transform .08s; }
.diff button.on { color: #2a1608; background: linear-gradient(#ffd45a, #f5a623 60%, #e08a12); }
.diff button.locked { opacity: .5; cursor: default; }
.diff button:hover:not(.locked), .diff button:focus-visible { transform: scale(1.06); outline: none; }
.diff-hint { position: relative; z-index: 1; min-height: 18px; margin-top: -2vh; font-size: 14px; color: #f3e6cf; opacity: .75;
  font-family: 'Lilita One', system-ui, sans-serif; }
`;

const ORDER = Object.keys(DIFFICULTIES) as DifficultyId[];

/**
 * Choix de la difficulté sur l'accueil (Sobre, Pompette, Bourré). Une difficulté se débloque en tuant l'Abbé dans la
 * précédente ; celles encore fermées sont grisées, avec ce qu'il faut faire pour les ouvrir.
 */
export function createDifficultyPicker(parent: HTMLElement, before: Element, onPick: (id: DifficultyId) => void) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const row = document.createElement('div');
  row.className = 'diff';
  const hint = document.createElement('div');
  hint.className = 'diff-hint';
  parent.insertBefore(row, before);
  parent.insertBefore(hint, before);
  let unlocked: readonly DifficultyId[] = ['sobre'], selected: DifficultyId = 'sobre';

  function render() {
    row.innerHTML = ORDER.map((id) => `<button data-d="${id}" class="${id === selected ? 'on' : ''}${unlocked.includes(id) ? '' : ' locked'}">${DIFFICULTIES[id].label}</button>`).join('');
    const next = ORDER.find((id) => !unlocked.includes(id));
    hint.textContent = next ? `${DIFFICULTIES[next].label} : tue l'Abbé en ${DIFFICULTIES[ORDER[ORDER.indexOf(next) - 1]].label}` : '';
    for (const b of row.querySelectorAll<HTMLButtonElement>('button')) {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = b.dataset.d as DifficultyId;
        if (!unlocked.includes(id)) return;
        selected = id;
        onPick(id);
        render();
        row.querySelector<HTMLElement>(`[data-d="${id}"]`)?.focus({ preventScroll: true });
      });
      b.addEventListener('keydown', (e) => { if (e.code === 'Space' || e.code === 'Enter') e.stopPropagation(); });
    }
  }

  return {
    get selected() { return selected; },
    /** Difficultés ouvertes, et celle choisie (gardée si elle reste ouverte). */
    update(open: readonly DifficultyId[], choice: DifficultyId) {
      unlocked = open;
      selected = open.includes(choice) ? choice : 'sobre';
      render();
    },
  };
}
