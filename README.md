# nextrainers-backend

Clone backend for the Nextrainers app, implementing the **API contract recovered
from the shipped client** (see the reconstruction workspace). Next.js 16 route
handlers, all state in memory for now.

## Run

```bash
npm install
npm run dev -- -p 4900
```

The mirror frontend proxies `/api/*` to this server automatically when it is
running (see `scripts/serve-preview.mjs` in the reconstruction workspace).

State is persisted to `data/store.json` at runtime (gitignored, reloaded on startup — delete it to reset to the seeds).

## Premium

`lib/subscription.ts` is the clone's source of truth for the paywall:

- default: **everyone is premium** (`isActive: true`, `canGenerateTraining: true`,
  unlimited trainings) — this is your product, you set the rules;
- `SUBSCRIPTION_MODE=free` simulates the free tier (matches the recovered
  `inactive` contract exactly).

The response shape is byte-compatible with what the shipped client expects
(chunk 298 `SubscriptionProvider`): `isActive`, `status`, `currentPeriodEnd`,
`cancelAtPeriodEnd`, `trainingsUsedThisMonth`, `trainingsRemainingThisMonth`,
`canGenerateTraining`.

## Implemented endpoints

| Endpoint | Notes |
|---|---|
| `GET /api/subscription/info` | premium-by-default contract |
| `POST /api/subscription/create-checkout` | instant success (nothing is billed) |
| `GET /api/user/profile`, `/onboarding`, `/currency`, `/tactics` | demo profile |
| `GET/POST /api/user/discovery-popup` | dismissal flag |
| `GET /api/notifications/inbox`, `/preferences`, `POST /presence` | empty/false defaults |
| `GET /api/public/coach-count` | 21 000 |
| `GET/POST /api/trainings`, `GET/DELETE /api/trainings/:id` | in-memory list |
| `GET /api/exercises`, `GET/POST/DELETE /api/exercises/favorite` | in-memory |
| `GET/POST /api/season-plan`, `GET /api/season/sessions`, `/calendar`, `/next-match` | empty states |
| `POST /api/season/generate`, `GET /api/generation/status`, `POST /api/generation/live-activity-token` | simulated generation job (~1.2s): appends 2 sessions + trainings, status polls read `done` + `path` (see `lib/generation.ts`) |
| `GET /api/club/info` | no club yet |
| `GET /api/analysis`, `GET/POST /api/players`, `GET /api/lineup`, `GET /api/assistant/context` | empty states |
| `POST /api/auth-google-mobile` | accepts idToken, returns dummy ticket |
| `POST /api/analytics/track` | 204 |
| `* /api/*` (catch-all) | `{}` 200 so the UI degrades gracefully |

### Auth (session)

| Endpoint | Behaviour |
|---|---|
| `POST /api/auth/register` | `{email, password}` → 200 `{user}` · 400 invalid · 409 duplicate |
| `POST /api/auth/login` | → 200 `{token, user}` + `session` cookie (httpOnly) · 401 bad credentials |
| `POST /api/auth/logout` | destroys the session (header or cookie), clears cookie |
| `GET /api/auth/me` | `{user}` or `{user:null}` |

Dependency-free (`node:crypto` scrypt, opaque tokens) — see `lib/auth.ts`.

### Verification

`node ../scripts/verify-api.mjs` runs 31 assertions against a running server
(core contract + full auth flow). The GitHub Actions CI builds the project and
runs the same suite (`scripts/verify-api.mjs`) against the production server on
every push.

## Next steps

1. **Auth** — replace the dummy `auth-google-mobile` with a real provider
   (Clerk like the original, or simpler: email magic link / OAuth).
2. **Database** — swap `lib/store.ts` for Prisma + SQLite/Postgres with real
   models: users, teams, players, trainings, exercises, season plans.
3. **Generation** — `POST /api/season/generate` + `GET /api/generation/status`
   with your own LLM provider; keep the job/polling shape the client expects
   (`lib/store` tracks a job per user).
4. **Push** — FCM/APNs token registration (`/api/notifications/*`).
5. **Frontend** — rewrite the app UI (use the reconstructed bundle as the
   design/behavior reference); point the iOS shell's `server.url` at this
   backend.

All route handlers return the same JSON shapes the recovered client reads, so
any frontend built from the reconstruction works against this API unchanged.
