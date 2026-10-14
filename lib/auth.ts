// Lightweight in-memory session auth. Dependency-free (node:crypto only):
// passwords are scrypt-hashed with a random per-user salt, sessions are
// opaque random tokens. Swap for a real database when you grow the clone.
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";

export type AuthUser = { id: string; email: string };

type UserRecord = AuthUser & { passwordHash: string; salt: string; createdAt: string };

type Session = { userId: string; createdAt: string };

// Name of the cookie that carries the session token.
export const SESSION_COOKIE = "session";

const users = new Map<string, UserRecord>(); // keyed by normalized email
const sessions = new Map<string, Session>(); // keyed by token

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
export function registerUser(
  email: string,
  password: string,
): { ok: true; user: AuthUser } | { ok: false; error: string; code: "invalid" | "duplicate" } {
  const normalized = email.trim().toLowerCase();
  if (!EMAIL_RE.test(normalized)) return { ok: false, code: "invalid", error: "invalid email" };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, code: "invalid", error: `password must be at least ${MIN_PASSWORD_LENGTH} characters` };
  }
  if (users.has(normalized)) return { ok: false, code: "duplicate", error: "email already registered" };

  const salt = randomBytes(16).toString("hex");
  const user: UserRecord = {
    id: randomUUID(),
    email: normalized,
    passwordHash: hashPassword(password, salt),
    salt,
    createdAt: new Date().toISOString(),
  };
  users.set(normalized, user);
  return { ok: true, user: publicUser(user) };
}

// Checks credentials. Same error for unknown email and wrong password.
export function loginUser(
  email: string,
  password: string,
): { ok: true; user: AuthUser } | { ok: false; error: string } {
  const user = users.get(email.trim().toLowerCase());
  if (!user || !verifyPassword(password, user)) return { ok: false, error: "invalid credentials" };
  return { ok: true, user: publicUser(user) };
}

// Creates a session and returns its opaque token.
export function createSession(userId: string): { ok: true; token: string } | { ok: false; error: string } {
  if (!getUserById(userId)) return { ok: false, error: "unknown user" };
  const token = randomBytes(32).toString("hex");
  sessions.set(token, { userId, createdAt: new Date().toISOString() });
  return { ok: true, token };
}

// Removes the session so the token stops authenticating.
export function destroySession(token: string): void {
  sessions.delete(token);
}

export function getUserById(id: string): AuthUser | null {
  for (const user of users.values()) {
    if (user.id === id) return publicUser(user);
  }
  return null;
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
export function getUserFromRequest(req: Request): AuthUser | null {
  const token = getSessionToken(req);
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  return getUserById(session.userId);
}
