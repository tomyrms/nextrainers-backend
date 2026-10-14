// Lightweight session auth. Dependency-free (node:crypto only): passwords are
// scrypt-hashed with a random per-user salt, sessions are opaque random tokens.
// Users and sessions live in lib/kv.ts (Upstash Redis in production, a local
// file in dev/CI) and are read through on every call, so a login or logout on
// one serverless instance is seen by all of them.
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { kvDel, kvGet, kvSet, kvSetIfAbsent } from "./kv";

export type AuthUser = { id: string; email: string };

type UserRecord = AuthUser & { passwordHash: string; salt: string; createdAt: string };

type Session = { userId: string; createdAt: string };

// Name of the cookie that carries the session token.
export const SESSION_COOKIE = "session";

// Key layout: user record by normalized email, email by user id, session by token.
const userKey = (email: string) => `auth:user:${email}`;
const userIdKey = (id: string) => `auth:uid:${id}`;
const sessionKey = (token: string) => `auth:session:${token}`;
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

async function readJsonKey<T>(key: string): Promise<T | null> {
  const text = await kvGet(key);
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

// Hex-encoded 64-byte scrypt digest for the given password + salt.
function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString("hex");
}

// Constant-time comparison so timing cannot leak how much of the hash matched.
function verifyPassword(password: string, user: UserRecord): boolean {
  const expected = Buffer.from(user.passwordHash, "hex");
  const candidate = Buffer.from(hashPassword(password, user.salt), "hex");
  return expected.length === candidate.length && timingSafeEqual(expected, candidate);
}

// Public shape returned to clients: never expose hashes or salts.
function publicUser(user: UserRecord): AuthUser {
  return { id: user.id, email: user.email };
}

// Validates email + password and stores the user. Fails on duplicates.
export async function registerUser(
  email: string,
  password: string,
): Promise<{ ok: true; user: AuthUser } | { ok: false; error: string; code: "invalid" | "duplicate" }> {
  const normalized = email.trim().toLowerCase();
  if (!EMAIL_RE.test(normalized)) return { ok: false, code: "invalid", error: "invalid email" };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, code: "invalid", error: `password must be at least ${MIN_PASSWORD_LENGTH} characters` };
  }

  const salt = randomBytes(16).toString("hex");
  const user: UserRecord = {
    id: randomUUID(),
    email: normalized,
    passwordHash: hashPassword(password, salt),
    salt,
    createdAt: new Date().toISOString(),
  };
  // NX makes concurrent registrations of one email race-free.
  if (!(await kvSetIfAbsent(userKey(normalized), JSON.stringify(user)))) {
    return { ok: false, code: "duplicate", error: "email already registered" };
  }
  await kvSet(userIdKey(user.id), normalized);
  return { ok: true, user: publicUser(user) };
}

// Checks credentials. Same error for unknown email and wrong password.
export async function loginUser(
  email: string,
  password: string,
): Promise<{ ok: true; user: AuthUser } | { ok: false; error: string }> {
  const user = await readJsonKey<UserRecord>(userKey(email.trim().toLowerCase()));
  if (!user || !verifyPassword(password, user)) return { ok: false, error: "invalid credentials" };
  return { ok: true, user: publicUser(user) };
}

// Creates a session and returns its opaque token.
export async function createSession(
  userId: string,
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  if (!(await getUserById(userId))) return { ok: false, error: "unknown user" };
  const token = randomBytes(32).toString("hex");
  const session: Session = { userId, createdAt: new Date().toISOString() };
  await kvSet(sessionKey(token), JSON.stringify(session), SESSION_TTL_SECONDS);
  return { ok: true, token };
}

// Removes the session so the token stops authenticating.
export async function destroySession(token: string): Promise<void> {
  await kvDel(sessionKey(token));
}

export async function getUserById(id: string): Promise<AuthUser | null> {
  const email = await kvGet(userIdKey(id));
  if (!email) return null;
  const user = await readJsonKey<UserRecord>(userKey(email));
  return user ? publicUser(user) : null;
}

// Token from the Authorization header first, then the session cookie.
export function getSessionToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) {
    const token = header.slice(7).trim();
    if (token) return token;
  }

  const cookie = req.headers.get("cookie");
  if (!cookie) return null;
  for (const part of cookie.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) return decodeURIComponent(rest.join("=")) || null;
  }
  return null;
}

// Resolves the request's session to its user, or null when not authenticated.
export async function getUserFromRequest(req: Request): Promise<AuthUser | null> {
  const token = getSessionToken(req);
  if (!token) return null;
  const session = await readJsonKey<Session>(sessionKey(token));
  if (!session) return null;
  return getUserById(session.userId);
}
