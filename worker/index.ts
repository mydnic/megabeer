/**
 * Le Worker Cloudflare de Megabeer : sert le jeu (fichiers statiques) et, sous /api, les comptes.
 *
 * - GET  /api/auth/discord   : part se connecter chez Discord (scope identify : pseudo et avatar, rien d'autre).
 * - GET  /api/auth/callback  : retour de Discord ; crée ou met à jour le joueur, ouvre une session (cookie).
 * - POST /api/auth/email     : envoie un lien de connexion à usage unique à l'adresse donnée (Cloudflare Email Service).
 * - GET  /api/auth/email/link : page du lien reçu, avec un bouton qui confirme (les antivirus de messagerie ouvrent les
 *                               liens tout seuls : la connexion ne se fait qu'au clic, en POST).
 * - POST /api/auth/email/link : confirme le lien ; crée le joueur au besoin et ouvre une session.
 * - GET  /api/me             : le joueur connecté (ou null), et quelles connexions sont configurées.
 * - POST /api/logout         : ferme la session.
 * - GET  /api/save           : la progression sauvegardée du joueur connecté, ou null.
 * - PUT  /api/save           : remplace la progression (JSON, taille bornée).
 * - POST /api/score          : fin de run d'un joueur connecté ; garde sa meilleure (le plus de kills).
 * - GET  /api/leaderboard    : les 10 meilleures runs, tous joueurs confondus.
 *
 * Secrets (jamais dans le dépôt) : DISCORD_CLIENT_SECRET (`wrangler secret put`, en local dans .dev.vars).
 * Emails : binding EMAIL (send_email) et MAIL_FROM, une adresse d'un domaine onboardé dans Cloudflare Email Service
 * (envoi à n'importe quelle adresse : offre Workers Paid). En local, wrangler simule l'envoi (le mail est écrit dans la console).
 */

interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  DISCORD_CLIENT_ID: string;
  DISCORD_CLIENT_SECRET: string;
  /** Envoi d'emails (Cloudflare Email Service, binding send_email de wrangler.jsonc). */
  EMAIL?: { send(m: { from: string | { email: string; name?: string }; to: string; subject: string; html?: string; text?: string }): Promise<{ messageId: string }> };
  MAIL_FROM?: string;
}

const SESSION_COOKIE = 'mb_session';
const STATE_COOKIE = 'mb_oauth_state';
const SESSION_DAYS = 90;
const MAX_SAVE_BYTES = 64 * 1024;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      return await route(request, url, env);
    } catch (e) {
      console.error('[api]', e);
      return json({ error: 'erreur serveur' }, 500);
    }
  },
} satisfies ExportedHandler<Env>;

async function route(request: Request, url: URL, env: Env): Promise<Response> {
  const path = url.pathname, method = request.method;
  if (path === '/api/auth/discord' && method === 'GET') return startLogin(url, env);
  if (path === '/api/auth/callback' && method === 'GET') return finishLogin(request, url, env);
  if (path === '/api/me' && method === 'GET') {
    const user = await currentUser(request, env);
    return json({ user: user && publicUser(user), login: !!(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET), emailLogin: mailReady(env) });
  }
  if (path === '/api/auth/email' && method === 'POST') return sendMagicLink(request, url, env);
  if (path === '/api/auth/email/link' && method === 'GET') return magicLinkPage(url);
  if (path === '/api/auth/email/link' && method === 'POST') return finishMagicLink(request, url, env);
  if (path === '/api/logout' && method === 'POST') return logout(request, env);
  if (path === '/api/save') {
    const user = await currentUser(request, env);
    if (!user) return json({ error: 'non connecté' }, 401);
    if (method === 'GET') {
      const row = await env.DB.prepare('SELECT data, updated_at FROM saves WHERE user_id = ?').bind(user.id).first<{ data: string; updated_at: number }>();
      return json({ save: row ? { data: JSON.parse(row.data), updatedAt: row.updated_at } : null });
    }
    if (method === 'PUT') {
      const body = await request.text();
      if (body.length > MAX_SAVE_BYTES) return json({ error: 'sauvegarde trop grosse' }, 413);
      let data: unknown;
      try { data = JSON.parse(body).data; } catch { return json({ error: 'JSON invalide' }, 400); }
      if (!data || typeof data !== 'object') return json({ error: 'données manquantes' }, 400);
      const now = Date.now();
      await env.DB.prepare('INSERT INTO saves (user_id, data, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(user_id) DO UPDATE SET data = ?2, updated_at = ?3')
        .bind(user.id, JSON.stringify(data), now).run();
      return json({ ok: true, updatedAt: now });
    }
  }
  if (path === '/api/score' && method === 'POST') return postScore(request, env);
  if (path === '/api/leaderboard' && method === 'GET') return leaderboard(request, env);
  return json({ error: 'introuvable' }, 404);
}

