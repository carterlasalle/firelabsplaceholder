// Validates the submitted password against process.env.SITE_PASSWORD and,
// on success, sets a signed session cookie (HMAC'd with process.env.SESSION_SECRET).
// Runs on the Edge runtime so it shares the Web Crypto API used by middleware.js.
export const config = { runtime: 'edge' };

const COOKIE_NAME = 'site_auth';
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const password = process.env.SITE_PASSWORD;
  const secret = process.env.SESSION_SECRET;
  if (!password || !secret) {
    return new Response(
      'Server is missing SITE_PASSWORD or SESSION_SECRET configuration.',
      { status: 500 }
    );
  }

  const form = await request.formData();
  const submitted = String(form.get('password') || '');
  const redirectTo = safeRedirect(form.get('redirect'));

  if (!timingSafeEqual(submitted, password)) {
    const failUrl = new URL('/login.html', request.url);
    failUrl.searchParams.set('error', '1');
    failUrl.searchParams.set('redirect', redirectTo);
    return new Response(null, { status: 302, headers: { Location: failUrl.toString() } });
  }

  const exp = Date.now() + SESSION_DURATION_MS;
  const token = `${exp}.${await sign(String(exp), secret)}`;

  const response = new Response(null, {
    status: 302,
    headers: { Location: new URL(redirectTo, request.url).toString() },
  });
  response.headers.append(
    'Set-Cookie',
    `${COOKIE_NAME}=${token}; Path=/; Max-Age=${Math.floor(SESSION_DURATION_MS / 1000)}; HttpOnly; Secure; SameSite=Lax`
  );
  return response;
}

function safeRedirect(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('://')) {
    return '/';
  }
  return value;
}

async function sign(value, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
