/**
 * Business identifiers.
 *
 * DEVIATION 3: the spreadsheet derived every ID from row position
 * (="PU" & TEXT(ROW()-3)), so deleting a row renumbered everything below it and
 * broke references held in the Void Register and Audit Log. Here the next
 * number comes from the highest existing code and, once assigned, never changes.
 */

import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import * as s from '@/db/schema';

type Codeable =
  | typeof s.purchase
  | typeof s.inventoryMovement
  | typeof s.productionOperation
  | typeof s.dispatch
  | typeof s.meal
  | typeof s.deduction
  | typeof s.expense
  | typeof s.voidRegister;

async function nextCode(table: Codeable, prefix: string, width: number): Promise<string> {
  const rows = await db
    .select({ code: (table as any).code })
    .from(table as any)
    .orderBy(desc(sql`length(${(table as any).code})`), desc((table as any).code))
    .limit(1);

  const last = rows[0]?.code as string | undefined;
  const n = last ? Number(last.slice(prefix.length)) : 0;
  const next = (Number.isFinite(n) ? n : 0) + 1;
  return `${prefix}${String(next).padStart(width, '0')}`;
}

export const nextPurchaseCode = () => nextCode(s.purchase, 'PU', 5);
export const nextMovementCode = () => nextCode(s.inventoryMovement, 'MV', 5);
export const nextOperationCode = () => nextCode(s.productionOperation, 'OP', 5);
export const nextDispatchCode = () => nextCode(s.dispatch, 'DS', 5);
export const nextMealCode = () => nextCode(s.meal, 'MEAL', 4);
export const nextDeductionCode = () => nextCode(s.deduction, 'DED', 4);
export const nextExpenseCode = () => nextCode(s.expense, 'EXP', 4);
export const nextVoidCode = () => nextCode(s.voidRegister, 'VOID', 4);

/* ------------------------------------------------------------------------- */

/**
 * Batch numbers follow the sheet's convention: ITEMCODE-ddmmyy-NN, where NN is
 * the next free sequence for that item on that date.
 */
export async function nextBatchNo(itemCode: string, isoDate: string): Promise<string> {
  const [y, m, d] = isoDate.slice(0, 10).split('-');
  const stamp = `${d}${m}${y.slice(2)}`;
  const prefix = `${itemCode}-${stamp}-`;

  const rows = await db
    .select({ batchNo: s.batch.batchNo })
    .from(s.batch)
    .where(sql`${s.batch.batchNo} LIKE ${`${prefix}%`}`);

  let highest = 0;
  for (const r of rows) {
    const tail = Number(r.batchNo.slice(prefix.length));
    if (Number.isFinite(tail) && tail > highest) highest = tail;
  }

  return `${prefix}${String(highest + 1).padStart(2, '0')}`;
}

/** True when this batch number is already taken. */
export async function batchNoExists(batchNo: string): Promise<boolean> {
  const rows = await db
    .select({ id: s.batch.id })
    .from(s.batch)
    .where(eq(s.batch.batchNo, batchNo))
    .limit(1);
  return rows.length > 0;
}
