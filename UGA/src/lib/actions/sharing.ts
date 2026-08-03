'use server';

import { randomBytes } from 'node:crypto';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db } from '@/db';
import * as s from '@/db/schema';
import { requireAdmin } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { MODE_LABEL, hashToken, lanAddress, shareBaseUrl } from '@/lib/sharing';
import type { ShareMode } from '@/lib/sharing';
import type { ActionState } from '@/components/RecordForm';

/** Base URL to hand out in a share link, for this request. */
async function baseUrl(): Promise<string> {
  const h = await headers();
  return shareBaseUrl({
    host: h.get('x-forwarded-host') ?? h.get('host'),
    forwardedProto: h.get('x-forwarded-proto'),
    lan: lanAddress(),
    configured: process.env.SHARE_BASE_URL,
  });
}

export async function createShareLink(_prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();

  const mode = String(form.get('mode') ?? '').trim() as ShareMode;
  if (mode !== 'VIEW' && mode !== 'TEAM') {
    return { ok: false, message: 'Choose view only or normal.', errors: { mode: 'Pick a mode.' } };
  }
  const label = String(form.get('label') ?? '').trim().slice(0, 60) || null;

  // 32 bytes of entropy, url-safe.
  const token = randomBytes(32).toString('base64url');
  // No expiry: the link works until an administrator revokes it.
  const expiresAt = null;

  // The guest account exists to satisfy the created_by foreign keys and to name
  // the actor in the Audit Log. Its password is 32 random bytes that are hashed
  // and immediately discarded, so the sign-in page is not a way in — the link
  // is. It stays active because revoking the link deactivates it, and that is
  // what makes an already-issued share session stop working.
  const guestName = `Shared link (${MODE_LABEL[mode]})${label ? ` — ${label}` : ''}`;
  const guestEmail = `share.${randomBytes(6).toString('hex')}@ugabrush.local`;
  const unusable = await bcrypt.hash(randomBytes(32).toString('hex'), 10);

  const url = `${await baseUrl()}/s/${token}`;

  await db.transaction(async (tx) => {
    const [guest] = await tx
      .insert(s.appUser)
      .values({
        email: guestEmail,
        name: guestName,
        passwordHash: unusable,
        role: mode,
        active: true,
      })
      .returning();

    await tx.insert(s.shareLink).values({
      tokenHash: hashToken(token),
      tokenHint: token.slice(0, 6),
      mode,
      label,
      guestUserId: guest.id,
      createdById: admin.id,
      createdByName: admin.name,
      expiresAt,
    });
  });

  await recordAudit({
    user: admin,
    action: 'RECORD',
    entity: 'Share link',
    refId: token.slice(0, 6),
    details: { mode, label, expiry: 'none' },
  });

  revalidatePath('/');
  // The URL travels back in the message — this is the only time it exists in
  // readable form, since only its hash is stored.
  return { ok: true, message: url };
}

export async function revokeShareLink(_prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();

  const id = Number(form.get('id'));
  if (!Number.isFinite(id)) return { ok: false, message: 'Which link?' };

  const rows = await db.select().from(s.shareLink).where(eq(s.shareLink.id, id)).limit(1);
  const link = rows[0];
  if (!link) return { ok: false, message: 'That link no longer exists.' };
  if (link.revokedAt) return { ok: true, message: 'Already revoked.' };

  await db.transaction(async (tx) => {
    await tx
      .update(s.shareLink)
      .set({ revokedAt: new Date(), revokedByName: admin.name })
      .where(eq(s.shareLink.id, id));

    // Deactivating the guest is what cuts off sessions that were already issued
    // from this link — getSession re-checks it on every request.
    await tx.update(s.appUser).set({ active: false }).where(eq(s.appUser.id, link.guestUserId));
  });

  await recordAudit({
    user: admin,
    action: 'VOID',
    entity: 'Share link',
    refId: link.tokenHint,
    details: { mode: link.mode, label: link.label },
  });

  revalidatePath('/');
  return { ok: true, message: 'Link revoked.' };
}
