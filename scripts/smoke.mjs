import assert from 'node:assert/strict';

const origin = new URL(process.argv[2] || 'http://localhost:3000').origin;
const checks = [
  ['/', 200], ['/hall', 200], ['/results', 200],
  ['/auth/login', 200], ['/auth/register', 200],
  ['/auth/forgot-password', 200], ['/auth/resend-confirmation', 200],
  ['/auth/reset-password', 307], ['/auth/callback', 307], ['/auth/confirm', 307],
  ['/reservations', 307], ['/admin/events', 307], ['/admin/check-in', 307],
  ['/events/invalid', 404], ['/invite/invalid', 404], ['/missing-page', 404],
  ['/icon.svg', 200],
];
let homepage;
for (const [path, status] of checks) {
  const response = await fetch(`${origin}${path}`, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, status, `${path}: unexpected HTTP status`);
  if (status === 307) {
    const location = new URL(response.headers.get('location'), origin);
    assert.equal(location.origin, origin, `${path}: redirect changed the application's origin`);
    assert.ok(location.pathname.startsWith('/auth/'), `${path}: unexpected login redirect`);
  }
  if (path === '/') {
    homepage = await response.text();
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('referrer-policy'), 'same-origin');
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
  }
  console.log(`OK ${status} ${path}`);
}
const stylesheets = [...homepage.matchAll(/<link\b[^>]*>/g)]
  .filter(([tag]) => /rel="stylesheet"/.test(tag))
  .map(([tag]) => tag.match(/href="([^"]+)"/)?.[1]).filter(Boolean);
assert.ok(stylesheets.length, 'No stylesheet in the production HTML');
for (const path of stylesheets) {
  const response = await fetch(new URL(path.replaceAll('&amp;', '&'), origin), { signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, 200, 'Production stylesheet did not load');
  assert.match(response.headers.get('content-type') || '', /text\/css/);
  assert.ok((await response.text()).length > 1000, 'Production stylesheet is unexpectedly empty');
}
console.log(`Passed ${checks.length} route checks and ${stylesheets.length} stylesheet check(s).`);
