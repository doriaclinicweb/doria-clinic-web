/**
 * Puente de login del CMS (Cloudflare Worker `sveltia-cms-auth`).
 *
 * Sveltia CMS abre `/auth` en una ventana emergente y espera recibir un token de
 * GitHub por `postMessage`. Este worker admite dos modos:
 *
 * - Modo Google (si están definidas GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
 *   GITHUB_TOKEN y ALLOWED_EMAILS): la persona entra con su cuenta de Google; si su
 *   correo está en ALLOWED_EMAILS, el worker entrega al panel el GITHUB_TOKEN de la
 *   clínica. Nadie necesita cuenta de GitHub.
 * - Modo GitHub (si falta alguna de esas variables): OAuth clásico con
 *   GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET, como el worker original sveltia-cms-auth.
 *
 * Variables:
 *   ALLOWED_DOMAINS        Dominios desde los que se puede abrir el panel (admite `*`).
 *   ALLOWED_EMAILS         Correos de Google con acceso, separados por comas.
 *   GOOGLE_CLIENT_ID       Cliente OAuth de Google (tipo «Aplicación web»).
 *   GOOGLE_CLIENT_SECRET   (secret)
 *   GITHUB_TOKEN           (secret) Token fine-grained limitado a este repositorio, Contents: lectura y escritura.
 *   GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET  Solo para el modo GitHub.
 *
 * URI de redirección autorizada en Google: https://<este-worker>/callback
 */

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getDomainPatterns = (allowed) =>
  (allowed ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => `^${escapeRegExp(s).replaceAll('\\*', '.+')}$`);

const serialize = (value) => JSON.stringify(value ?? null).replaceAll('<', '\\u003c');

const googleMode = (env) =>
  Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GITHUB_TOKEN && env.ALLOWED_EMAILS);

/** Respuesta HTML que devuelve el resultado (token o error) a la ventana del panel. */
const outputHTML = ({ token, error, errorCode, env = {} }) => {
  const provider = 'github';
  const state = error ? 'error' : 'success';
  const content = error ? { provider, error, errorCode } : { provider, token };

  return new Response(
    `<!doctype html><html><body><script>
(() => {
  const trustedPatterns = ${serialize(getDomainPatterns(env.ALLOWED_DOMAINS))};
  const hasToken = ${serialize(!!token)};
  const isTrusted = (origin) => {
    try {
      const { hostname } = new URL(origin);
      return trustedPatterns.some((p) => new RegExp(p).test(hostname));
    } catch {
      return false;
    }
  };
  window.addEventListener('message', ({ data, origin }) => {
    if (data !== 'authorizing:${provider}') return;
    // El origen lo fija el navegador y no se puede falsificar: solo entregamos el
    // token a los dominios autorizados. Un error no lleva secreto, se entrega siempre.
    if (hasToken && trustedPatterns.length && !isTrusted(origin)) return;
    window.opener?.postMessage(
      'authorization:${provider}:${state}:${JSON.stringify(content)}',
      origin
    );
  });
  window.opener?.postMessage('authorizing:${provider}', '*');
})();
</script></body></html>`,
    {
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
        'Set-Cookie': 'csrf-token=deleted; HttpOnly; Max-Age=0; Path=/; SameSite=Lax; Secure',
        'Cache-Control': 'no-store',
      },
    },
  );
};

const handleAuth = async (request, env) => {
  const { origin, searchParams } = new URL(request.url);
  const { provider, site_id: domain } = Object.fromEntries(searchParams);

  if (provider !== 'github') {
    return outputHTML({ env, error: 'Your Git backend is not supported by the authenticator.', errorCode: 'UNSUPPORTED_BACKEND' });
  }

  const patterns = getDomainPatterns(env.ALLOWED_DOMAINS);
  if (patterns.length && !patterns.some((p) => new RegExp(p).test(domain ?? ''))) {
    return outputHTML({ env, error: 'Your domain is not allowed to use the authenticator.', errorCode: 'UNSUPPORTED_DOMAIN' });
  }

  const csrf = crypto.randomUUID().replaceAll('-', '');
  let authURL;
  let mode;

  if (googleMode(env)) {
    mode = 'google';
    authURL = `${GOOGLE_AUTH_URL}?${new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: `${origin}/callback`,
      response_type: 'code',
      scope: 'openid email',
      state: csrf,
      prompt: 'select_account',
    })}`;
  } else {
    mode = 'github';
    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
      return outputHTML({ env, error: 'OAuth app client ID or secret is not configured.', errorCode: 'MISCONFIGURED_CLIENT' });
    }
    authURL = `https://github.com/login/oauth/authorize?${new URLSearchParams({
      client_id: env.GITHUB_CLIENT_ID,
      scope: 'repo,user',
      state: csrf,
    })}`;
  }

  return new Response('', {
    status: 302,
    headers: {
      Location: authURL,
      'Set-Cookie': `csrf-token=${mode}_${csrf}; HttpOnly; Path=/; Max-Age=600; SameSite=Lax; Secure`,
    },
  });
};

