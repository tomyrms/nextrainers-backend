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

console.log('\n== Generation ==');
{
  // The client only treats the generate call as successful when the response
  // carries a `sessions` key (contract §11); it waits up to 300s for it.
  const r = await req('POST', '/api/season/generate', { body: { seasonPlanId: planId ?? 'plan_1', locale: 'fr' } });
  check('POST /api/season/generate -> 200 + sessions array', r.status === 200 && isObj(r.json) && 'sessions' in r.json && Array.isArray(r.json.sessions), r.text.slice(0, 100));
  check('generate.sessions has >= 1 entry', Array.isArray(r.json?.sessions) && r.json.sessions.length >= 1);
}
{
  // After generate resolves the job is done and carries the navigation path.
  const r = await req('GET', '/api/generation/status');
  check('GET /api/generation/status -> 200 status=done', r.status === 200 && r.json?.status === 'done', r.text.slice(0, 100));
  check('generation/status.path is string', isStr(r.json?.path));
}
{
  // Regenerating replaces the previous run (no stacking) with the same dates.
  const body = { seasonPlanId: planId ?? 'plan_1', locale: 'fr' };
  const a = await req('POST', '/api/season/generate', { body });
  const b = await req('POST', '/api/season/generate', { body });
  const sa = Array.isArray(a.json?.sessions) ? a.json.sessions : [];
  const sb = Array.isArray(b.json?.sessions) ? b.json.sessions : [];
  const generated = (list) => list.filter((s) => String(s.trainingSessionId ?? '').startsWith('tr_gen_'));
  check('regenerate -> session count stable', sa.length > 0 && sa.length === sb.length, `${sa.length} -> ${sb.length}`);
  check('regenerate -> exactly 2 generated sessions', generated(sb).length === 2, String(generated(sb).length));
  check('regenerate -> 3 seeded + 2 generated = 5 sessions', sb.length === 5, String(sb.length));
  check('regenerate -> dates stable', JSON.stringify(sa.map((s) => s.date)) === JSON.stringify(sb.map((s) => s.date)));
  const seasonId = planId ?? 'plan_1';
  const list = await req('GET', `/api/season/sessions?seasonPlanId=${encodeURIComponent(seasonId)}`);
  const listed = Array.isArray(list.json?.sessions) ? list.json.sessions : Array.isArray(list.json) ? list.json : null;
  check('season/sessions count matches generate', listed !== null && listed.length === sb.length, `${listed?.length} vs ${sb.length}`);
  const st = await req('GET', '/api/generation/status');
  check('generation/status still done after regenerate', st.status === 200 && st.json?.status === 'done', st.text.slice(0, 100));
}
{
  const r = await req('POST', '/api/generation/live-activity-token', { body: { token: 'test-token' } });
  check('POST /api/generation/live-activity-token -> 2xx', r.status >= 200 && r.status < 300, String(r.status));
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

  // Sessions are independent: logging one out leaves another one valid.
  const l1 = await req('POST', '/api/auth/login', { body: { email, password } });
  const l2 = await req('POST', '/api/auth/login', { body: { email: email.toUpperCase(), password } });
  const t1 = l1.json?.token, t2 = l2.json?.token;
  check('two logins -> two distinct tokens (email case-insensitive)', isStr(t1) && isStr(t2) && t1 !== t2);
  await req('POST', '/api/auth/logout', { headers: { authorization: `Bearer ${t1}` } });
  const still = await req('GET', '/api/auth/me', { headers: { authorization: `Bearer ${t2}` } });
  check('other session survives logout', still.json?.user?.email === email, still.text.slice(0, 120));
  const gone = await req('GET', '/api/auth/me', { headers: { authorization: `Bearer ${t1}` } });
  check('logged-out token -> user:null', gone.status === 200 && gone.json?.user === null, gone.text.slice(0, 120));
  await req('POST', '/api/auth/logout', { headers: { authorization: `Bearer ${t2}` } });
}

