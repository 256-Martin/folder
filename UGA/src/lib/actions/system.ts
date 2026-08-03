'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import * as s from '@/db/schema';
import { requireAdmin } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { nextVoidCode } from '@/lib/codes';

/**
 * Voiding never deletes. The row is flagged, a snapshot of it is stored in the
 * Void Register against its stable primary key, and every derived figure simply
 * stops counting it. Restoring puts it straight back.
 */

type Entity = 'purchase' | 'movement' | 'operation' | 'dispatch' | 'meal' | 'deduction' | 'expense';

const TABLES = {
  purchase: s.purchase,
  movement: s.inventoryMovement,
  operation: s.productionOperation,
  dispatch: s.dispatch,
  meal: s.meal,
  deduction: s.deduction,
  expense: s.expense,
} as const;

const LABELS: Record<Entity, string> = {
  purchase: 'Purchases Log',
  movement: 'Inventory Ledger',
  operation: 'Production Operations Log',
  dispatch: 'Sales - Dispatch Log',
  meal: 'Meal Log',
  deduction: 'Deductions Log',
  expense: 'Expense & Provider Payments',
};

function touchAll() {
  for (const p of [
    '/',
    '/purchases',
    '/inventory',
    '/batches',
    '/production',
    '/dispatch',
    '/meals',
    '/deductions',
    '/expenses',
    '/wip',
    '/labour',
    '/payments',
    '/scorecard',
    '/system/voids',
    '/system/data-issues',
    '/stock/materials',
    '/stock/handles',
    '/stock/ustaples',
    '/stock/finished',
  ]) {
    revalidatePath(p);
  }
}

export async function voidEntry(form: FormData): Promise<void> {
  const user = await requireAdmin();

  const entity = String(form.get('entity') ?? '') as Entity;
  const id = Number(form.get('id'));
  const reason = String(form.get('reason') ?? '').trim();

  const table = TABLES[entity];
  if (!table || !id) throw new Error('Unknown record.');
  if (!reason) throw new Error('A reason for voiding is required.');

  const rows = await db.select().from(table as never).where(eq((table as never as { id: never }).id, id as never));
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) throw new Error('That record no longer exists.');
  if (row.voidedAt) throw new Error('That record is already voided.');

  const now = new Date();
  const effects: string[] = [];

  await db.transaction(async (tx) => {
    await tx
      .update(table as never)
      .set({ voidedAt: now, voidedById: user.id } as never)
      .where(eq((table as never as { id: never }).id, id as never));

    // A purchase carries its batch and its ledger receipt with it.
    if (entity === 'purchase') {
      const linkedBatches = await tx
        .update(s.batch)
        .set({ voidedAt: now })
        .where(eq(s.batch.purchaseId, id))
        .returning();
      const linkedMovements = await tx
        .update(s.inventoryMovement)
        .set({ voidedAt: now })
        .where(eq(s.inventoryMovement.sourcePurchaseId, id))
        .returning();
      if (linkedBatches.length) effects.push(`batch ${linkedBatches.map((b) => b.batchNo).join(', ')}`);
      if (linkedMovements.length)
        effects.push(`ledger receipt ${linkedMovements.map((m) => m.code).join(', ')}`);
    }

    if (entity === 'dispatch') {
      const linked = await tx
        .update(s.inventoryMovement)
        .set({ voidedAt: now })
        .where(eq(s.inventoryMovement.sourceDispatchId, id))
        .returning();
      if (linked.length) effects.push(`ledger dispatch ${linked.map((m) => m.code).join(', ')}`);
    }

    await tx.insert(s.voidRegister).values({
      code: await nextVoidCode(),
      logType: entity,
      entity: LABELS[entity],
      sourceId: id,
      entryCode: String(row.code ?? ''),
      reason,
      voidedById: user.id,
      voidedByName: user.name,
      status: 'Voided',
      reversalEffect:
        effects.length > 0
          ? `Stops counting everywhere; also voided ${effects.join(' and ')}.`
          : 'Stops counting in all summaries and reports.',
      oldValues: row as never,
    });
  });

  await recordAudit({
    user,
    action: 'VOID',
    entity: LABELS[entity],
    refId: String(row.code ?? id),
    details: { reason, old: row },
  });

  touchAll();
}

