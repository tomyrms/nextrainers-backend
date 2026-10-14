// Acceptance test suite for the clone backend, per docs/api-contract.md.
// Usage: node scripts/verify-api.mjs [baseUrl]   (default http://localhost:4900)
// Each check asserts an HTTP status + JSON shape the shipped client actually reads.
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
const isStr = (v) => typeof v === 'string';
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const today = new Date().toISOString().slice(0, 10);

console.log(`== Subscription (${BASE}) ==`);
{
  const r = await req('GET', '/api/subscription/info');
  check('GET /api/subscription/info -> 200', r.status === 200, r.text.slice(0, 80));
  check('subscription.isActive === true', r.json?.isActive === true);
  check('subscription.canGenerateTraining === true', r.json?.canGenerateTraining === true);
  check('subscription.trainingsRemainingThisMonth > 0', (r.json?.trainingsRemainingThisMonth ?? 0) > 0);
  check('subscription.status is string', isStr(r.json?.status));
}

console.log('\n== Public / user ==');
{
  const r = await req('GET', '/api/public/coach-count');
  check('GET /api/public/coach-count -> count=21000', r.status === 200 && r.json?.count === 21000, r.text.slice(0, 80));
}
{
  const r = await req('GET', '/api/user/profile');
  check('profile.fullName is string', r.status === 200 && isStr(r.json?.fullName), r.text.slice(0, 80));
  check('profile.teamName is string', isStr(r.json?.teamName));
}
{
  const r = await req('PUT', '/api/user/locale', { body: { locale: 'fr' } });
  check('PUT /api/user/locale -> 2xx', r.status === 200 || r.status === 204, String(r.status));
}
{
  const r = await req('GET', '/api/user/country');
  check('GET /api/user/country -> country string', r.status === 200 && isStr(r.json?.country), r.text.slice(0, 80));
}

console.log('\n== Season ==');
let planId = null;
{
  const r = await req('GET', '/api/season-plan');
  check('season-plan.plan is object', r.status === 200 && isObj(r.json?.plan), r.text.slice(0, 100));
  check('season-plan.plan.id is string', isStr(r.json?.plan?.id));
  check('season-plan.plan.calendar is object', isObj(r.json?.plan?.calendar));
  check('season-plan.categories is array', Array.isArray(r.json?.categories));
  check('season-plan.prefill is object', isObj(r.json?.prefill));
  planId = r.json?.plan?.id ?? null;
}
{
  const r = await req('GET', `/api/season/sessions?seasonPlanId=${encodeURIComponent(planId ?? '')}`);
  const sessions = r.json?.sessions;
  check('season/sessions -> sessions array >= 1', r.status === 200 && Array.isArray(sessions) && sessions.length >= 1, r.text.slice(0, 100));
  if (Array.isArray(sessions) && sessions.length) {
    check('session[0].date is YYYY-MM-DD', YMD.test(sessions[0].date));
    check('session[0].theme is string', isStr(sessions[0].theme));
  } else {
    check('session[0].date is YYYY-MM-DD', false, 'no sessions');
    check('session[0].theme is string', false, 'no sessions');
  }
}
{
  const r = await req('GET', `/api/season/next-match?from=${today}`);
  const m = r.json?.match;
  check('next-match.match is object (seeded)', r.status === 200 && isObj(m), r.text.slice(0, 100));
  check('next-match.match.date is YYYY-MM-DD', YMD.test(m?.date ?? ''));
  check('next-match.match.homeAway in home|away', m?.homeAway === 'home' || m?.homeAway === 'away');
  check('next-match.match.opponent non-empty string', isStr(m?.opponent) && m.opponent.length > 0);
}

console.log('\n== Library ==');
let firstExerciseId = null;
{
  const r = await req('GET', '/api/exercises');
  const arr = Array.isArray(r.json) ? r.json : null;
  check('exercises -> TOP-LEVEL array >= 1', r.status === 200 && arr !== null && arr.length >= 1, r.text.slice(0, 100));
  if (arr && arr.length) {
    const e = arr[0];
    firstExerciseId = e.id;
    check('exercise.title is string', isStr(e.title));
    check('exercise.duration is number', isNum(e.duration));
    check('exercise.type is string', isStr(e.type));
    check('exercise.coachingPoints is array', Array.isArray(e.coachingPoints));
  } else {
    for (const n of ['exercise.title is string', 'exercise.duration is number', 'exercise.type is string', 'exercise.coachingPoints is array']) check(n, false, 'no exercises');
  }
}
{
  const list = await req('GET', '/api/exercises/favorite');
  check('favorites -> TOP-LEVEL array', list.status === 200 && Array.isArray(list.json), list.text.slice(0, 100));
  if (firstExerciseId) {
    const add = await req('POST', '/api/exercises/favorite', { body: { exerciseId: firstExerciseId } });
    check('POST favorite -> 2xx', add.status >= 200 && add.status < 300, String(add.status));
    const after = await req('GET', '/api/exercises/favorite');
    check('favorite present after POST', Array.isArray(after.json) && after.json.some((e) => e.id === firstExerciseId));
    const del = await req('DELETE', `/api/exercises/favorite?exerciseId=${encodeURIComponent(firstExerciseId)}`);
    check('DELETE favorite -> 2xx', del.status >= 200 && del.status < 300, String(del.status));
    const after2 = await req('GET', '/api/exercises/favorite');
    check('favorite removed after DELETE', Array.isArray(after2.json) && !after2.json.some((e) => e.id === firstExerciseId));
  } else {
    for (const n of ['POST favorite -> 2xx', 'favorite present after POST', 'DELETE favorite -> 2xx', 'favorite removed after DELETE']) check(n, false, 'no exercise id');
  }
}

