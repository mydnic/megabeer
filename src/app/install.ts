/**
 * Application installable (PWA, manifeste dans public/manifest.webmanifest) : enregistre le service worker (en prod
 * seulement), et montre un bouton « Installer l'appli » sur l'accueil quand le navigateur le propose. Installée, elle
 * s'ouvre en plein écran, en paysage, sans la barre d'adresse.
 */
const CSS = `
.install { position: absolute; top: 16px; right: 16px; z-index: 2; font-family: 'Lilita One', system-ui, sans-serif; font-size: 18px;
  letter-spacing: .04em; color: #2a1608; cursor: pointer; padding: 6px 18px 9px; border: 3px solid #1a120c; border-radius: 14px;
  background: linear-gradient(#ffd45a, #f5a623 60%, #e08a12); box-shadow: 0 4px 0 #1a120c; }
.install.off { display: none; }
`;

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function wireInstall(parent: HTMLElement) {
  if (import.meta.env.PROD && 'serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const btn = document.createElement('button');
  btn.className = 'install off';
  btn.textContent = "Installer l'appli";
  parent.appendChild(btn);
  let pending: InstallPrompt | null = null;
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    pending = e as InstallPrompt;
    btn.classList.remove('off');
  });
  addEventListener('appinstalled', () => btn.classList.add('off'));
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!pending) return;
    await pending.prompt();
    await pending.userChoice.catch(() => null);
    pending = null;
    btn.classList.add('off');
  });
  btn.addEventListener('keydown', (e) => { if (e.code === 'Space' || e.code === 'Enter') e.stopPropagation(); });
}
