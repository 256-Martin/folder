'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import * as s from '@/db/schema';
import { requireWrite } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import {
  batchNoExists,
  nextBatchNo,
  nextDeductionCode,
  nextDispatchCode,
  nextExpenseCode,
  nextMealCode,
  nextMovementCode,
  nextOperationCode,
  nextPurchaseCode,
} from '@/lib/codes';
import { loadSnapshot, rateInForce } from '@/lib/core';
import { costMeal, qualificationFor } from '@/lib/meal-engine';
import { isFutureBeyond, today, weekStart } from '@/lib/dates';
import type { ActionState } from '@/components/RecordForm';

/* -------------------------------------------------------------------- utils */

function fail(message: string, errors?: Record<string, string>): ActionState {
  return { ok: false, message, errors };
}
function done(message: string): ActionState {
  return { ok: true, message };
}

const num = (v: FormDataEntryValue | null) => {
  const n = Number(String(v ?? '').trim());
  return Number.isFinite(n) ? n : NaN;
};
const str = (v: FormDataEntryValue | null) => String(v ?? '').trim();
const strOrNull = (v: FormDataEntryValue | null) => {
  const x = str(v);
  return x === '' ? null : x;
};

/** Entries dated too far ahead are blocked, matching Settings "Future-date limit". */
async function checkDate(date: string): Promise<string | null> {
  if (!date) return 'A date is required.';
  const rows = await db
    .select()
    .from(s.appSetting)
    .where(eq(s.appSetting.key, 'Future-date limit (days)'));
  const limit = Number(rows[0]?.value ?? 3);
  if (Number.isFinite(limit) && isFutureBeyond(date, limit)) {
    return `That date is more than ${limit} days in the future.`;
  }
  return null;
}

function touch(...paths: string[]) {
  for (const p of paths) revalidatePath(p);
  revalidatePath('/');
}

/* ===========================================================================
 * PURCHASES  — writes Purchase + Batch + Inventory receipt atomically
 * ======================================================================== */

export async function createPurchase(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireWrite();

  const parsed = z
    .object({
      date: z.string().min(1),
      supplierId: z.coerce.number().int().positive(),
      itemId: z.coerce.number().int().positive(),
      qty: z.coerce.number().positive('Quantity must be greater than zero.'),
      totalCost: z.coerce.number().positive('Total cost must be greater than zero.'),
    })
    .safeParse({
      date: str(form.get('date')),
      supplierId: form.get('supplierId'),
      itemId: form.get('itemId'),
      qty: form.get('qty'),
      totalCost: form.get('totalCost'),
    });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] = issue.message;
    return fail('Please correct the highlighted fields.', errors);
  }

  const dateError = await checkDate(parsed.data.date);
  if (dateError) return fail(dateError, { date: dateError });

  const item = (await db.select().from(s.item).where(eq(s.item.id, parsed.data.itemId)))[0];
  if (!item) return fail('That item is not in the Item Master.');

  let batchNo = strOrNull(form.get('batchNo'));
  if (item.trackedByBatch) {
    batchNo = batchNo ?? (await nextBatchNo(item.code, parsed.data.date));
    if (await batchNoExists(batchNo)) {
      return fail(`Batch ${batchNo} already exists.`, { batchNo: 'Duplicate batch number.' });
    }
  }

  const unitCost = parsed.data.totalCost / parsed.data.qty;
  const code = await nextPurchaseCode();
  const quality = strOrNull(form.get('qualityNotes'));

  await db.transaction(async (tx) => {
    const [purchase] = await tx
      .insert(s.purchase)
      .values({
        code,
        date: parsed.data.date,
        supplierId: parsed.data.supplierId,
        itemId: parsed.data.itemId,
        batchNo,
        qty: parsed.data.qty,
        totalCost: parsed.data.totalCost,
        qualityNotes: quality,
        createdById: user.id,
        createdByName: user.name,
      })
      .returning();

    if (batchNo) {
      await tx.insert(s.batch).values({
        batchNo,
        itemId: parsed.data.itemId,
        supplierId: parsed.data.supplierId,
        purchaseDate: parsed.data.date,
        qtyReceived: parsed.data.qty,
        unitCost,
        quality,
        purchaseId: purchase.id,
      });
    }

    await tx.insert(s.inventoryMovement).values({
      code: await nextMovementCode(),
      date: parsed.data.date,
      itemId: parsed.data.itemId,
      batchNo,
      movementType: 'Receipt',
      qty: parsed.data.qty,
      unitCost,
      refSource: 'Purchase',
      byName: user.name,
      note: quality,
      sourcePurchaseId: purchase.id,
      createdById: user.id,
    });
  });

  await recordAudit({
    user,
    action: 'RECORD',
    entity: 'Purchase',
    refId: code,
    details: { ...parsed.data, batchNo, unitCost },
  });

  touch('/purchases', '/inventory', '/batches', '/scorecard');
  return done(`Recorded ${code}${batchNo ? ` — batch ${batchNo}` : ''}.`);
}