export async function restoreEntry(form: FormData): Promise<void> {
  const user = await requireAdmin();

  const voidId = Number(form.get('voidId'));
  const rows = await db.select().from(s.voidRegister).where(eq(s.voidRegister.id, voidId));
  const record = rows[0];
  if (!record) throw new Error('That void entry no longer exists.');
  if (record.status === 'Restored') throw new Error('That entry has already been restored.');
  if (!record.sourceId) throw new Error('This entry was imported from the spreadsheet and cannot be restored automatically.');

  const entity = record.logType as Entity;
  const table = TABLES[entity];
  if (!table) throw new Error('Unknown record type.');

  await db.transaction(async (tx) => {
    await tx
      .update(table as never)
      .set({ voidedAt: null, voidedById: null } as never)
      .where(eq((table as never as { id: never }).id, record.sourceId as never));

    if (entity === 'purchase') {
      await tx.update(s.batch).set({ voidedAt: null }).where(eq(s.batch.purchaseId, record.sourceId!));
      await tx
        .update(s.inventoryMovement)
        .set({ voidedAt: null })
        .where(eq(s.inventoryMovement.sourcePurchaseId, record.sourceId!));
    }
    if (entity === 'dispatch') {
      await tx
        .update(s.inventoryMovement)
        .set({ voidedAt: null })
        .where(eq(s.inventoryMovement.sourceDispatchId, record.sourceId!));
    }

    await tx
      .update(s.voidRegister)
      .set({ status: 'Restored', restoredAt: new Date(), restoredByName: user.name })
      .where(eq(s.voidRegister.id, voidId));
  });

  await recordAudit({
    user,
    action: 'RESTORE',
    entity: record.entity,
    refId: record.entryCode ?? String(record.sourceId),
    details: { voidCode: record.code },
  });

  touchAll();
}

/* ===========================================================================
 * Batch rename — logged, as the spreadsheet does
 * ======================================================================== */

export async function renameBatch(form: FormData): Promise<void> {
  const user = await requireAdmin();

  const oldBatchNo = String(form.get('oldBatchNo') ?? '').trim();
  const newBatchNo = String(form.get('newBatchNo') ?? '').trim();
  const reason = String(form.get('reason') ?? '').trim();

  if (!oldBatchNo || !newBatchNo) throw new Error('Both batch numbers are required.');
  if (!reason) throw new Error('A reason is required.');

  const existing = await db.select().from(s.batch).where(eq(s.batch.batchNo, newBatchNo));
  if (existing.length) throw new Error(`Batch ${newBatchNo} already exists.`);

  const rows = await db.select().from(s.batch).where(eq(s.batch.batchNo, oldBatchNo));
  const target = rows[0];
  if (!target) throw new Error(`Batch ${oldBatchNo} was not found.`);

  await db.transaction(async (tx) => {
    await tx.update(s.batch).set({ batchNo: newBatchNo }).where(eq(s.batch.id, target.id));
    await tx
      .update(s.inventoryMovement)
      .set({ batchNo: newBatchNo })
      .where(eq(s.inventoryMovement.batchNo, oldBatchNo));
    await tx.update(s.purchase).set({ batchNo: newBatchNo }).where(eq(s.purchase.batchNo, oldBatchNo));
    await tx
      .update(s.productionOperation)
      .set({ inputBatch: newBatchNo })
      .where(eq(s.productionOperation.inputBatch, oldBatchNo));

    await tx.insert(s.batchRenameLog).values({
      oldBatchNo,
      newBatchNo,
      itemCode: String(target.itemId),
      oldPurchaseDate: target.purchaseDate,
      newPurchaseDate: target.purchaseDate,
      changedByName: user.name,
      reason,
      status: 'Applied',
    });
  });

  await recordAudit({
    user,
    action: 'CORRECTION',
    entity: 'Batch Register',
    refId: newBatchNo,
    details: { old: oldBatchNo, next: newBatchNo, reason },
  });

  touchAll();
  revalidatePath('/system/batch-renames');
}
