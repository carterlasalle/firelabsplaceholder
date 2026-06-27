// Gates the whole site behind login.html unless a valid signed session
// cookie is present. Runs on the Edge runtime (Web Crypto, no dependencies).
export const config = {
  matcher: [
    '/((?!api/login|login\\.html|favicon\\.ico|apple-touch-icon\\.png|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|css|js|map|woff2?)$).*)',
  ],
};

const COOKIE_NAME = 'site_auth';

export default async function middleware(request) {
  const secret = process.env.SESSION_SECRET;
  const token = readCookie(request.headers.get('cookie') || '', COOKIE_NAME);

  if (secret && (await verifyToken(token, secret))) {
    return; // valid session, let the request through
  }

  const url = new URL(request.url);
  const loginUrl = new URL('/login.html', url);
  loginUrl.searchParams.set('redirect', url.pathname + url.search);
  return new Response(null, { status: 302, headers: { Location: loginUrl.toString() } });
}

function readCookie(cookieHeader, name) {
  const match = cookieHeader.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

async function verifyToken(token, secret) {
  if (!token) return false;
  const [expPart, sigPart] = token.split('.');
  if (!expPart || !sigPart) return false;
  const exp = Number(expPart);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  const expectedSig = await sign(expPart, secret);
  return timingSafeEqual(sigPart, expectedSig);
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
