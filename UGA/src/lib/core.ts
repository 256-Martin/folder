/**
 * The calculation engine.
 *
 * Every derived figure in the system is computed here from the transaction
 * tables — nothing is ever stored as a balance. This is the direct equivalent
 * of the spreadsheet's formula layer (WIP Summary, the stock summaries, Direct
 * Labour, the scorecards, Final Worker Payment and Data Issues).
 */

import { isNull } from 'drizzle-orm';
import { db } from '@/db';
import * as s from '@/db/schema';
import { currentMonth, monthOf, weekStart } from './dates';
import {
  FINISHED_GOODS,
  HANDLE_CODES,
  PRODUCT_HANDLE,
  WIP_STAGES,
  signOf,
  stockStatus,
  type StockStatus,
} from './constants';

/* ========================================================================== *
 * Snapshot
 * ========================================================================== */

export type Snapshot = Awaited<ReturnType<typeof loadSnapshot>>;

export async function loadSnapshot() {
  const [
    items,
    suppliers,
    workers,
    processes,
    rates,
    purchases,
    batches,
    movements,
    operations,
    dispatches,
    meals,
    deductions,
    expenses,
    settings,
    mealCost,
    listOptions,
    mealRules,
    reportHeader,
    workerSkills,
  ] = await Promise.all([
    db.select().from(s.item),
    db.select().from(s.supplier),
    db.select().from(s.worker),
    db.select().from(s.process),
    db.select().from(s.pieceRate),
    db.select().from(s.purchase).where(isNull(s.purchase.voidedAt)),
    db.select().from(s.batch).where(isNull(s.batch.voidedAt)),
    db.select().from(s.inventoryMovement).where(isNull(s.inventoryMovement.voidedAt)),
    db.select().from(s.productionOperation).where(isNull(s.productionOperation.voidedAt)),
    db.select().from(s.dispatch).where(isNull(s.dispatch.voidedAt)),
    db.select().from(s.meal).where(isNull(s.meal.voidedAt)),
    db.select().from(s.deduction).where(isNull(s.deduction.voidedAt)),
    db.select().from(s.expense).where(isNull(s.expense.voidedAt)),
    db.select().from(s.appSetting),
    db.select().from(s.mealCostSetting),
    db.select().from(s.listOption),
    db.select().from(s.mealQualificationRule),
    db.select().from(s.reportHeaderSetting),
    db.select().from(s.workerProcessSkill),
  ]);

  const itemById = new Map(items.map((i) => [i.id, i]));
  const itemByCode = new Map(items.map((i) => [i.code, i]));
  const supplierById = new Map(suppliers.map((x) => [x.id, x]));
  const workerById = new Map(workers.map((x) => [x.id, x]));
  const processById = new Map(processes.map((x) => [x.id, x]));

  const movementSigns = new Map(
    listOptions
      .filter((o) => o.category === 'Movement Type' && o.numericMeta !== null)
      .map((o) => [o.value, Number(o.numericMeta)]),
  );

  const setting = (key: string) => settings.find((x) => x.key === key)?.value ?? null;
  const mealSetting = (key: string) => mealCost.find((x) => x.key === key)?.value ?? null;
  const mealNumber = (key: string, fallback: number) => {
    const v = mealSetting(key);
    const n = v === null ? NaN : Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  return {
    items,
    suppliers,
    workers,
    processes,
    rates,
    purchases,
    batches,
    movements,
    operations,
    dispatches,
    meals,
    deductions,
    expenses,
    settings,
    mealCost,
    listOptions,
    mealRules,
    reportHeader,
    workerSkills,
    brand: (key: string) => reportHeader.find((x) => x.key === key)?.value ?? null,
    itemById,
    itemByCode,
    supplierById,
    workerById,
    processById,
    movementSigns,
    setting,
    mealSetting,
    mealNumber,
    month: currentMonth(),
    weekStartsOn: Number(mealSetting('Week starts on (1=Mon ... 7=Sun)') ?? 1) || 1,
  };
}

/* ========================================================================== *
 * Stock
 * ========================================================================== */

export type StockRow = {
  itemId: number;
  code: string;
  name: string;
  category: string;
  uom: string;
  received: number;
  produced: number;
  issued: number;
  dispatched: number;
  balance: number;
  reorderLevel: number | null;
  status: StockStatus;
  issuedThisMonth: number;
  standardCost: number | null;
  valueOnHand: number;
};

export function stockRows(snap: Snapshot, month = snap.month): StockRow[] {
  const acc = new Map<number, StockRow>();

  for (const it of snap.items) {
    acc.set(it.id, {
      itemId: it.id,
      code: it.code,
      name: it.name,
      category: it.category,
      uom: it.baseUom,
      received: 0,
      produced: 0,
      issued: 0,
      dispatched: 0,
      balance: 0,
      reorderLevel: it.reorderLevel,
      status: 'OK',
      issuedThisMonth: 0,
      standardCost: it.standardCost,
      valueOnHand: 0,
    });
  }

  for (const m of snap.movements) {
    const row = acc.get(m.itemId);
    if (!row) continue;

    const sign = signOf(m.movementType, snap.movementSigns);
    row.balance += m.qty * sign;

    switch (m.movementType) {
      case 'Receipt':
        row.received += m.qty;
        break;
      case 'Produced':
        row.produced += m.qty;
        break;
      case 'Issue to production':
        row.issued += m.qty;
        if (monthOf(m.date) === month) row.issuedThisMonth += m.qty;
        break;
      case 'Dispatch':
        row.dispatched += m.qty;
        break;
    }
  }

  for (const row of acc.values()) {
    row.status = stockStatus(row.balance, row.reorderLevel);
    row.valueOnHand = row.balance * (row.standardCost ?? 0);
  }

  return [...acc.values()];
}

/** Material Stock Summary: raw materials and consumables. */
export function materialStock(snap: Snapshot, month?: string): StockRow[] {
  return stockRows(snap, month).filter(
    (r) => r.category === 'Raw Material' || r.category === 'Consumable',
  );
}

/** Handle Stock Summary. */
export function handleStock(snap: Snapshot, month?: string): StockRow[] {
  return stockRows(snap, month).filter((r) => HANDLE_CODES.includes(r.code));
}

/** U-Staple Stock Summary. */
export function ustapleStock(snap: Snapshot, month?: string): StockRow[] {
  return stockRows(snap, month).filter((r) => r.code === 'USTAPLE');
}

export type FinishedGoodRow = {
  code: string;
  name: string;
  produced: number;
  dispatched: number;
  inStock: number;
  rejected: number;
  valueOnHand: number;
};

export function finishedGoods(snap: Snapshot): FinishedGoodRow[] {
  const stock = new Map(stockRows(snap).map((r) => [r.code, r]));

  return FINISHED_GOODS.map((code) => {
    const row = stock.get(code);
    const it = snap.itemByCode.get(code);
    const rejected = snap.operations
      .filter(
        (o) =>
          snap.processById.get(o.processId)?.code === 'QC' &&
          snap.itemById.get(o.productItemId)?.code === code,
      )
      .reduce((sum, o) => sum + o.rejectedQty, 0);

    return {
      code,
      name: it?.name ?? code,
      produced: row?.produced ?? 0,
      dispatched: row?.dispatched ?? 0,
      inStock: row?.balance ?? 0,
      rejected,
      valueOnHand: (row?.balance ?? 0) * (it?.standardCost ?? 0),
    };
  });
}

/* ========================================================================== *
 * Work in progress
 * ========================================================================== */

/**
 * Accepted quantity at a process, keyed by the item code the operation was
 * recorded against.
 */
function acceptedBy(snap: Snapshot, processCode: string, itemCode: string): number {
  return snap.operations
    .filter(
      (o) =>
        snap.processById.get(o.processId)?.code === processCode &&
        snap.itemById.get(o.productItemId)?.code === itemCode,
    )
    .reduce((sum, o) => sum + o.acceptedQty, 0);
}

export type WipHandleRow = {
  handleCode: string;
  handleName: string;
  stages: { key: string; label: string; value: number }[];
  totalInLine: number;
};

/**
 * Handle-side WIP, reported once per handle code.
 *
 * DEVIATION 2: the sheet keys these four stages on the handle code but repeats
 * them on every product row, so HDL-L (shared by BR-L and BR-CUSTOM) is counted
 * twice in every roll-up. Reporting per handle removes the double count.
 */
export function wipHandles(snap: Snapshot): WipHandleRow[] {
  return HANDLE_CODES.map((handleCode) => {
    const stages: { key: string; label: string; value: number }[] = WIP_STAGES.filter(
      (st) => st.domain === 'handle',
    ).map((st) => ({
      key: st.key as string,
      label: st.label as string,
      value: acceptedBy(snap, st.from, handleCode) - acceptedBy(snap, st.to as string, handleCode),
    }));

    // The crossover: hand-sanded handles minus handles consumed by tufting,
    // where tufting is recorded against the finished product.
    const tufted = FINISHED_GOODS.filter((p) => PRODUCT_HANDLE[p] === handleCode).reduce(
      (sum, p) => sum + acceptedBy(snap, 'TUFT', p),
      0,
    );
    stages.push({
      key: 'hsand',
      label: 'H/sanded, not tufted',
      value: acceptedBy(snap, 'HSAND', handleCode) - tufted,
    });

    return {
      handleCode,
      handleName: snap.itemByCode.get(handleCode)?.name ?? handleCode,
      stages,
      totalInLine: stages.reduce((sum, x) => sum + x.value, 0),
    };
  });
}

export type WipProductRow = {
  productCode: string;
  productName: string;
  handleCode: string;
  stages: { key: string; label: string; value: number }[];
  totalInLine: number;
};

/** Brush-side WIP, from tufting onwards, reported per finished product. */
export function wipProducts(snap: Snapshot): WipProductRow[] {
  const stock = new Map(stockRows(snap).map((r) => [r.code, r]));

  return FINISHED_GOODS.map((productCode) => {
    const stages: { key: string; label: string; value: number }[] = WIP_STAGES.filter(
      (st) => st.domain === 'product',
    ).map((st) => {
      if (st.to === null) {
        // Packed and ready for sale = packed by operations, less dispatched.
        const dispatched = stock.get(productCode)?.dispatched ?? 0;
        return {
          key: st.key,
          label: st.label,
          value: acceptedBy(snap, st.from, productCode) - dispatched,
        };
      }
      return {
        key: st.key,
        label: st.label,
        value: acceptedBy(snap, st.from, productCode) - acceptedBy(snap, st.to, productCode),
      };
    });

    return {
      productCode,
      productName: snap.itemByCode.get(productCode)?.name ?? productCode,
      handleCode: PRODUCT_HANDLE[productCode],
      stages,
      // "In line" excludes the packed stage, matching the sheet's Total In Line.
      totalInLine: stages.filter((x) => x.key !== 'packed').reduce((sum, x) => sum + x.value, 0),
    };
  });
}

/** Combined per-stage totals used by the dashboard. */
export function wipTotals(snap: Snapshot): { key: string; label: string; value: number }[] {
  const handles = wipHandles(snap);
  const products = wipProducts(snap);

  return WIP_STAGES.map((st) => {
    const fromHandles = handles
      .flatMap((h) => h.stages)
      .filter((x) => x.key === st.key)
      .reduce((sum, x) => sum + x.value, 0);
    const fromProducts = products
      .flatMap((p) => p.stages)
      .filter((x) => x.key === st.key)
      .reduce((sum, x) => sum + x.value, 0);

    return { key: st.key, label: st.label, value: fromHandles + fromProducts };
  });
}

export function bottleneckStage(snap: Snapshot): string {
  const totals = wipTotals(snap).filter((t) => t.key !== 'packed');
  const max = Math.max(...totals.map((t) => t.value), 0);
  if (max <= 0) return '—';
  return totals.find((t) => t.value === max)?.label ?? '—';
}

/* ========================================================================== *
 * Direct labour
 * ========================================================================== */

export type LabourRow = {
  id: number;
  name: string;
  operations: number;
  accepted: number;
  rejected: number;
  cost: number;
  acceptedThisMonth: number;
  rejectedThisMonth: number;
  costThisMonth: number;
  rejectRate: number | null;
};

export function labourByWorker(snap: Snapshot, month = snap.month): LabourRow[] {
  return snap.workers.map((w) => {
    const ops = snap.operations.filter((o) => o.workerId === w.id);
    const inMonth = ops.filter((o) => monthOf(o.date) === month);
    const accepted = sum(ops, (o) => o.acceptedQty);
    const rejected = sum(ops, (o) => o.rejectedQty);

    return {
      id: w.id,
      name: w.name,
      operations: ops.length,
      accepted,
      rejected,
      cost: sum(ops, (o) => o.directLabourCost),
      acceptedThisMonth: sum(inMonth, (o) => o.acceptedQty),
      rejectedThisMonth: sum(inMonth, (o) => o.rejectedQty),
      costThisMonth: sum(inMonth, (o) => o.directLabourCost),
      rejectRate: accepted + rejected > 0 ? rejected / (accepted + rejected) : null,
    };
  });
}

export function labourByProcess(snap: Snapshot): LabourRow[] {
  return [...snap.processes]
    .sort((a, b) => a.sequenceNo - b.sequenceNo)
    .map((p) => {
      const ops = snap.operations.filter((o) => o.processId === p.id);
      const accepted = sum(ops, (o) => o.acceptedQty);
      const rejected = sum(ops, (o) => o.rejectedQty);

      return {
        id: p.id,
        name: p.code,
        operations: ops.length,
        accepted,
        rejected,
        cost: sum(ops, (o) => o.directLabourCost),
        acceptedThisMonth: 0,
        rejectedThisMonth: 0,
        costThisMonth: 0,
        rejectRate: accepted + rejected > 0 ? rejected / (accepted + rejected) : null,
      };
    });
}

/* ========================================================================== *
 * Batches and suppliers
 * ========================================================================== */

export type BatchRow = {
  id: number;
  batchNo: string;
  itemCode: string;
  itemName: string;
  supplierName: string | null;
  purchaseDate: string;
  qtyReceived: number;
  unitCost: number | null;
  qtyIssued: number;
  balance: number;
  status: 'OK' | 'Not yet used' | 'NEGATIVE';
  outputLinked: number;
  defectRate: number | null;
  quality: string | null;
};

export function batchRows(snap: Snapshot): BatchRow[] {
  return snap.batches.map((b) => {
    const issued = snap.movements
      .filter((m) => m.batchNo === b.batchNo && m.movementType === 'Issue to production')
      .reduce((acc, m) => acc + m.qty, 0);

    const ops = snap.operations.filter((o) => o.inputBatch === b.batchNo);
    const accepted = sum(ops, (o) => o.acceptedQty);
    const rejected = sum(ops, (o) => o.rejectedQty);
    const balance = b.qtyReceived - issued;
    const it = snap.itemById.get(b.itemId);

    return {
      id: b.id,
      batchNo: b.batchNo,
      itemCode: it?.code ?? '',
      itemName: it?.name ?? '',
      supplierName: b.supplierId ? snap.supplierById.get(b.supplierId)?.name ?? null : null,
      purchaseDate: b.purchaseDate,
      qtyReceived: b.qtyReceived,
      unitCost: b.unitCost,
      qtyIssued: issued,
      balance,
      status: issued === 0 ? 'Not yet used' : balance < 0 ? 'NEGATIVE' : 'OK',
      outputLinked: accepted,
      defectRate: accepted + rejected > 0 ? rejected / (accepted + rejected) : null,
      quality: b.quality,
    };
  });
}

export type ScorecardRow = {
  supplierId: number;
  supplier: string;
  purchases: number;
  totalQty: number;
  totalCost: number;
  avgUnitCost: number | null;
  batches: number;
  avgDefectRate: number | null;
  openBatchBalance: number;
};

export function supplierScorecard(snap: Snapshot): ScorecardRow[] {
  const batchesAll = batchRows(snap);

  return snap.suppliers.map((sup) => {
    const buys = snap.purchases.filter((p) => p.supplierId === sup.id);
    const bs = batchesAll.filter((b) => b.supplierName === sup.name);
    const withDefect = bs.filter((b) => b.defectRate !== null);
    const totalQty = sum(buys, (p) => p.qty);
    const totalCost = sum(buys, (p) => p.totalCost);

    return {
      supplierId: sup.id,
      supplier: sup.name,
      purchases: buys.length,
      totalQty,
      totalCost,
      avgUnitCost: totalQty > 0 ? totalCost / totalQty : null,
      batches: bs.length,
      avgDefectRate: withDefect.length
        ? sum(withDefect, (b) => b.defectRate ?? 0) / withDefect.length
        : null,
      openBatchBalance: sum(bs, (b) => b.balance),
    };
  });
}

/* ========================================================================== *
 * Meals and payroll
 * ========================================================================== */

export type MealDeductionRow = {
  workerId: number;
  worker: string;
  qualifiedPlates: number;
  unqualifiedPlates: number;
  companyContribution: number;
  workerTopUp: number;
  fullCostDeductions: number;
  workerCashPaid: number;
  netMealDeduction: number;
};

export function mealDeductions(snap: Snapshot, month = snap.month): MealDeductionRow[] {
  return snap.workers.map((w) => {
    const rows = snap.meals.filter((m) => m.workerId === w.id && monthOf(m.date) === month);

    return {
      workerId: w.id,
      worker: w.name,
      qualifiedPlates: sum(rows, (m) => m.qualifiedPlates),
      unqualifiedPlates: sum(rows, (m) => m.unqualifiedPlates),
      companyContribution: sum(rows, (m) => m.companyContribution),
      workerTopUp: sum(rows, (m) => m.workerTopUp),
      fullCostDeductions: sum(rows, (m) => m.fullCostDeduction),
      workerCashPaid: sum(rows, (m) => m.workerCashPaid),
      netMealDeduction: sum(rows, (m) => m.netWorkerMealBalance),
    };
  });
}

export type PaymentRow = {
  workerId: number;
  worker: string;
  grossDirectLabour: number;
  mealDeduction: number;
  otherDeductions: number;
  totalDeductions: number;
  finalPayment: number;
  balanceOwed: number;
  status: 'PAYABLE' | 'BALANCE OWED' | '—';
};

export function finalPayments(snap: Snapshot, month = snap.month): PaymentRow[] {
  const meals = new Map(mealDeductions(snap, month).map((m) => [m.workerId, m]));

  return snap.workers.map((w) => {
    const gross = snap.operations
      .filter((o) => o.workerId === w.id && monthOf(o.date) === month)
      .reduce((acc, o) => acc + o.directLabourCost, 0);

    const mealDeduction = meals.get(w.id)?.netMealDeduction ?? 0;
    const otherDeductions = snap.deductions
      .filter(
        (d) => d.workerId === w.id && monthOf(d.date) === month && d.status === 'Approved',
      )
      .reduce((acc, d) => acc + d.amount, 0);

    const totalDeductions = mealDeduction + otherDeductions;
    const finalPayment = Math.max(0, gross - totalDeductions);
    const balanceOwed = Math.max(0, totalDeductions - gross);

    return {
      workerId: w.id,
      worker: w.name,
      grossDirectLabour: gross,
      mealDeduction,
      otherDeductions,
      totalDeductions,
      finalPayment,
      balanceOwed,
      status: balanceOwed > 0 ? 'BALANCE OWED' : finalPayment > 0 ? 'PAYABLE' : '—',
    };
  });
}

/* ========================================================================== *
 * Data Issues
 * ========================================================================== */

/**
 * Per-row validation for the Purchases Log, mirroring the checks the Data Issues
 * rollup applies to purchases. Returns 'OK' or the first problem found, so a row
 * can never read OK while contributing to the headline issue count.
 *
 * Built as a factory so the duplicate-batch tally is computed once per render
 * rather than re-scanned for every row.
 */
export function purchaseChecker(snap: Snapshot) {
  const batchCounts = new Map<string, number>();
  for (const p of snap.purchases) {
    if (p.batchNo) batchCounts.set(p.batchNo, (batchCounts.get(p.batchNo) ?? 0) + 1);
  }

  return (p: Snapshot['purchases'][number]): string => {
    if (!p.date) return 'Missing date';
    if (!p.supplierId) return 'Missing supplier';
    const item = snap.itemById.get(p.itemId);
    if (!item) return 'Invalid item';
    if (item.trackedByBatch && !p.batchNo) return 'Missing batch';
    if (p.batchNo && (batchCounts.get(p.batchNo) ?? 0) > 1) return 'Duplicate batch';
    return 'OK';
  };
}

/** Per-row check for the Inventory Ledger. */
export function movementChecker(snap: Snapshot) {
  const batchNos = new Set(snap.batches.map((b) => b.batchNo));

  return (m: Snapshot['movements'][number]): string => {
    if (!m.date) return 'Missing date';
    const item = snap.itemById.get(m.itemId);
    if (!item) return 'Invalid item';
    if (m.batchNo && !batchNos.has(m.batchNo)) return 'Batch not in register';
    if (item.trackedByBatch && m.movementType === 'Issue to production' && !m.batchNo) {
      return 'Missing batch';
    }
    return 'OK';
  };
}

/**
 * Per-row check for the Batch Register. Duplicate batch numbers are counted
 * across the register itself, matching the rollup's duplicate-batch check.
 */
export function batchChecker(rows: BatchRow[]) {
  const counts = new Map<string, number>();
  for (const b of rows) counts.set(b.batchNo, (counts.get(b.batchNo) ?? 0) + 1);

  return (b: BatchRow): string => {
    if (!b.purchaseDate) return 'Missing date';
    if ((counts.get(b.batchNo) ?? 0) > 1) return 'Duplicate batch';
    if (b.balance < 0) return 'Negative balance';
    return 'OK';
  };
}

/** Per-row check for the Production Operations Log. */
export function operationChecker(snap: Snapshot) {
  return (o: Snapshot['operations'][number]): string => {
    if (!o.date) return 'Missing date';
    if (!o.workerId || !snap.workerById.has(o.workerId)) return 'Missing worker';
    if (!snap.processById.has(o.processId)) return 'Missing process';
    if (o.acceptedQty + o.rejectedQty === 0) return 'Accepted + rejected = 0';
    if (o.rejectedQty > 0 && !o.rejectReason) return 'Rejected without reason';
    if (o.pieceRateApplied === null) return 'Missing piece rate';
    return 'OK';
  };
}

/** Per-row check for the Sales - Dispatch Log. */
export function dispatchChecker(snap: Snapshot) {
  return (d: Snapshot['dispatches'][number]): string => {
    if (!d.date) return 'Missing date';
    if (!snap.itemById.has(d.productItemId)) return 'Invalid product';
    if (!d.destinationName) return 'Missing destination';
    if (d.qty <= 0) return 'Quantity not above zero';
    return 'OK';
  };
}

/** Per-row check for the Meal Log. Mirrors DEVIATION 4's approver check. */
export function mealChecker(snap: Snapshot) {
  return (m: Snapshot['meals'][number]): string => {
    if (!m.date) return 'Missing date';
    if (!m.workerId || !snap.workerById.has(m.workerId)) return 'Missing worker';
    if (m.plateCount <= 0) return 'No plates recorded';
    if (!m.approvedBy) return 'No approver';
    return 'OK';
  };
}

/** Per-row check for the Deductions Log. */
export function deductionChecker(snap: Snapshot) {
  return (d: Snapshot['deductions'][number]): string => {
    if (!d.date) return 'Missing date';
    if (!d.workerId || !snap.workerById.has(d.workerId)) return 'Missing worker';
    if (d.amount <= 0) return 'Amount not above zero';
    if (!d.reason) return 'Missing reason';
    if (!d.status || d.status === 'Pending') return 'Pending approval';
    return 'OK';
  };
}

/** Per-row check for Expense & Provider Payments. */
export function expenseChecker() {
  return (e: { date: string; totalBill: number; amountPaid: number; providerId: number | null }): string => {
    if (!e.date) return 'Missing date';
    if (!e.providerId) return 'Missing provider';
    if (e.totalBill <= 0) return 'Bill not above zero';
    if (e.amountPaid > e.totalBill) return 'Paid exceeds bill';
    return 'OK';
  };
}

export type DataIssue = { check: string; count: number; where: string };

export function dataIssues(snap: Snapshot): DataIssue[] {
  const stock = stockRows(snap);
  const wipAll = [...wipHandles(snap).flatMap((h) => h.stages), ...wipProducts(snap).flatMap((p) => p.stages)];
  const batchList = batchRows(snap);
  const batchNos = new Set(snap.batches.map((b) => b.batchNo));
  const rateFor = (processId: number, productItemId: number) =>
    snap.rates.find((r) => r.processId === processId && r.productItemId === productItemId);

  const issues: DataIssue[] = [
    {
      check: 'Missing date',
      count: [...snap.purchases, ...snap.movements, ...snap.operations, ...snap.dispatches].filter(
        (r: any) => !r.date,
      ).length,
      where: 'Any entry sheet',
    },
    {
      check: 'Missing supplier',
      count: snap.purchases.filter((p) => !p.supplierId).length,
      where: 'Purchases',
    },
    {
      check: 'Missing worker',
      count: snap.operations.filter((o) => !o.workerId).length,
      where: 'Production Operations',
    },
    {
      check: 'Missing / invalid item',
      count: [...snap.purchases, ...snap.movements].filter(
        (r: any) => !snap.itemById.has(r.itemId),
      ).length,
      where: 'Purchases / Inventory Ledger',
    },
    {
      check: 'Missing process',
      count: snap.operations.filter((o) => !snap.processById.has(o.processId)).length,
      where: 'Production Operations',
    },
    {
      check: 'Missing batch (batch-tracked item)',
      count: snap.purchases.filter(
        (p) => snap.itemById.get(p.itemId)?.trackedByBatch && !p.batchNo,
      ).length,
      where: 'Purchases / Inventory Ledger',
    },
    {
      check: 'Invalid batch (not in register)',
      count: snap.movements.filter((m) => m.batchNo && !batchNos.has(m.batchNo)).length,
      where: 'Inventory Ledger vs Batch Register',
    },
    {
      check: 'Duplicate batch',
      count: countDuplicates(snap.purchases.map((p) => p.batchNo).filter(Boolean) as string[]),
      where: 'Batch Register / Purchases',
    },
    {
      check: 'Missing piece rate',
      count: snap.operations.filter((o) => {
        const r = rateFor(o.processId, o.productItemId);
        return !r || r.ratePerUnit === null;
      }).length,
      where: 'Piece Rate Settings',
    },
    {
      check: 'Negative stock',
      count: stock.filter((r) => r.status === 'NEGATIVE').length,
      where: 'Stock summaries',
    },
    {
      check: 'Negative WIP',
      count: wipAll.filter((x) => x.value < 0).length,
      where: 'WIP Summary',
    },
    {
      check: 'Accepted + Rejected = 0',
      count: snap.operations.filter((o) => o.acceptedQty + o.rejectedQty === 0).length,
      where: 'Production Operations',
    },
    {
      check: 'Rejected without reason',
      count: snap.operations.filter((o) => o.rejectedQty > 0 && !o.rejectReason).length,
      where: 'Production Operations',
    },
    {
      check: 'Issue exceeding stock',
      count: stock.filter((r) => r.balance < 0).length,
      where: 'Inventory Ledger',
    },
    {
      check: 'Negative batch balance',
      count: batchList.filter((b) => b.status === 'NEGATIVE').length,
      where: 'Batch Register',
    },
    {
      check: 'Dispatch exceeding finished goods',
      count: finishedGoods(snap).filter((f) => f.inStock < 0).length,
      where: 'Finished Goods / Dispatch',
    },
    // DEVIATION 4: these three sheets have Data Check columns in the workbook
    // but were never rolled up into Data Issues.
    {
      check: 'Meals without an approver',
      count: snap.meals.filter((m) => !m.approvedBy).length,
      where: 'Meal Log',
    },
    {
      check: 'Deductions without approval status',
      count: snap.deductions.filter((d) => !d.status || d.status === 'Pending').length,
      where: 'Deductions Log',
    },
    {
      check: 'Expenses overpaid',
      count: snap.expenses.filter((e) => e.amountPaid > e.totalBill).length,
      where: 'Expense & Provider Payments',
    },
  ];

  return issues;
}

export function totalOpenIssues(snap: Snapshot): number {
  return dataIssues(snap).reduce((acc, i) => acc + i.count, 0);
}

/* ========================================================================== *
 * Setup readiness
 * ========================================================================== */

export type ReadinessRow = { check: string; count: number; ready: boolean };

export function readiness(snap: Snapshot): ReadinessRow[] {
  const missingRates = snap.rates.filter((r) => r.active && r.ratePerUnit === null).length;
  const rows: ReadinessRow[] = [
    {
      check: 'Suppliers still TO CONFIRM',
      count: snap.suppliers.filter((x) => /TO CONFIRM/i.test(x.name)).length,
      ready: true,
    },
    {
      check: 'Workers still TO CONFIRM',
      count: snap.workers.filter((x) => /TO CONFIRM/i.test(x.name)).length,
      ready: true,
    },
    {
      // A worker with no active row in the skills matrix cannot be selected for
      // any process once "Enforce Worker Process Assignment?" is switched on.
      check: 'Worker skill data issues',
      count: snap.workers.filter(
        (w) => !snap.workerSkills.some((k) => k.workerId === w.id && k.active),
      ).length,
      ready: true,
    },
    { check: 'Piece rates missing', count: missingRates, ready: missingRates === 0 },
    {
      check: 'Standard costs TO CONFIRM',
      count: snap.items.filter((x) => x.standardCost === null).length,
      ready: true,
    },
    {
      check: 'Reorder levels TO CONFIRM',
      count: snap.items.filter((x) => x.reorderLevel === null).length,
      ready: true,
    },
    {
      check: 'Meal settings TO CONFIRM',
      count: snap.mealCost.filter((x) => String(x.value ?? '').includes('TO CONFIRM')).length,
      ready: true,
    },
    {
      check: 'System settings TO CONFIRM',
      count: snap.settings.filter((x) => String(x.value ?? '').includes('TO CONFIRM')).length,
      ready: true,
    },
    { check: 'Open data issues', count: totalOpenIssues(snap), ready: totalOpenIssues(snap) === 0 },
  ];

  return rows.map((r) => ({ ...r, ready: r.count === 0 }));
}

/* ========================================================================== *
 * Piece rates
 * ========================================================================== */

/** The rate in force for a process x product on a given date. */
export function rateInForce(
  snap: Snapshot,
  processId: number,
  productItemId: number,
  onDate: string,
): number | null {
  const candidates = snap.rates
    .filter(
      (r) =>
        r.processId === processId &&
        r.productItemId === productItemId &&
        r.active &&
        r.effectiveFrom <= onDate,
    )
    .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1));

  return candidates[0]?.ratePerUnit ?? null;
}

/* ========================================================================== *
 * Helpers
 * ========================================================================== */

function sum<T>(rows: T[], pick: (row: T) => number): number {
  return rows.reduce((acc, row) => acc + (pick(row) || 0), 0);
}

function countDuplicates(values: string[]): number {
  const seen = new Map<string, number>();
  for (const v of values) seen.set(v, (seen.get(v) ?? 0) + 1);
  return [...seen.values()].filter((n) => n > 1).reduce((acc, n) => acc + n, 0);
}

export { sum, weekStart };