console.log('\n== Collateral ==');
{
  const r = await req('GET', '/api/club/logo');
  check('GET /api/club/logo -> 200 + logoUrl null', r.status === 200 && r.json?.logoUrl === null, r.text.slice(0, 100));
  check('club/logo.canManageLogo === false', r.json?.canManageLogo === false);
}
{
  const r = await req('GET', '/api/team/logo');
  check('GET /api/team/logo -> 200 + logoUrl null', r.status === 200 && r.json?.logoUrl === null, r.text.slice(0, 100));
}
{
  const r = await req('GET', '/api/coach-dna/match');
  check('GET /api/coach-dna/match -> match key present (null)', r.status === 200 && r.json !== null && 'match' in r.json && r.json.match === null, r.text.slice(0, 100));
}
{
  const r = await req('GET', '/api/club/library');
  check('GET /api/club/library -> exercises array', r.status === 200 && Array.isArray(r.json?.exercises), r.text.slice(0, 100));
  check('club/library userContext + hasClubAccess flags', r.json?.userContext?.canManageLibrary === false && r.json?.hasClubAccess === false);
}
{
  // Exercise-feedback roundtrip: POST true -> GET true -> DELETE -> GET false.
  const exerciseId = 'ex_001';
  const post = await req('POST', '/api/exercise-feedback', { body: { exerciseId, isPositive: true } });
  check('POST /api/exercise-feedback -> 2xx', post.status >= 200 && post.status < 300, String(post.status));
  const on = await req('GET', `/api/exercise-feedback?exerciseId=${encodeURIComponent(exerciseId)}`);
  check('feedback isPositive true after POST', on.status === 200 && on.json?.isPositive === true, on.text.slice(0, 100));
  const del = await req('DELETE', `/api/exercise-feedback?exerciseId=${encodeURIComponent(exerciseId)}`);
  check('DELETE /api/exercise-feedback -> 2xx', del.status >= 200 && del.status < 300, String(del.status));
  const off = await req('GET', `/api/exercise-feedback?exerciseId=${encodeURIComponent(exerciseId)}`);
  check('feedback isPositive false after DELETE', off.status === 200 && off.json?.isPositive === false, off.text.slice(0, 100));
}
{
  // Player PATCH coachNotes roundtrip on the first seeded player (restored after).
  const list = await req('GET', '/api/players');
  const player = Array.isArray(list.json) ? list.json[0] : null;
  if (player) {
    const original = player.coachNotes ?? '';
    const marker = `verify ${Date.now()}`;
    const patch = await req('PATCH', `/api/players/${encodeURIComponent(player.id)}`, { body: { coachNotes: marker } });
    check('PATCH /api/players/:id coachNotes applied', patch.status === 200 && patch.json?.coachNotes === marker, patch.text.slice(0, 100));
    const after = await req('GET', '/api/players');
    const updated = Array.isArray(after.json) ? after.json.find((p) => p.id === player.id) : null;
    check('GET /api/players reflects coachNotes', updated?.coachNotes === marker);
    const restore = await req('PATCH', `/api/players/${encodeURIComponent(player.id)}`, { body: { coachNotes: original } });
    check('coachNotes restored to original', restore.status === 200 && restore.json?.coachNotes === original, restore.text.slice(0, 100));
  } else {
    for (const name of ['PATCH /api/players/:id coachNotes applied', 'GET /api/players reflects coachNotes', 'coachNotes restored to original']) check(name, false, 'no players');
  }
}

