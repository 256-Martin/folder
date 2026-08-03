/**
 * Audit trail.
 *
 * Every mutation records who did it. The spreadsheet logged "(unknown)" for
 * every one of its 250 entries because the script could not resolve the active
 * user; here the signed-in identity is always attached.
 */

import { db } from '@/db';
import * as s from '@/db/schema';
import type { SessionUser } from './auth';

export async function recordAudit(opts: {
  user: SessionUser;
  action: string;
  entity: string;
  refId?: string | number | null;
  details?: unknown;
  result?: string;
}): Promise<void> {
  await db.insert(s.auditLog).values({
    userId: opts.user.id,
    userName: opts.user.name,
    action: opts.action,
    entity: opts.entity,
    refId: opts.refId === null || opts.refId === undefined ? null : String(opts.refId),
    details: (opts.details ?? null) as never,
    result: opts.result ?? 'OK',
  });
}

export async function recordReport(opts: {
  user: SessionUser;
  reportType: string;
  period?: string | null;
  filters?: string | null;
  note?: string | null;
  output?: string | null;
  action?: string;
}): Promise<void> {
  await db.insert(s.reportLog).values({
    userId: opts.user.id,
    userName: opts.user.name,
    action: opts.action ?? 'REPORT_GENERATED',
    reportType: opts.reportType,
    period: opts.period ?? null,
    filters: opts.filters ?? null,
    note: opts.note ?? null,
    status: 'OK',
    output: opts.output ?? null,
  });
}

/** Shallow before/after diff, stored on correction entries. */
export function diff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): { old: Record<string, unknown>; next: Record<string, unknown> } {
  const oldValues: Record<string, unknown> = {};
  const nextValues: Record<string, unknown> = {};

  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (String(before[key] ?? '') !== String(after[key] ?? '')) {
      oldValues[key] = before[key] ?? null;
      nextValues[key] = after[key] ?? null;
    }
  }

  return { old: oldValues, next: nextValues };
}