/* ===========================================================================
 * INVENTORY MOVEMENTS — issues, returns, adjustments
 * ======================================================================== */

export async function createMovement(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireWrite();

  const date = str(form.get('date'));
  const itemId = Number(form.get('itemId'));
  const movementType = str(form.get('movementType'));
  const qtyValue = num(form.get('qty'));

  if (!date || !itemId || !movementType) return fail('Date, item and movement type are required.');
  if (!Number.isFinite(qtyValue) || qtyValue === 0) {
    return fail('Quantity must be a non-zero number.', { qty: 'Enter a quantity.' });
  }

  const dateError = await checkDate(date);
  if (dateError) return fail(dateError, { date: dateError });

  const item = (await db.select().from(s.item).where(eq(s.item.id, itemId)))[0];
  if (!item) return fail('That item is not in the Item Master.');

  const batchNo = strOrNull(form.get('batchNo'));
  if (item.trackedByBatch && movementType === 'Issue to production' && !batchNo) {
    return fail('This item is batch-tracked — choose the batch being issued.', {
      batchNo: 'Batch required.',
    });
  }

  const code = await nextMovementCode();
  await db.insert(s.inventoryMovement).values({
    code,
    date,
    itemId,
    batchNo,
    movementType,
    qty: Math.abs(qtyValue),
    unitCost: Number.isFinite(num(form.get('unitCost'))) ? num(form.get('unitCost')) : item.standardCost,
    refSource: strOrNull(form.get('refSource')) ?? movementType,
    byName: user.name,
    note: strOrNull(form.get('note')),
    issuedToType: strOrNull(form.get('issuedToType')),
    issuedTo: strOrNull(form.get('issuedTo')),
    receivedBy: strOrNull(form.get('receivedBy')),
    createdById: user.id,
  });

  await recordAudit({
    user,
    action: 'RECORD',
    entity: 'Inventory Movement',
    refId: code,
    details: { date, item: item.code, movementType, qty: qtyValue, batchNo },
  });

  touch('/inventory', '/batches', '/stock/materials', '/stock/handles', '/stock/ustaples');
  return done(`Recorded ${code}.`);
}

/* ===========================================================================
 * PRODUCTION OPERATIONS
 * ======================================================================== */

export async function createOperation(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireWrite();

  const date = str(form.get('date'));
  const workerId = Number(form.get('workerId'));
  const processId = Number(form.get('processId'));
  const productItemId = Number(form.get('productItemId'));
  const acceptedQty = num(form.get('acceptedQty')) || 0;
  const rejectedQty = num(form.get('rejectedQty')) || 0;
  const rejectReason = strOrNull(form.get('rejectReason'));

  if (!date || !workerId || !processId || !productItemId) {
    return fail('Date, worker, process and product are all required.');
  }
  const dateError = await checkDate(date);
  if (dateError) return fail(dateError, { date: dateError });

  if (acceptedQty + rejectedQty <= 0) {
    return fail('Accepted + Rejected must be greater than zero.', {
      acceptedQty: 'Enter the quantity produced.',
    });
  }
  if (rejectedQty > 0 && !rejectReason) {
    return fail('A reject reason is required when rejected quantity is above zero.', {
      rejectReason: 'Choose a reason.',
    });
  }

  const snap = await loadSnapshot();
  const rate = rateInForce(snap, processId, productItemId, date);

  const allowWithoutRate =
    (snap.setting('Allow operation without piece rate') ?? 'No').toLowerCase() === 'yes';
  if (rate === null && !allowWithoutRate) {
    const proc = snap.processById.get(processId)?.code ?? 'this process';
    const prod = snap.itemById.get(productItemId)?.code ?? 'this product';
    return fail(
      `No piece rate is set for ${proc} × ${prod}. Set the rate under Master Data → Piece Rates, or allow rate-free entry in Settings.`,
      { productItemId: 'Missing piece rate.' },
    );
  }

  // Optional enforcement of the worker/process skills matrix.
  if ((snap.setting('Enforce Worker Process Assignment?') ?? 'No').toLowerCase() === 'yes') {
    const skills = await db
      .select()
      .from(s.workerProcessSkill)
      .where(eq(s.workerProcessSkill.workerId, workerId));
    if (!skills.some((k) => k.processId === processId && k.active)) {
      return fail('That worker is not assigned to this process.', {
        workerId: 'Not assigned to this process.',
      });
    }
  }

  const code = await nextOperationCode();
  const wipStage = snap.processById.get(processId)?.outputStage ?? null;

  await db.insert(s.productionOperation).values({
    code,
    date,
    workerId,
    processId,
    productItemId,
    inputBatch: strOrNull(form.get('inputBatch')),
    outputBatch: strOrNull(form.get('outputBatch')),
    acceptedQty,
    rejectedQty,
    rejectReason,
    pieceRateApplied: rate,
    directLabourCost: acceptedQty * (rate ?? 0),
    wipStage,
    notes: strOrNull(form.get('notes')),
    createdById: user.id,
    createdByName: user.name,
  });

  await recordAudit({
    user,
    action: 'RECORD',
    entity: 'Production Operation',
    refId: code,
    details: { date, workerId, processId, productItemId, acceptedQty, rejectedQty, rate },
  });

  touch('/production', '/wip', '/labour', '/productivity', '/payments', '/meals/qualification');
  return done(`Recorded ${code} — direct labour ${(acceptedQty * (rate ?? 0)).toLocaleString()} UGX.`);
}