console.log('\n== Season calendar / import ==');
{
  const plan = planId ?? 'plan_1';
  const d = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
  const matches = [
    { date: d(3), opponent: 'Verify FC', homeAway: 'away', competition: 'Coupe', source: 'manual' },
    { date: d(10), opponent: 'Verify United', homeAway: 'home', competition: 'Championnat', source: 'manual' },
    { date: 'not-a-date', opponent: 'Ignored' },
  ];
  const post = await req('POST', '/api/season/calendar', { body: { seasonPlanId: plan, matches, replace: true } });
  check('POST /api/season/calendar -> inserted 2 (undated skipped)', post.status === 200 && post.json?.inserted === 2, post.text.slice(0, 100));
  const again = await req('POST', '/api/season/calendar', { body: { seasonPlanId: plan, matches, replace: false } });
  check('calendar re-post without replace -> duplicates skipped', again.json?.inserted === 0, again.text.slice(0, 100));
  const get = await req('GET', `/api/season/calendar?seasonPlanId=${encodeURIComponent(plan)}`);
  check('GET /api/season/calendar -> matches sorted', Array.isArray(get.json?.matches) && get.json.matches.length === 2 && get.json.matches[0].date <= get.json.matches[1].date, get.text.slice(0, 100));
  const next = await req('GET', `/api/season/next-match?from=${today}`);
  check('next-match -> first imported fixture', next.json?.match?.opponent === 'Verify FC' && next.json.match.homeAway === 'away', next.text.slice(0, 100));
  const bad = await req('POST', '/api/season/calendar', { body: { seasonPlanId: 'nope', matches: [] } });
  check('calendar unknown plan -> 404', bad.status === 404, String(bad.status));

  const qiBad = await req('POST', '/api/season/quick-import', { body: { teamCategory: 'u15', matches: [{ opponent: 'x' }] } });
  check('quick-import without dates -> 400 NO_DATED_MATCHES', qiBad.status === 400 && qiBad.json?.code === 'NO_DATED_MATCHES', qiBad.text.slice(0, 100));
  const qi = await req('POST', '/api/season/quick-import', { body: { teamCategory: 'u15', matches: [{ date: d(5), opponent: 'Quick FC', homeAway: 'home' }] } });
  check('quick-import -> plan.id of the category', qi.status === 200 && qi.json?.plan?.id === plan, qi.text.slice(0, 100));
  const nextQi = await req('GET', `/api/season/next-match?from=${today}`);
  check('quick-import replaces the calendar', nextQi.json?.match?.opponent === 'Quick FC', nextQi.text.slice(0, 100));

  // Cleanup: an empty calendar brings back the seeded demo match.
  await req('POST', '/api/season/calendar', { body: { seasonPlanId: plan, matches: [], replace: true } });
  const restored = await req('GET', `/api/season/next-match?from=${today}`);
  check('empty calendar -> seeded next match back', isObj(restored.json?.match) && restored.json.match.opponent !== 'Quick FC', restored.text.slice(0, 100));
}

console.log('\n== Analysis detail / tips ==');
{
  const created = await req('POST', '/api/analysis', { body: { teamFormation: '4-3-3', opponentTeamFormation: '3-5-2', opponentTeamName: 'Verify Analysis FC' } });
  const id = created.json?.id;
  const before = await req('GET', `/api/analysis/${encodeURIComponent(id)}`);
  check('GET /api/analysis/:id -> detail with tips []', before.status === 200 && before.json?.opponentTeamName === 'Verify Analysis FC' && Array.isArray(before.json?.tips) && before.json.tips.length === 0 && isStr(before.json?.createdAt), before.text.slice(0, 120));
  const gen = await req('POST', `/api/analysis/${encodeURIComponent(id)}/generate-tips`);
  check('POST generate-tips -> 2xx', gen.status >= 200 && gen.status < 300, String(gen.status));
  const after = await req('GET', `/api/analysis/${encodeURIComponent(id)}`);
  const tips = after.json?.tips;
  check('analysis detail -> tips with title/body/category', Array.isArray(tips) && tips.length >= 3 && tips.every((t) => isStr(t.title) && isStr(t.body) && isStr(t.category)), after.text.slice(0, 120));
  check('tips reflect a back-3 opponent', Array.isArray(tips) && tips.some((t) => t.id === 't_wide'));
  const missing = await req('GET', '/api/analysis/does-not-exist');
  check('GET /api/analysis/unknown -> 404', missing.status === 404, String(missing.status));
  const tipsMissing = await req('POST', '/api/analysis/does-not-exist/generate-tips');
  check('generate-tips unknown -> 404', tipsMissing.status === 404, String(tipsMissing.status));
  const del = await req('DELETE', `/api/analysis/${encodeURIComponent(id)}`);
  const gone = await req('GET', `/api/analysis/${encodeURIComponent(id)}`);
  check('DELETE /api/analysis/:id -> removed', del.status === 200 && gone.status === 404, `${del.status}/${gone.status}`);
}