// --- Leaderboard : le plus de zombies tués en une run

/** Bornes d'une run crédible (le score vient du navigateur : entre potes, on écarte juste l'absurde). */
const SCORE_MAX = { kills: 200_000, survived: 4 * 3600 };
const LEADERBOARD_SIZE = 10;

async function postScore(request: Request, env: Env) {
  const user = await currentUser(request, env);
  if (!user) return json({ error: 'non connecté' }, 401);
  let b: { kills?: unknown; survived?: unknown; difficulty?: unknown; character?: unknown };
  try { b = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }
  const kills = Math.floor(Number(b.kills)), survived = Number(b.survived);
  if (!Number.isFinite(kills) || kills < 0 || kills > SCORE_MAX.kills || !Number.isFinite(survived) || survived < 0 || survived > SCORE_MAX.survived) {
    return json({ error: 'score invalide' }, 400);
  }
  const difficulty = String(b.difficulty ?? 'sobre').slice(0, 20), character = String(b.character ?? 'buveur').slice(0, 20);
  // Remplacé seulement s'il bat le record du joueur (plus de kills, ou autant mais tenu plus longtemps)
  await env.DB.prepare(`INSERT INTO scores (user_id, kills, survived, difficulty, character, at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
    ON CONFLICT(user_id) DO UPDATE SET kills = ?2, survived = ?3, difficulty = ?4, character = ?5, at = ?6
    WHERE ?2 > scores.kills OR (?2 = scores.kills AND ?3 > scores.survived)`)
    .bind(user.id, kills, survived, difficulty, character, Date.now()).run();
  return json({ ok: true });
}

async function leaderboard(request: Request, env: Env) {
  const me = await currentUser(request, env);
  const rows = await env.DB.prepare(`SELECT u.id, u.name, u.avatar, s.kills, s.survived, s.difficulty, s.character
    FROM scores s JOIN users u ON u.id = s.user_id ORDER BY s.kills DESC, s.survived DESC LIMIT ?`).bind(LEADERBOARD_SIZE)
    .all<User & { kills: number; survived: number; difficulty: string; character: string }>();
  return json({
    entries: rows.results.map((r, i) => ({ rank: i + 1, ...publicUser(r), kills: r.kills, survived: r.survived, difficulty: r.difficulty, character: r.character, me: r.id === me?.id })),
  });
}

// --- Connexion Discord (OAuth2, code d'autorisation)

const redirectUri = (url: URL) => `${url.origin}/api/auth/callback`;

function startLogin(url: URL, env: Env) {
  if (!env.DISCORD_CLIENT_ID) return json({ error: 'connexion Discord pas configurée' }, 503);
  const state = randomToken();
  const q = new URLSearchParams({ client_id: env.DISCORD_CLIENT_ID, redirect_uri: redirectUri(url), response_type: 'code', scope: 'identify', state, prompt: 'none' });
  return new Response(null, {
    status: 302,
    headers: { Location: `https://discord.com/oauth2/authorize?${q}`, 'Set-Cookie': cookie(STATE_COOKIE, state, 600, url) },
  });
}