/* ===========================================================================
 * DISPATCH — writes the sale and the stock movement together
 * ======================================================================== */

export async function createDispatch(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireWrite();

  const date = str(form.get('date'));
  const productItemId = Number(form.get('productItemId'));
  const qty = num(form.get('qty'));
  const unitPrice = num(form.get('unitPrice'));
  const destinationName = str(form.get('destinationName'));

  if (!date || !productItemId || !destinationName) {
    return fail('Date, product and destination are required.');
  }
  if (!Number.isFinite(qty) || qty <= 0) {
    return fail('Quantity must be greater than zero.', { qty: 'Enter a quantity.' });
  }
  const dateError = await checkDate(date);
  if (dateError) return fail(dateError, { date: dateError });

  const code = await nextDispatchCode();

  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(s.dispatch)
      .values({
        code,
        date,
        destinationName,
        productItemId,
        qty,
        unitPrice: Number.isFinite(unitPrice) ? unitPrice : null,
        note: strOrNull(form.get('note')),
        destinationType: strOrNull(form.get('destinationType')),
        personResponsible: strOrNull(form.get('personResponsible')),
        deliveryNoteNo: strOrNull(form.get('deliveryNoteNo')),
        salesOrderNo: strOrNull(form.get('salesOrderNo')),
        createdById: user.id,
      })
      .returning();

    await tx.insert(s.inventoryMovement).values({
      code: await nextMovementCode(),
      date,
      itemId: productItemId,
      movementType: 'Dispatch',
      qty,
      unitCost: Number.isFinite(unitPrice) ? unitPrice : null,
      refSource: 'Dispatch',
      byName: user.name,
      note: destinationName,
      sourceDispatchId: row.id,
      createdById: user.id,
    });
  });

  await recordAudit({
    user,
    action: 'RECORD',
    entity: 'Dispatch',
    refId: code,
    details: { date, productItemId, qty, unitPrice, destinationName },
  });

  touch('/dispatch', '/inventory', '/stock/finished', '/wip');
  return done(`Recorded ${code}.`);
}

/* ===========================================================================
 * MEALS
 * ======================================================================== */