console.log('\n== Player import ==');
{
  const csv = 'Prénom;Nom;Poste;Numéro;Pied;Date de naissance\nVerify;Importé;Gardien;1;Gauche;12/04/2011\nSans;Poste;?;7;droit;2011-02-30\n';
  const form = new FormData();
  form.append('file', new Blob([csv], { type: 'text/csv' }), 'roster.csv');
  let parse;
  try {
    const res = await fetch(BASE + '/api/players/import/parse', { method: 'POST', body: form });
    parse = { status: res.status, json: await res.json().catch(() => null) };
  } catch (e) { parse = { status: 0, json: null }; }
  const rows = parse.json?.rows;
  check('POST /api/players/import/parse -> rows + existingCount', parse.status === 200 && Array.isArray(rows) && rows.length === 2 && isNum(parse.json?.existingCount), JSON.stringify(parse.json).slice(0, 120));
  check('parse normalizes position/foot/date', rows?.[0]?.position === 'GK' && rows[0].preferredFoot === 'LEFT' && rows[0].dateOfBirth === '2011-04-12' && rows[0].jerseyNumber === 1 && isStr(rows[0].rowId));
  check('parse leaves unknown position empty + invalid date null', rows?.[1]?.position === '' && rows[1].dateOfBirth === null);

  const bad = new FormData();
  bad.append('file', new Blob(['x'], { type: 'application/pdf' }), 'roster.pdf');
  const pdf = await fetch(BASE + '/api/players/import/parse', { method: 'POST', body: bad }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) })).catch(() => ({ status: 0 }));
  check('parse pdf -> error code PDF_UNREADABLE', pdf.status >= 400 && pdf.json?.code === 'PDF_UNREADABLE', String(pdf.status));

  const marker = `Verify${Date.now()}`;
  const imp = await req('POST', '/api/players/import', { body: { players: [
    { firstName: marker, lastName: 'Importé', position: 'GK', jerseyNumber: 1, preferredFoot: 'LEFT', dateOfBirth: '2011-04-12' },
    { firstName: marker, lastName: 'Importé', position: 'GK', jerseyNumber: 1, preferredFoot: 'LEFT', dateOfBirth: '2011-04-12' },
    { firstName: 'Sans', lastName: 'Poste', position: '', jerseyNumber: 7, preferredFoot: 'RIGHT', dateOfBirth: null },
  ] } });
  check('POST /api/players/import -> inserted 1, skipped 2', imp.status === 200 && imp.json?.inserted === 1 && imp.json?.skipped === 2 && imp.json?.limitReached === false, imp.text.slice(0, 100));
  const roster = await req('GET', '/api/players');
  const added = Array.isArray(roster.json) ? roster.json.find((p) => p.firstName === marker) : null;
  check('imported player in roster with full shape', added?.position === 'GK' && added.preferredFoot === 'LEFT' && Array.isArray(added.skills) && added.teamContext?.mode === 'coach');
  if (added) await req('DELETE', `/api/players/${encodeURIComponent(added.id)}`);
}

console.log('\n== Club library / coach DNA ==');
{
  const add = await req('POST', '/api/club/library', { body: { exerciseId: 'ex_001' } });
  check('POST /api/club/library -> 2xx', add.status === 200, String(add.status));
  const lib = await req('GET', '/api/club/library');
  check('club/library lists the added exercise', Array.isArray(lib.json?.exercises) && lib.json.exercises.some((e) => e.id === 'ex_001' && isStr(e.title)));
  const unknown = await req('POST', '/api/club/library', { body: { exerciseId: 'nope' } });
  check('club/library unknown exercise -> 404', unknown.status === 404, String(unknown.status));
  await req('DELETE', '/api/club/library', { body: { exerciseId: 'ex_001' } });
  const after = await req('GET', '/api/club/library');
  check('club/library DELETE removes it', Array.isArray(after.json?.exercises) && !after.json.exercises.some((e) => e.id === 'ex_001'));

  const save = await req('POST', '/api/coach-dna/match', { body: { profile: 'pressing', score: 0.8 } });
  check('POST /api/coach-dna/match -> match echoed', save.status === 200 && save.json?.match?.profile === 'pressing', save.text.slice(0, 100));
  const read = await req('GET', '/api/coach-dna/match');
  check('GET /api/coach-dna/match -> saved match', read.json?.match?.score === 0.8, read.text.slice(0, 100));
  await req('DELETE', '/api/coach-dna/match');
  const reset = await req('GET', '/api/coach-dna/match');
  check('coach-dna reset -> match null', reset.status === 200 && reset.json?.match === null, reset.text.slice(0, 100));
}

console.log(`\n== RESULT: ${pass} passed, ${fail} failed ==`);
if (failures.length) { console.log('Failures:\n - ' + failures.join('\n - ')); process.exit(1); }