async function finishLogin(request: Request, url: URL, env: Env) {
  const code = url.searchParams.get('code'), state = url.searchParams.get('state');
  const expected = readCookie(request, STATE_COOKIE);
  // Refus du joueur, lien rejoué ou forgé : retour au jeu sans connexion
  if (!code || !state || !expected || state !== expected) return backToGame(url, 'connexion annulée');
  const token = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env.DISCORD_CLIENT_ID, client_secret: env.DISCORD_CLIENT_SECRET, grant_type: 'authorization_code', code, redirect_uri: redirectUri(url) }),
  });
  if (!token.ok) { console.error('[auth] token', token.status, await token.text()); return backToGame(url, 'connexion refusée par Discord'); }
  const { access_token } = await token.json<{ access_token: string }>();
  const me = await fetch('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${access_token}` } });
  if (!me.ok) return backToGame(url, 'profil Discord illisible');
  const d = await me.json<{ id: string; username: string; global_name: string | null; avatar: string | null }>();
  const now = Date.now();
  await env.DB.prepare('INSERT INTO users (id, name, avatar, created_at, last_login) VALUES (?1, ?2, ?3, ?4, ?4) ON CONFLICT(id) DO UPDATE SET name = ?2, avatar = ?3, last_login = ?4')
    .bind(d.id, d.global_name || d.username, d.avatar, now).run();
  return openSession(d.id, url, env);
}

/** Ouvre une session pour le joueur (cookie) et revient au jeu. */
async function openSession(userId: string, url: URL, env: Env) {
  const session = randomToken();
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(await sha256(session), userId, Date.now() + SESSION_DAYS * 86400e3).run();
  const headers = new Headers({ Location: '/' });
  headers.append('Set-Cookie', cookie(SESSION_COOKIE, session, SESSION_DAYS * 86400, url));
  headers.append('Set-Cookie', cookie(STATE_COOKIE, '', 0, url));
  return new Response(null, { status: 302, headers });
}

// --- Connexion par email (lien magique, envoyé par Cloudflare Email Service)

const MAIL = { linkMinutes: 15, maxPending: 3 };
const mailReady = (env: Env) => !!(env.EMAIL && env.MAIL_FROM);
const EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i;
const escHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const html = (body: string) => new Response(body, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });

async function sendMagicLink(request: Request, url: URL, env: Env) {
  if (!mailReady(env)) return json({ error: 'connexion par email pas configurée' }, 503);
  let b: { email?: unknown; name?: unknown };
  try { b = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }
  const email = String(b.email ?? '').trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) return json({ error: 'adresse invalide' }, 400);
  const name = String(b.name ?? '').replace(/[\p{C}<>]/gu, '').trim().slice(0, 24);
  if (name.length < 2) return json({ error: 'choisis un pseudo (2 caractères au moins)' }, 400);
  const now = Date.now();
  await env.DB.prepare('DELETE FROM email_logins WHERE expires_at < ?').bind(now).run();
  // Pas plus de quelques liens en attente par adresse (on n'inonde pas une boîte mail)
  const pending = await env.DB.prepare('SELECT COUNT(*) AS n FROM email_logins WHERE email = ?').bind(email).first<{ n: number }>();
  if ((pending?.n ?? 0) >= MAIL.maxPending) return json({ error: 'trop de liens envoyés : regarde tes mails, ou réessaie dans quelques minutes' }, 429);
  const token = randomToken();
  await env.DB.prepare('INSERT INTO email_logins (token_hash, email, name, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256(token), email, name, now + MAIL.linkMinutes * 60e3).run();
  const link = `${url.origin}/api/auth/email/link?token=${token}`;
  try {
    await env.EMAIL!.send({
      from: { email: env.MAIL_FROM!, name: 'Megabeer' }, to: email, subject: 'Ton lien de connexion à Megabeer',
      html: `<p>Salut !</p><p>Clique ici pour te connecter à Megabeer (lien valable ${MAIL.linkMinutes} minutes, une seule fois) :</p>`
        + `<p><a href="${link}" style="font-size:18px">Me connecter</a></p><p>Si tu n'as rien demandé, ignore ce mail.</p>`,
      text: `Ton lien de connexion à Megabeer (valable ${MAIL.linkMinutes} minutes, une seule fois) : ${link}`,
    });
  } catch (e) {
    const code = (e as { code?: string }).code;
    console.error('[mail]', code, (e as Error).message);
    await env.DB.prepare('DELETE FROM email_logins WHERE token_hash = ?').bind(await sha256(token)).run();
    if (code === 'E_RATE_LIMIT_EXCEEDED' || code === 'E_DAILY_LIMIT_EXCEEDED') return json({ error: 'trop de mails envoyés aujourd\'hui, réessaie plus tard' }, 429);
    return json({ error: "l'email n'a pas pu partir" }, 502);
  }
  return json({ ok: true });
}