export async function createMeal(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireWrite();

  const date = str(form.get('date'));
  const workerId = Number(form.get('workerId'));
  const plateCount = num(form.get('plateCount'));

  if (!date || !workerId) return fail('Date and worker are required.');
  if (!Number.isFinite(plateCount) || plateCount <= 0) {
    return fail('Plate count must be greater than zero.', { plateCount: 'Enter plates taken.' });
  }
  const dateError = await checkDate(date);
  if (dateError) return fail(dateError, { date: dateError });

  const snap = await loadSnapshot();
  const q = qualificationFor(snap, workerId, date);

  const cashPaid = Number.isFinite(num(form.get('workerCashPaid')))
    ? num(form.get('workerCashPaid'))
    : 0;
  const plateCostOverride = Number.isFinite(num(form.get('actualPlateCost')))
    ? num(form.get('actualPlateCost'))
    : null;
  const contributionOverride = Number.isFinite(num(form.get('actualCompanyContribution')))
    ? num(form.get('actualCompanyContribution'))
    : null;
  const fullySponsored = str(form.get('companyFullySponsored')) === 'Yes';

  const costing = costMeal(snap, {
    plateCount,
    daysRemaining: q.daysRemaining,
    workerCashPaid: cashPaid,
    plateCostOverride,
    companyContributionOverride: contributionOverride,
    companyFullySponsored: fullySponsored,
  });

  const code = await nextMealCode();
  const providerId = Number(form.get('foodProviderId')) || null;

  await db.insert(s.meal).values({
    code,
    date,
    workerId,
    plateCount,
    qualified: costing.qualified === 'Yes' ? 'Yes' : costing.qualified === 'Partly' ? 'Partly' : 'No',
    qualifiedPlates: costing.qualifiedPlates,
    unqualifiedPlates: costing.unqualifiedPlates,
    companyContribution: costing.companyContribution,
    workerTopUp: costing.workerTopUp,
    fullCostDeduction: costing.fullCostDeduction,
    totalWorkerDeduction: costing.totalWorkerDeduction,
    workerCashPaid: cashPaid,
    netWorkerMealBalance: costing.netWorkerMealBalance,
    weekStart: weekStart(date, snap.weekStartsOn),
    companyFullySponsored: fullySponsored ? 'Yes' : 'No',
    foodProviderId: providerId,
    actualPlateCost: costing.plateCost,
    actualCompanyContribution: contributionOverride,
    workerRequiredContribution: costing.workerRequiredContribution,
    supplierPriceChanged: plateCostOverride === null ? 'No' : 'Yes',
    contributionChanged: contributionOverride === null ? 'No' : 'Yes',
    reasonForChange: strOrNull(form.get('reasonForChange')),
    note: strOrNull(form.get('note')),
    approvedBy: strOrNull(form.get('approvedBy')),
    createdById: user.id,
  });

  await recordAudit({
    user,
    action: 'RECORD',
    entity: 'Meal',
    refId: code,
    details: { date, workerId, plateCount, ...costing, daysRemaining: q.daysRemaining },
  });

  touch('/meals', '/meals/deductions', '/meals/qualification', '/payments');
  return done(
    `Recorded ${code} — ${costing.qualifiedPlates} qualified, ${costing.unqualifiedPlates} unqualified.`,
  );
}

/* ===========================================================================
 * DEDUCTIONS & EXPENSES
 * ======================================================================== */

export async function createDeduction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireWrite();

  const date = str(form.get('date'));
  const workerId = Number(form.get('workerId'));
  const amount = num(form.get('amount'));
  const reason = strOrNull(form.get('reason'));

  if (!date || !workerId) return fail('Date and worker are required.');
  if (!Number.isFinite(amount) || amount <= 0) {
    return fail('Amount must be greater than zero.', { amount: 'Enter an amount.' });
  }
  if (!reason) return fail('A reason is required.', { reason: 'Enter a reason.' });

  const code = await nextDeductionCode();
  await db.insert(s.deduction).values({
    code,
    date,
    workerId,
    deductionType: str(form.get('deductionType')) || 'Other',
    amount,
    reason,
    approvedBy: strOrNull(form.get('approvedBy')),
    status: str(form.get('status')) || 'Pending',
    notes: strOrNull(form.get('notes')),
    createdById: user.id,
  });

  await recordAudit({ user, action: 'RECORD', entity: 'Deduction', refId: code, details: { date, workerId, amount } });
  touch('/deductions', '/payments');
  return done(`Recorded ${code}.`);
}

export async function createExpense(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireWrite();

  const date = str(form.get('date'));
  const providerId = Number(form.get('providerId'));
  const totalBill = num(form.get('totalBill'));
  const amountPaid = Number.isFinite(num(form.get('amountPaid'))) ? num(form.get('amountPaid')) : 0;

  if (!date || !providerId) return fail('Date and provider are required.');
  if (!Number.isFinite(totalBill) || totalBill <= 0) {
    return fail('Total bill must be greater than zero.', { totalBill: 'Enter the bill amount.' });
  }
  if (amountPaid > totalBill) {
    return fail('Amount paid cannot exceed the total bill.', { amountPaid: 'Paid more than billed.' });
  }

  const code = await nextExpenseCode();
  await db.insert(s.expense).values({
    code,
    date,
    providerId,
    expenseCategory: strOrNull(form.get('expenseCategory')),
    periodFrom: strOrNull(form.get('periodFrom')),
    periodTo: strOrNull(form.get('periodTo')),
    plates: Number.isFinite(num(form.get('plates'))) ? num(form.get('plates')) : null,
    plateCost: Number.isFinite(num(form.get('plateCost'))) ? num(form.get('plateCost')) : null,
    totalBill,
    amountPaid,
    accountPaidFrom: strOrNull(form.get('accountPaidFrom')),
    paymentMethod: strOrNull(form.get('paymentMethod')),
    transactionNo: strOrNull(form.get('transactionNo')),
    paidBy: strOrNull(form.get('paidBy')),
    notes: strOrNull(form.get('notes')),
    createdById: user.id,
  });

  await recordAudit({ user, action: 'RECORD', entity: 'Expense', refId: code, details: { date, providerId, totalBill, amountPaid } });
  touch('/expenses');
  return done(`Recorded ${code}.`);
}

export { today };
