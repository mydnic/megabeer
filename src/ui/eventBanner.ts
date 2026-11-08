const CSS = `
.event-banner { position: fixed; left: 50%; top: 104px; transform: translateX(-50%); z-index: 12; pointer-events: none;
  user-select: none; display: none; flex-direction: column; align-items: center; gap: 2px; white-space: nowrap;
  font-family: 'Lilita One', system-ui, sans-serif; }
.event-banner.on { display: flex; animation: event-in .35s cubic-bezier(.2,1.6,.4,1); }
.event-banner.off { display: flex; animation: event-out .4s ease-in forwards; }
.event-title { font-size: clamp(28px, 4.2vw, 52px); line-height: 1; letter-spacing: .04em; color: #ffc23a;
  text-shadow: -3px 0 #1a120c, 3px 0 #1a120c, 0 -3px #1a120c, 0 3px #1a120c, 3px 3px #1a120c, -3px 3px #1a120c,
    3px -3px #1a120c, -3px -3px #1a120c, 0 6px 0 #1a120c; }
.event-sub { font-size: 20px; color: #f3e6cf; letter-spacing: .03em;
  text-shadow: -2px 0 #1a120c, 2px 0 #1a120c, 0 -2px #1a120c, 0 2px #1a120c; }
.event-banner.toll .event-title { animation: event-toll .5s ease-out; }
@keyframes event-in { from { transform: translateX(-50%) scale(.4); opacity: 0 } to { transform: translateX(-50%) scale(1); opacity: 1 } }
@keyframes event-out { to { transform: translateX(-50%) translateY(-14px); opacity: 0 } }
@keyframes event-toll { 0% { transform: rotate(0) scale(1) } 25% { transform: rotate(-4deg) scale(1.1) }
  55% { transform: rotate(3deg) scale(1.03) } 100% { transform: rotate(0) scale(1) } }
`;

/**
 * Bandeau d'événement de run, sous le chrono (« Les cloches sonnent ! ») : apparaît, tremble à chaque
 * coup (`pulse`), puis s'efface.
 */
export function createEventBanner() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const el = document.createElement('div');
  el.className = 'event-banner';
  el.innerHTML = `<div class="event-title"></div><div class="event-sub"></div>`;
  document.body.appendChild(el);
  const title = el.querySelector<HTMLElement>('.event-title')!;
  const sub = el.querySelector<HTMLElement>('.event-sub')!;
  let timer = 0;

  const api = {
    show(text: string, subText: string) {
      clearTimeout(timer);
      title.textContent = text;
      sub.textContent = subText;
      el.className = 'event-banner on';
    },
    pulse() {
      el.classList.remove('toll');
      void el.offsetWidth;
      el.classList.add('toll');
    },
    /** Change le sous-titre, puis efface le bandeau après `delay` s. */
    hideAfter(delay: number, subText?: string) {
      if (subText !== undefined) sub.textContent = subText;
      clearTimeout(timer);
      timer = window.setTimeout(() => { el.className = 'event-banner off'; }, delay * 1000);
    },
    clear() { clearTimeout(timer); el.className = 'event-banner'; },
  };
  return api;
}