function magicLinkPage(url: URL) {
  const token = url.searchParams.get('token') ?? '';
  return html(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Megabeer</title>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#2a170b;font-family:system-ui,sans-serif;color:#f3e6cf">
<form method="post" style="text-align:center"><h1 style="color:#ffc93a">Megabeer</h1><input type="hidden" name="token" value="${escHtml(token)}">
<button style="font-size:22px;padding:12px 36px;border:4px solid #1a120c;border-radius:18px;background:#f5a623;color:#2a1608;cursor:pointer">Me connecter</button></form></body>`);
}

async function finishMagicLink(request: Request, url: URL, env: Env) {
  const form = await request.formData().catch(() => null);
  const token = String(form?.get('token') ?? '');
  if (!token) return backToGame(url, 'lien invalide');
  const hash = await sha256(token);
  const row = await env.DB.prepare('SELECT email, name, expires_at FROM email_logins WHERE token_hash = ?').bind(hash).first<{ email: string; name: string; expires_at: number }>();
  const now = Date.now();
  if (!row || row.expires_at < now) {
    await env.DB.prepare('DELETE FROM email_logins WHERE token_hash = ?').bind(hash).run();
    return backToGame(url, 'lien expiré ou déjà utilisé, redemande-en un');
  }
  // Usage unique : tous les liens en attente pour cette adresse tombent
  await env.DB.prepare('DELETE FROM email_logins WHERE email = ?').bind(row.email).run();
  const id = `mail:${(await sha256(row.email)).slice(0, 32)}`;
  // Le pseudo n'est posé qu'à la création du compte (l'adresse, elle, n'est jamais affichée ni gardée dans users)
  await env.DB.prepare('INSERT INTO users (id, name, avatar, created_at, last_login) VALUES (?1, ?2, NULL, ?3, ?3) ON CONFLICT(id) DO UPDATE SET last_login = ?3')
    .bind(id, row.name, now).run();
  return openSession(id, url, env);
}

async function logout(request: Request, env: Env) {
  const token = readCookie(request, SESSION_COOKIE);
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run();
  return json({ ok: true }, 200, { 'Set-Cookie': cookie(SESSION_COOKIE, '', 0, new URL(request.url)) });
}

// --- Sessions

type User = { id: string; name: string; avatar: string | null };

async function currentUser(request: Request, env: Env): Promise<User | null> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  return env.DB.prepare('SELECT u.id, u.name, u.avatar FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?')
    .bind(await sha256(token), Date.now()).first<User>();
}

/** Le joueur tel que le jeu le voit ; avatar Discord (ou celui par défaut), aucun pour un compte email. */
const publicUser = (u: User) => ({
  id: u.id,
  name: u.name,
  avatarUrl: /^\d+$/.test(u.id)
    ? u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=64` : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(u.id) >> 22n) % 6}.png`
    : null,
});

// --- Outils

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });
}

function backToGame(url: URL, reason: string) {
  return new Response(null, { status: 302, headers: { Location: `/?connexion=${encodeURIComponent(reason)}`, 'Set-Cookie': cookie(STATE_COOKIE, '', 0, url) } });
}

/** Cookie de session : inaccessible au JavaScript de la page, envoyé seulement au même site. */
function cookie(name: string, value: string, maxAge: number, url: URL) {
  const secure = url.protocol === 'https:' ? '; Secure' : '';
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function readCookie(request: Request, name: string) {
  for (const part of (request.headers.get('Cookie') ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

function randomToken() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256(s: string) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
