// Smoke-test suite for the clone backend. Usage: node scripts/verify-api.mjs [baseUrl]
// Each check asserts HTTP status + JSON response shape. Exit code 1 on any failure.
const BASE = process.argv[2] || 'http://localhost:4900';

let pass = 0, fail = 0;
const failures = [];

function check(name, ok, detail = '') {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; failures.push(name); console.log(`  FAIL  ${name}${detail ? '  -> ' + detail : ''}`); }
}

async function req(method, path, { body, headers } = {}) {
  try {
    const res = await fetch(BASE + path, {
      method,
      headers: { 'content-type': 'application/json', ...(headers || {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { status: res.status, json, text };
  } catch (e) {
    return { status: 0, json: null, text: String(e) };
  }
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

console.log(`== Core contract (${BASE}) ==`);

{
  const r = await req('GET', '/api/subscription/info');
  check('GET /api/subscription/info -> 200', r.status === 200, r.text.slice(0, 80));
  check('subscription.isActive === true', r.json?.isActive === true);
  check('subscription.canGenerateTraining === true', r.json?.canGenerateTraining === true);
  check('subscription.trainingsRemainingThisMonth > 0', (r.json?.trainingsRemainingThisMonth ?? 0) > 0);
  check('subscription has status field', typeof r.json?.status === 'string');
}

{
  const r = await req('GET', '/api/public/coach-count');
  check('GET /api/public/coach-count -> count=21000', r.status === 200 && r.json?.count === 21000, r.text.slice(0, 80));
}

{
  const r = await req('GET', '/api/user/profile');
  check('GET /api/user/profile -> object with id', r.status === 200 && isObj(r.json) && 'id' in r.json, r.text.slice(0, 80));
}

{
  const r = await req('GET', '/api/user/locale');
  check('GET /api/user/locale -> 200 json', r.status === 200 && isObj(r.json), r.text.slice(0, 80));
}

{
  const r = await req('GET', '/api/user/tactics');
  check('GET /api/user/tactics -> 200 json', r.status === 200 && isObj(r.json), r.text.slice(0, 80));
}

{
  const r = await req('GET', '/api/season-plan');
  check('GET /api/season-plan -> has plan key', r.status === 200 && isObj(r.json) && 'plan' in r.json, r.text.slice(0, 80));
}

{
  const r = await req('GET', '/api/season/next-match');
  check('GET /api/season/next-match -> has match key', r.status === 200 && isObj(r.json) && 'match' in r.json, r.text.slice(0, 80));
}

{
  const r = await req('GET', '/api/trainings');
  check('GET /api/trainings -> trainings array', r.status === 200 && Array.isArray(r.json?.trainings), r.text.slice(0, 80));
}

{
  const r = await req('GET', '/api/exercises');
  check('GET /api/exercises -> exercises array', r.status === 200 && Array.isArray(r.json?.exercises), r.text.slice(0, 80));
}

{
  const r = await req('GET', '/api/exercises/favorite');
  check('GET /api/exercises/favorite -> favoriteIds array', r.status === 200 && Array.isArray(r.json?.favoriteIds), r.text.slice(0, 80));
}

{
  const r = await req('GET', '/api/players');
  check('GET /api/players -> players array', r.status === 200 && Array.isArray(r.json?.players), r.text.slice(0, 80));
}

{
  const r = await req('GET', '/api/analysis');
  check('GET /api/analysis -> analyses array', r.status === 200 && Array.isArray(r.json?.analyses), r.text.slice(0, 80));
}

{
  const r = await req('GET', '/api/notifications/inbox');
  check('GET /api/notifications/inbox -> notifications + unreadCount', r.status === 200 && Array.isArray(r.json?.notifications) && typeof r.json?.unreadCount === 'number', r.text.slice(0, 80));
}

{
  const r = await req('GET', '/api/club/info');
  check('GET /api/club/info -> 200 json', r.status === 200 && isObj(r.json), r.text.slice(0, 80));
}

{
  const r = await req('GET', '/api/lineup');
  check('GET /api/lineup -> 200 json', r.status === 200 && isObj(r.json), r.text.slice(0, 80));
}

{
  const r = await req('GET', '/api/assistant/context');
  check('GET /api/assistant/context -> 200 json', r.status === 200 && isObj(r.json), r.text.slice(0, 80));
}

{
  const r = await req('GET', '/api/does-not-exist-clone');
  check('catch-all unknown route -> 200 {}', r.status === 200 && isObj(r.json), r.text.slice(0, 80));
}

{
  const r = await req('POST', '/api/analytics/track', { body: { event: 'test' } });
  check('POST /api/analytics/track -> 204', r.status === 204, String(r.status));
}

console.log('\n== Auth (session) ==');
{
  const email = `verify_${Date.now()}@test.dev`;
  const password = 'password123';

  const reg = await req('POST', '/api/auth/register', { body: { email, password } });
  check('POST /api/auth/register -> 200 + user', reg.status === 200 && isObj(reg.json?.user) && reg.json.user.email === email, reg.text.slice(0, 120));

  const dup = await req('POST', '/api/auth/register', { body: { email, password } });
  check('duplicate register -> 409', dup.status === 409, String(dup.status));

  const bad = await req('POST', '/api/auth/register', { body: { email: 'nope', password: 'x' } });
  check('invalid register -> 400', bad.status === 400, String(bad.status));

  const login = await req('POST', '/api/auth/login', { body: { email, password } });
  check('POST /api/auth/login -> token', login.status === 200 && typeof login.json?.token === 'string', login.text.slice(0, 120));
  const token = login.json?.token;

  const wrong = await req('POST', '/api/auth/login', { body: { email, password: 'wrong-password' } });
  check('wrong password -> 401', wrong.status === 401, String(wrong.status));

  const me = await req('GET', '/api/auth/me', { headers: { authorization: `Bearer ${token}` } });
  check('GET /api/auth/me (token) -> user', me.status === 200 && me.json?.user?.email === email, me.text.slice(0, 120));

  const meAnon = await req('GET', '/api/auth/me');
  check('GET /api/auth/me (anon) -> user:null', meAnon.status === 200 && meAnon.json?.user === null, meAnon.text.slice(0, 120));

  if (token) {
    const out = await req('POST', '/api/auth/logout', { headers: { authorization: `Bearer ${token}` } });
    check('POST /api/auth/logout -> 200', out.status === 200, out.text.slice(0, 120));
    const meAfter = await req('GET', '/api/auth/me', { headers: { authorization: `Bearer ${token}` } });
    check('session destroyed after logout', meAfter.json?.user === null, meAfter.text.slice(0, 120));
  }
}

console.log(`\n== RESULT: ${pass} passed, ${fail} failed ==`);
if (failures.length) { console.log('Failures:\n - ' + failures.join('\n - ')); process.exit(1); }
