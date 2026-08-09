import test from 'node:test';
import assert from 'node:assert/strict';
import handler from './login.js';

test('normalizes redirects without leaving the Phoenix origin', async (context) => {
  const originalPassword = process.env.SITE_PASSWORD;
  const originalSecret = process.env.SESSION_SECRET;
  context.after(() => {
    if (originalPassword === undefined) delete process.env.SITE_PASSWORD;
    else process.env.SITE_PASSWORD = originalPassword;
    if (originalSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = originalSecret;
  });

  process.env.SITE_PASSWORD = 'preview-secret';
  process.env.SESSION_SECRET = 'session-secret';

  for (const redirect of ['/\\evil.example', '/\t/evil.example', '/\n/evil.example']) {
    const form = new FormData();
    form.set('password', 'preview-secret');
    form.set('redirect', redirect);

    const response = await handler(new Request('https://phoenixfirelabs.com/api/login', {
      method: 'POST',
      body: form,
    }));

    const location = new URL(response.headers.get('location'));
    assert.equal(location.origin, 'https://phoenixfirelabs.com', redirect);
    assert.equal(location.pathname, '/', redirect);
  }
  const safeForm = new FormData();
  safeForm.set('password', 'preview-secret');
  safeForm.set('redirect', '/platform?x=1#live');
  const safeResponse = await handler(new Request('https://phoenixfirelabs.com/api/login', {
    method: 'POST',
    body: safeForm,
  }));
  assert.equal(safeResponse.headers.get('location'), 'https://phoenixfirelabs.com/platform?x=1#live');
});