/** Lee el payload de un id_token recibido directamente de Google por TLS con nuestro secret. */
const decodeIdToken = (idToken) => {
  const payload = idToken.split('.')[1].replaceAll('-', '+').replaceAll('_', '/');
  const bytes = Uint8Array.from(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
};

const handleCallback = async (request, env) => {
  const { origin, searchParams } = new URL(request.url);
  const { code, state } = Object.fromEntries(searchParams);
  const [, mode, csrf] = request.headers.get('Cookie')?.match(/\bcsrf-token=(github|google)_([0-9a-f]{32})\b/) ?? [];

  if (!mode) {
    return outputHTML({ env, error: 'Your Git backend is not supported by the authenticator.', errorCode: 'UNSUPPORTED_BACKEND' });
  }
  if (!code || !state) {
    return outputHTML({ env, error: 'Failed to receive an authorization code. Please try again later.', errorCode: 'AUTH_CODE_REQUEST_FAILED' });
  }
  if (!csrf || state !== csrf) {
    return outputHTML({ env, error: 'Potential CSRF attack detected. Authentication flow aborted.', errorCode: 'CSRF_DETECTED' });
  }

  if (mode === 'google') {
    if (!googleMode(env)) {
      return outputHTML({ env, error: 'OAuth app client ID or secret is not configured.', errorCode: 'MISCONFIGURED_CLIENT' });
    }
    let data;
    try {
      const res = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: env.GOOGLE_CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET,
          redirect_uri: `${origin}/callback`,
          grant_type: 'authorization_code',
        }),
      });
      data = await res.json();
    } catch {
      return outputHTML({ env, error: 'Failed to request an access token. Please try again later.', errorCode: 'TOKEN_REQUEST_FAILED' });
    }
    if (!data?.id_token) {
      return outputHTML({ env, error: data?.error ?? 'Google did not return an identity token.', errorCode: 'MALFORMED_RESPONSE' });
    }

    let claims;
    try {
      claims = decodeIdToken(data.id_token);
    } catch {
      return outputHTML({ env, error: 'Server responded with malformed data. Please try again later.', errorCode: 'MALFORMED_RESPONSE' });
    }

    const email = String(claims.email ?? '').toLowerCase();
    const permitidos = env.ALLOWED_EMAILS.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
    const valido =
      claims.aud === env.GOOGLE_CLIENT_ID &&
      ['https://accounts.google.com', 'accounts.google.com'].includes(claims.iss) &&
      claims.email_verified === true &&
      permitidos.includes(email);

    if (!valido) {
      return outputHTML({
        env,
        error: `La cuenta de Google ${email || 'seleccionada'} no tiene permiso para editar la web.`,
        errorCode: 'ACCOUNT_NOT_ALLOWED',
      });
    }
    return outputHTML({ env, token: env.GITHUB_TOKEN });
  }

  // Modo GitHub (OAuth clásico)
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return outputHTML({ env, error: 'OAuth app client ID or secret is not configured.', errorCode: 'MISCONFIGURED_CLIENT' });
  }
  let response;
  try {
    response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET }),
    });
  } catch {
    return outputHTML({ env, error: 'Failed to request an access token. Please try again later.', errorCode: 'TOKEN_REQUEST_FAILED' });
  }
  try {
    const { access_token: token, error } = await response.json();
    return outputHTML({ env, token, error });
  } catch {
    return outputHTML({ env, error: 'Server responded with malformed data. Please try again later.', errorCode: 'MALFORMED_RESPONSE' });
  }
};

export default {
  async fetch(request, env) {
    const { method } = request;
    const { pathname } = new URL(request.url);

    if (method === 'GET' && ['/auth', '/oauth/authorize'].includes(pathname)) return handleAuth(request, env);
    if (method === 'GET' && ['/callback', '/oauth/redirect'].includes(pathname)) return handleCallback(request, env);
    return new Response('', { status: 404 });
  },
};
