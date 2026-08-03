/**
 * Session handling. A signed JWT in an httpOnly cookie — no external service.
 */

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { SignJWT, jwtVerify } from 'jose';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db } from '@/db';
import * as s from '@/db/schema';
import type { Role } from './constants';

const COOKIE = 'ugabrush_session';
const MAX_AGE = 60 * 60 * 12; // 12 hours

function secret(): Uint8Array {
  const raw = process.env.AUTH_SECRET;
  if (!raw || raw.length < 16) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('AUTH_SECRET must be set to a strong value in production.');
    }
    return new TextEncoder().encode('development-only-fallback-secret-key-000000');
  }
  return new TextEncoder().encode(raw);
}

export type SessionUser = {
  id: number;
  email: string;
  name: string;
  role: Role;
  /** True when the session came from a share link rather than a sign-in. */
  share?: boolean;
};

/**
 * Whether to mark the cookie Secure.
 *
 * This follows the actual connection, not NODE_ENV. A Secure cookie is dropped
 * by the browser on plain http — with the sole exception of localhost, which
 * browsers treat as a trustworthy origin. Keying it off NODE_ENV therefore broke
 * every non-localhost visitor of a production build served over http: the
 * machine's own LAN address, and so anyone opening a share link from a phone.
 * They would be signed in and then immediately bounced to the login page.
 *
 * A proxy that terminates TLS (Vercel and friends) sets x-forwarded-proto, so
 * real deployments still get Secure.
 */
async function useSecureCookie(): Promise<boolean> {
  const h = await headers();
  const proto = h.get('x-forwarded-proto');
  return proto ? proto.split(',')[0].trim() === 'https' : false;
}

export async function createSession(user: SessionUser): Promise<void> {
  const token = await new SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: await useSecureCookie(),
    path: '/',
    maxAge: MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.id !== 'number') return null;
    const user: SessionUser = {
      id: payload.id,
      email: String(payload.email),
      name: String(payload.name),
      role: payload.role as Role,
      share: payload.share === true,
    };

    // A share session outlives the JWT only as long as its link does. Revoking a
    // link deactivates its guest account, so checking that here makes revocation
    // take effect immediately instead of when the cookie eventually expires.
    if (user.share && !(await guestStillValid(user.id))) return null;

    return user;
  } catch {
    return null;
  }
}

async function guestStillValid(id: number): Promise<boolean> {
  const rows = await db
    .select({ active: s.appUser.active })
    .from(s.appUser)
    .where(eq(s.appUser.id, id))
    .limit(1);
  return rows[0]?.active === true;
}

/** Use in server components/actions that require a signed-in user. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect('/login');
  return user;
}

export async function requireWrite(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role === 'VIEW') {
    throw new Error('Your role is view-only. Ask an administrator to record this entry.');
  }
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== 'ADMIN') {
    throw new Error('Administrator access is required for this action.');
  }
  return user;
}

export async function verifyCredentials(
  email: string,
  password: string,
): Promise<SessionUser | null> {
  const rows = await db
    .select()
    .from(s.appUser)
    .where(eq(s.appUser.email, email.trim().toLowerCase()))
    .limit(1);

  const user = rows[0];
  if (!user || !user.active) return null;
  if (!(await bcrypt.compare(password, user.passwordHash))) return null;

  return { id: user.id, email: user.email, name: user.name, role: user.role as Role };
}
