/**
 * Share-link helpers.
 *
 * Deliberately NOT a 'use server' module: everything exported from one of those
 * becomes an endpoint the browser can call. Token redemption in particular must
 * stay server-only, or it would be an open oracle for guessing tokens. The two
 * things the dashboard genuinely needs to invoke — create and revoke — live in
 * lib/actions/sharing.ts instead.
 */

import { createHash } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import * as s from '@/db/schema';

export type ShareMode = 'VIEW' | 'TEAM';

export const MODE_LABEL: Record<ShareMode, string> = {
  VIEW: 'view only',
  TEAM: 'normal',
};

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** The machine's own address on the local network, if it has one. */
export function lanAddress(): string | null {
  for (const iface of Object.values(networkInterfaces())) {
    for (const net of iface ?? []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return null;
}

const PRIVATE_HOST = /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;

/**
 * Decide the base URL to put in a share link.
 *
 * An admin is almost always looking at localhost, and a link saying "localhost"
 * is useless to everyone else — on their device it points at their own device.
 * So when the request arrived on a loopback address the hostname is swapped for
 * this machine's LAN address, which is what a phone on the same WiFi can reach.
 *
 * `configured` (SHARE_BASE_URL) wins outright, for when the app is reached
 * through a domain or tunnel the server cannot infer for itself.
 *
 * Kept pure so the host-juggling can be tested without a request context.
 */
export function shareBaseUrl(opts: {
  host: string | null;
  forwardedProto?: string | null;
  lan?: string | null;
  configured?: string | null;
}): string {
  const configured = opts.configured?.trim();
  if (configured) return configured.replace(/\/+$/, '');

  const host = opts.host || 'localhost:3000';
  const isBracketed = host.startsWith('[');
  const sep = isBracketed ? host.indexOf(']') + 1 : host.indexOf(':');
  const hostname = sep > 0 ? host.slice(0, sep) : host;
  const port = sep > 0 ? host.slice(sep + 1) : '';

  const loopback = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  const lan = loopback ? opts.lan ?? null : null;
  const finalHost = lan ? (port ? `${lan}:${port}` : lan) : host;

  const isLocal = loopback || PRIVATE_HOST.test(finalHost);
  const proto = opts.forwardedProto ?? (isLocal ? 'http' : 'https');

  return `${proto}://${finalHost}`;
}

export type ActiveShare = {
  id: number;
  mode: string;
  label: string | null;
  tokenHint: string;
  createdByName: string | null;
  createdAt: Date;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  uses: number;
  expired: boolean;
};

/** Links that have not been revoked, newest first. */
export async function listShareLinks(): Promise<ActiveShare[]> {
  const rows = await db
    .select()
    .from(s.shareLink)
    .where(isNull(s.shareLink.revokedAt))
    .orderBy(desc(s.shareLink.createdAt));

  const now = Date.now();
  return rows.map((r) => ({
    id: r.id,
    mode: r.mode,
    label: r.label,
    tokenHint: r.tokenHint,
    createdByName: r.createdByName,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
    lastUsedAt: r.lastUsedAt,
    uses: r.uses,
    expired: r.expiresAt !== null && r.expiresAt.getTime() <= now,
  }));
}

/**
 * Exchange a token for the session it grants. Returns null when the link is
 * unknown, revoked, expired, or its guest account has been disabled.
 */
export async function redeemShareToken(token: string) {
  if (!token || token.length < 20) return null;

  const rows = await db
    .select({ link: s.shareLink, guest: s.appUser })
    .from(s.shareLink)
    .innerJoin(s.appUser, eq(s.appUser.id, s.shareLink.guestUserId))
    .where(and(eq(s.shareLink.tokenHash, hashToken(token)), isNull(s.shareLink.revokedAt)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (!row.guest.active) return null;
  // A null expiry means the link lasts until it is revoked.
  if (row.link.expiresAt !== null && row.link.expiresAt.getTime() <= Date.now()) return null;

  await db
    .update(s.shareLink)
    .set({ lastUsedAt: new Date(), uses: row.link.uses + 1 })
    .where(eq(s.shareLink.id, row.link.id));

  return {
    id: row.guest.id,
    email: row.guest.email,
    name: row.guest.name,
    role: row.link.mode as ShareMode,
  };
}