console.log('\n== Trainings ==');
let firstTrainingId = null;
{
  const r = await req('GET', '/api/trainings');
  const arr = Array.isArray(r.json) ? r.json : null;
  check('trainings -> TOP-LEVEL array >= 1', r.status === 200 && arr !== null && arr.length >= 1, r.text.slice(0, 100));
  if (arr && arr.length) {
    const t = arr[0];
    firstTrainingId = t.id;
    check('training.theme is string', isStr(t.theme));
    check('training.date is string', isStr(t.date));
    check('training.duration is number', isNum(t.duration));
    check('training.plan is array', Array.isArray(t.plan));
    check('training.exercises is array', Array.isArray(t.exercises));
  } else {
    for (const n of ['training.theme is string', 'training.date is string', 'training.duration is number', 'training.plan is array', 'training.exercises is array']) check(n, false, 'no trainings');
  }
}
{
  if (firstTrainingId) {
    const r = await req('GET', `/api/trainings/${encodeURIComponent(firstTrainingId)}`);
    check('GET /api/trainings/:id -> object with id', r.status === 200 && r.json?.id === firstTrainingId, r.text.slice(0, 100));
  } else {
    check('GET /api/trainings/:id -> object with id', false, 'no training id');
  }
}

console.log('\n== Players / analysis / notifications / club ==');
{
  const r = await req('GET', '/api/players');
  const arr = Array.isArray(r.json) ? r.json : null;
  check('players -> TOP-LEVEL array >= 1', r.status === 200 && arr !== null && arr.length >= 1, r.text.slice(0, 100));
  if (arr && arr.length) {
    const p = arr[0];
    check('player.firstName/lastName strings', isStr(p.firstName) && isStr(p.lastName));
    check('player.position is string', isStr(p.position));
    check('player.jerseyNumber is number', isNum(p.jerseyNumber));
  } else {
    for (const n of ['player.firstName/lastName strings', 'player.position is string', 'player.jerseyNumber is number']) check(n, false, 'no players');
  }
}
{
  const r = await req('GET', '/api/analysis');
  const arr = Array.isArray(r.json) ? r.json : null;
  check('analysis -> TOP-LEVEL array >= 1', r.status === 200 && arr !== null && arr.length >= 1, r.text.slice(0, 100));
  if (arr && arr.length) {
    check('analysis[0].id is string', isStr(arr[0].id));
    check('analysis[0].teamFormation is string', isStr(arr[0].teamFormation));
  } else {
    for (const n of ['analysis[0].id is string', 'analysis[0].teamFormation is string']) check(n, false, 'no analyses');
  }
}
{
  const r = await req('GET', '/api/notifications/inbox');
  const notifs = r.json?.notifications;
  check('inbox -> notifications array >= 1', r.status === 200 && Array.isArray(notifs) && notifs.length >= 1, r.text.slice(0, 100));
  check('inbox.unreadCount is number', isNum(r.json?.unreadCount));
  if (Array.isArray(notifs) && notifs.length) {
    const n = notifs[0];
    check('notification has id/title/body/createdAt', isStr(n.id) && isStr(n.title) && isStr(n.body) && isStr(n.createdAt));
    check('notification has readAt key (ISO|null)', 'readAt' in n && (n.readAt === null || isStr(n.readAt)));
  } else {
    check('notification has id/title/body/createdAt', false, 'no notifications');
    check('notification has readAt key (ISO|null)', false, 'no notifications');
  }
}
{
  const r = await req('GET', '/api/club/info');
  check('club/info -> club object with name', r.status === 200 && isObj(r.json?.club) && isStr(r.json.club.name), r.text.slice(0, 100));
}
{
  const r1 = await req('GET', '/api/lineup');
  check('GET /api/lineup -> 200 json', r1.status === 200 && isObj(r1.json), r1.text.slice(0, 80));
  const r2 = await req('GET', '/api/assistant/context');
  check('GET /api/assistant/context -> 200 json', r2.status === 200 && isObj(r2.json), r2.text.slice(0, 80));
  const r3 = await req('GET', '/api/__nonexistent__');
  check('catch-all unknown route -> 200 {}', r3.status === 200 && isObj(r3.json), r3.text.slice(0, 80));
  const r4 = await req('POST', '/api/analytics/track', { body: { event: 'test' } });
  check('POST /api/analytics/track -> 204', r4.status === 204, String(r4.status));
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
  check('POST /api/auth/login -> token', login.status === 200 && isStr(login.json?.token), login.text.slice(0, 120));
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
