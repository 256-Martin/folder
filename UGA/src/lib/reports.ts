/**
 * The Print Centre catalogue.
 *
 * Every report is a title, a set of columns and a builder that turns a snapshot
 * into rows. The same definitions drive both the on-screen report and its CSV.
 */

import {
  batchRows,
  finalPayments,
  finishedGoods,
  handleStock,
  labourByProcess,
  labourByWorker,
  materialStock,
  mealDeductions,
  stockRows,
  supplierScorecard,
  ustapleStock,
  wipHandles,
  wipProducts,
  type Snapshot,
} from './core';
import { weeklyMealSummaries } from './meal-engine';
import { monthOf } from './dates';

export type Column = {
  key: string;
  label: string;
  align?: 'left' | 'right';
  /** 'money' | 'qty' | 'percent' | 'text' */
  format?: 'money' | 'qty' | 'percent' | 'text';
};

export type ReportDef = {
  slug: string;
  title: string;
  description: string;
  group: 'Production' | 'Inventory' | 'Labour & Pay' | 'Commercial' | 'Meals';
  /** Reports that read a month use the month selector. */
  monthly?: boolean;
  columns: Column[];
  build: (snap: Snapshot, month: string) => Record<string, unknown>[];
  totals?: (rows: Record<string, unknown>[]) => Record<string, unknown> | null;
};

const sumOf = (rows: Record<string, unknown>[], keys: string[]) => {
  const out: Record<string, unknown> = {};
  for (const k of keys) out[k] = rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);
  return out;
};

export const REPORTS: ReportDef[] = [
  /* ------------------------------------------------------------ production */
  {
    slug: 'wip',
    title: 'WIP Report',
    description: 'Units in line at every stage, for handles and for brushes.',
    group: 'Production',
    columns: [
      { key: 'scope', label: 'Scope' },
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Name' },
      { key: 'stage', label: 'Stage' },
      { key: 'units', label: 'Units', format: 'qty', align: 'right' },
    ],
    build: (snap) => {
      const rows: Record<string, unknown>[] = [];
      for (const h of wipHandles(snap)) {
        for (const st of h.stages) {
          rows.push({ scope: 'Handle', code: h.handleCode, name: h.handleName, stage: st.label, units: st.value });
        }
      }
      for (const p of wipProducts(snap)) {
        for (const st of p.stages) {
          rows.push({ scope: 'Brush', code: p.productCode, name: p.productName, stage: st.label, units: st.value });
        }
      }
      return rows;
    },
  },
  {
    slug: 'production-operations',
    title: 'Production Operations Report',
    description: 'Every operation recorded in the period, with the rate applied.',
    group: 'Production',
    monthly: true,
    columns: [
      { key: 'code', label: 'Op ID' },
      { key: 'date', label: 'Date' },
      { key: 'worker', label: 'Worker' },
      { key: 'process', label: 'Process' },
      { key: 'product', label: 'Product' },
      { key: 'accepted', label: 'Accepted', format: 'qty', align: 'right' },
      { key: 'rejected', label: 'Rejected', format: 'qty', align: 'right' },
      { key: 'rate', label: 'Rate', format: 'money', align: 'right' },
      { key: 'cost', label: 'Labour cost', format: 'money', align: 'right' },
    ],
    build: (snap, month) =>
      snap.operations
        .filter((o) => monthOf(o.date) === month)
        .map((o) => ({
          code: o.code,
          date: o.date,
          worker: snap.workerById.get(o.workerId)?.name ?? '',
          process: snap.processById.get(o.processId)?.code ?? '',
          product: snap.itemById.get(o.productItemId)?.code ?? '',
          accepted: o.acceptedQty,
          rejected: o.rejectedQty,
          rate: o.pieceRateApplied ?? 0,
          cost: o.directLabourCost,
        })),
    totals: (rows) => sumOf(rows, ['accepted', 'rejected', 'cost']),
  },
  {
    slug: 'production-potential',
    title: 'Production Potential & Material Constraint Analysis',
    description: 'How many brushes current material balances could support.',
    group: 'Production',
    columns: [
      { key: 'item', label: 'Item' },
      { key: 'name', label: 'Name' },
      { key: 'balance', label: 'Balance', format: 'qty', align: 'right' },
      { key: 'reorder', label: 'Reorder level', format: 'qty', align: 'right' },
      { key: 'status', label: 'Status' },
      { key: 'note', label: 'Constraint note' },
    ],
    build: (snap) =>
      stockRows(snap)
        .filter((r) => r.category !== 'Finished Good')
        .map((r) => ({
          item: r.code,
          name: r.name,
          balance: r.balance,
          reorder: r.reorderLevel ?? 0,
          status: r.status,
          note:
            r.status === 'NEGATIVE'
              ? 'Negative balance — investigate before producing'
              : r.status === 'LOW'
                ? 'At or below reorder level — reorder now'
                : 'Sufficient',
        })),
  },

  /* ------------------------------------------------------------- inventory */
  {
    slug: 'material-stock',
    title: 'Material Stock Report',
    description: 'Raw materials and consumables with balances and status.',
    group: 'Inventory',
    columns: [
      { key: 'code', label: 'Item' },
      { key: 'name', label: 'Name' },
      { key: 'uom', label: 'UoM' },
      { key: 'received', label: 'Received', format: 'qty', align: 'right' },
      { key: 'issued', label: 'Issued', format: 'qty', align: 'right' },
      { key: 'balance', label: 'Balance', format: 'qty', align: 'right' },
      { key: 'status', label: 'Status' },
    ],
    build: (snap) => materialStock(snap).map((r) => ({ ...r })),
    totals: (rows) => sumOf(rows, ['received', 'issued', 'balance']),
  },
  {
    slug: 'handle-stock',
    title: 'Handle Stock Report',
    description: 'Small and large wooden handles.',
    group: 'Inventory',
    columns: [
      { key: 'code', label: 'Item' },
      { key: 'name', label: 'Name' },
      { key: 'received', label: 'Received', format: 'qty', align: 'right' },
      { key: 'produced', label: 'Produced', format: 'qty', align: 'right' },
      { key: 'issued', label: 'Issued', format: 'qty', align: 'right' },
      { key: 'balance', label: 'Balance', format: 'qty', align: 'right' },
      { key: 'status', label: 'Status' },
    ],
    build: (snap) => handleStock(snap).map((r) => ({ ...r })),
    totals: (rows) => sumOf(rows, ['received', 'produced', 'issued', 'balance']),
  },
  {
    slug: 'ustaple-stock',
    title: 'U-Staple Stock Report',
    description: 'U-staple wire produced from tires.',
    group: 'Inventory',
    columns: [
      { key: 'code', label: 'Item' },
      { key: 'produced', label: 'Produced', format: 'qty', align: 'right' },
      { key: 'issued', label: 'Issued', format: 'qty', align: 'right' },
      { key: 'balance', label: 'Balance', format: 'qty', align: 'right' },
      { key: 'status', label: 'Status' },
    ],
    build: (snap) => ustapleStock(snap).map((r) => ({ ...r })),
  },
  {
    slug: 'finished-goods',
    title: 'Finished Goods & Valuation',
    description: 'Produced, dispatched, on hand and value at standard cost.',
    group: 'Inventory',
    columns: [
      { key: 'code', label: 'Product' },
      { key: 'name', label: 'Name' },
      { key: 'produced', label: 'Produced', format: 'qty', align: 'right' },
      { key: 'dispatched', label: 'Dispatched', format: 'qty', align: 'right' },
      { key: 'inStock', label: 'In stock', format: 'qty', align: 'right' },
      { key: 'valueOnHand', label: 'Value on hand', format: 'money', align: 'right' },
    ],
    build: (snap) => finishedGoods(snap).map((r) => ({ ...r })),
    totals: (rows) => sumOf(rows, ['produced', 'dispatched', 'inStock', 'valueOnHand']),
  },
  {
    slug: 'inventory-valuation',
    title: 'Inventory Valuation',
    description: 'Every item valued at the standard cost held in the Item Master.',
    group: 'Inventory',
    columns: [
      { key: 'code', label: 'Item' },
      { key: 'name', label: 'Name' },
      { key: 'category', label: 'Category' },
      { key: 'balance', label: 'Balance', format: 'qty', align: 'right' },
      { key: 'standardCost', label: 'Standard cost', format: 'money', align: 'right' },
      { key: 'valueOnHand', label: 'Value', format: 'money', align: 'right' },
    ],
    build: (snap) => stockRows(snap).map((r) => ({ ...r })),
    totals: (rows) => sumOf(rows, ['valueOnHand']),
  },
  {
    slug: 'batch-traceability',
    title: 'Batch Traceability Report',
    description: 'Every batch, what was issued from it, and what it produced.',
    group: 'Inventory',
    columns: [
      { key: 'batchNo', label: 'Batch' },
      { key: 'itemCode', label: 'Item' },
      { key: 'supplierName', label: 'Supplier' },
      { key: 'purchaseDate', label: 'Purchased' },
      { key: 'qtyReceived', label: 'Received', format: 'qty', align: 'right' },
      { key: 'qtyIssued', label: 'Issued', format: 'qty', align: 'right' },
      { key: 'balance', label: 'Balance', format: 'qty', align: 'right' },
      { key: 'outputLinked', label: 'Output linked', format: 'qty', align: 'right' },
      { key: 'status', label: 'Status' },
    ],
    build: (snap) => batchRows(snap).map((r) => ({ ...r })),
    totals: (rows) => sumOf(rows, ['qtyReceived', 'qtyIssued', 'balance', 'outputLinked']),
  },

  /* ---------------------------------------------------------- labour & pay */
  {
    slug: 'direct-labour',
    title: 'Direct Labour Report',
    description: 'Piecework earned per worker, all time and for the period.',
    group: 'Labour & Pay',
    monthly: true,
    columns: [
      { key: 'name', label: 'Worker' },
      { key: 'accepted', label: 'Accepted (all)', format: 'qty', align: 'right' },
      { key: 'rejected', label: 'Rejected (all)', format: 'qty', align: 'right' },
      { key: 'cost', label: 'Cost (all)', format: 'money', align: 'right' },
      { key: 'acceptedThisMonth', label: 'Accepted (period)', format: 'qty', align: 'right' },
      { key: 'costThisMonth', label: 'Cost (period)', format: 'money', align: 'right' },
    ],
    build: (snap, month) => labourByWorker(snap, month).map((r) => ({ ...r })),
    totals: (rows) => sumOf(rows, ['accepted', 'rejected', 'cost', 'acceptedThisMonth', 'costThisMonth']),
  },
  {
    slug: 'labour-by-process',
    title: 'Direct Labour by Process',
    description: 'Output and cost per process across the whole routing.',
    group: 'Labour & Pay',
    columns: [
      { key: 'name', label: 'Process' },
      { key: 'operations', label: 'Operations', align: 'right' },
      { key: 'accepted', label: 'Accepted', format: 'qty', align: 'right' },
      { key: 'rejected', label: 'Rejected', format: 'qty', align: 'right' },
      { key: 'cost', label: 'Direct labour cost', format: 'money', align: 'right' },
    ],
    build: (snap) => labourByProcess(snap).map((r) => ({ ...r })),
    totals: (rows) => sumOf(rows, ['operations', 'accepted', 'rejected', 'cost']),
  },
  {
    slug: 'worker-productivity',
    title: 'Worker Productivity Report',
    description: 'Output, reject rate and earnings per worker.',
    group: 'Labour & Pay',
    monthly: true,
    columns: [
      { key: 'name', label: 'Worker' },
      { key: 'operations', label: 'Operations', align: 'right' },
      { key: 'accepted', label: 'Accepted', format: 'qty', align: 'right' },
      { key: 'rejected', label: 'Rejected', format: 'qty', align: 'right' },
      { key: 'rejectRate', label: 'Reject rate', format: 'percent', align: 'right' },
      { key: 'cost', label: 'Direct labour cost', format: 'money', align: 'right' },
    ],
    build: (snap, month) => labourByWorker(snap, month).map((r) => ({ ...r })),
  },
  {
    slug: 'payment-statements',
    title: 'Worker Payment Statements',
    description: 'Gross pay, deductions and net payable per worker for the month.',
    group: 'Labour & Pay',
    monthly: true,
    columns: [
      { key: 'worker', label: 'Worker' },
      { key: 'grossDirectLabour', label: 'Gross direct labour', format: 'money', align: 'right' },
      { key: 'mealDeduction', label: 'Meal deduction', format: 'money', align: 'right' },
      { key: 'otherDeductions', label: 'Other deductions', format: 'money', align: 'right' },
      { key: 'totalDeductions', label: 'Total deductions', format: 'money', align: 'right' },
      { key: 'finalPayment', label: 'Final payment', format: 'money', align: 'right' },
      { key: 'balanceOwed', label: 'Balance owed', format: 'money', align: 'right' },
      { key: 'status', label: 'Status' },
    ],
    build: (snap, month) => finalPayments(snap, month).map((r) => ({ ...r })),
    totals: (rows) =>
      sumOf(rows, [
        'grossDirectLabour',
        'mealDeduction',
        'otherDeductions',
        'totalDeductions',
        'finalPayment',
        'balanceOwed',
      ]),
  },

  /* ---------------------------------------------------------------- meals */
  {
    slug: 'meal-qualification',
    title: 'Meal Qualification Report',
    description: 'Eating days earned and used, by worker and week.',
    group: 'Meals',
    monthly: true,
    columns: [
      { key: 'worker', label: 'Worker' },
      { key: 'weekStart', label: 'Week start' },
      { key: 'finalDaysEarned', label: 'Days earned', format: 'qty', align: 'right' },
      { key: 'platesTaken', label: 'Plates taken', format: 'qty', align: 'right' },
      { key: 'qualifiedPlates', label: 'Qualified', format: 'qty', align: 'right' },
      { key: 'unqualifiedPlates', label: 'Unqualified', format: 'qty', align: 'right' },
      { key: 'expiredUnusedDays', label: 'Expired', format: 'qty', align: 'right' },
    ],
    build: (snap, month) => weeklyMealSummaries(snap, month).map((r) => ({ ...r })),
    totals: (rows) =>
      sumOf(rows, ['finalDaysEarned', 'platesTaken', 'qualifiedPlates', 'unqualifiedPlates', 'expiredUnusedDays']),
  },
  {
    slug: 'meal-deductions',
    title: 'Meal Deductions Report',
    description: 'Company contribution and worker recovery per worker.',
    group: 'Meals',
    monthly: true,
    columns: [
      { key: 'worker', label: 'Worker' },
      { key: 'qualifiedPlates', label: 'Qualified', format: 'qty', align: 'right' },
      { key: 'unqualifiedPlates', label: 'Unqualified', format: 'qty', align: 'right' },
      { key: 'companyContribution', label: 'Company', format: 'money', align: 'right' },
      { key: 'fullCostDeductions', label: 'Full cost', format: 'money', align: 'right' },
      { key: 'workerCashPaid', label: 'Cash paid', format: 'money', align: 'right' },
      { key: 'netMealDeduction', label: 'Net deduction', format: 'money', align: 'right' },
    ],
    build: (snap, month) => mealDeductions(snap, month).map((r) => ({ ...r })),
    totals: (rows) =>
      sumOf(rows, [
        'qualifiedPlates',
        'unqualifiedPlates',
        'companyContribution',
        'fullCostDeductions',
        'workerCashPaid',
        'netMealDeduction',
      ]),
  },

  /* ----------------------------------------------------------- commercial */
  {
    slug: 'purchases',
    title: 'Purchases Report',
    description: 'All purchases in the period with unit costs.',
    group: 'Commercial',
    monthly: true,
    columns: [
      { key: 'code', label: 'ID' },
      { key: 'date', label: 'Date' },
      { key: 'supplier', label: 'Supplier' },
      { key: 'item', label: 'Item' },
      { key: 'batchNo', label: 'Batch' },
      { key: 'qty', label: 'Qty', format: 'qty', align: 'right' },
      { key: 'totalCost', label: 'Total cost', format: 'money', align: 'right' },
      { key: 'unitCost', label: 'Unit cost', format: 'money', align: 'right' },
    ],
    build: (snap, month) =>
      snap.purchases
        .filter((p) => monthOf(p.date) === month)
        .map((p) => ({
          code: p.code,
          date: p.date,
          supplier: snap.supplierById.get(p.supplierId)?.name ?? '',
          item: snap.itemById.get(p.itemId)?.code ?? '',
          batchNo: p.batchNo ?? '',
          qty: p.qty,
          totalCost: p.totalCost,
          unitCost: p.qty ? p.totalCost / p.qty : 0,
        })),
    totals: (rows) => sumOf(rows, ['qty', 'totalCost']),
  },
  {
    slug: 'supplier-scorecard',
    title: 'Supplier & Batch Scorecard',
    description: 'Spend and quality per supplier.',
    group: 'Commercial',
    columns: [
      { key: 'supplier', label: 'Supplier' },
      { key: 'purchases', label: 'Purchases', align: 'right' },
      { key: 'totalQty', label: 'Total qty', format: 'qty', align: 'right' },
      { key: 'totalCost', label: 'Total cost', format: 'money', align: 'right' },
      { key: 'avgUnitCost', label: 'Avg unit cost', format: 'money', align: 'right' },
      { key: 'openBatchBalance', label: 'Open balance', format: 'qty', align: 'right' },
    ],
    build: (snap) => supplierScorecard(snap).map((r) => ({ ...r })),
    totals: (rows) => sumOf(rows, ['purchases', 'totalQty', 'totalCost', 'openBatchBalance']),
  },
  {
    slug: 'sales-dispatch',
    title: 'Sales & Dispatch Report',
    description: 'Finished goods dispatched in the period.',
    group: 'Commercial',
    monthly: true,
    columns: [
      { key: 'code', label: 'ID' },
      { key: 'date', label: 'Date' },
      { key: 'destination', label: 'Dispatch to' },
      { key: 'product', label: 'Product' },
      { key: 'qty', label: 'Qty', format: 'qty', align: 'right' },
      { key: 'unitPrice', label: 'Unit price', format: 'money', align: 'right' },
      { key: 'value', label: 'Value', format: 'money', align: 'right' },
    ],
    build: (snap, month) =>
      snap.dispatches
        .filter((d) => monthOf(d.date) === month)
        .map((d) => ({
          code: d.code,
          date: d.date,
          destination: d.destinationName,
          product: snap.itemById.get(d.productItemId)?.code ?? '',
          qty: d.qty,
          unitPrice: d.unitPrice ?? 0,
          value: d.qty * (d.unitPrice ?? 0),
        })),
    totals: (rows) => sumOf(rows, ['qty', 'value']),
  },
  {
    slug: 'financial-summary',
    title: 'Financial Summary',
    description: 'Purchases, labour, meals, expenses and sales for the period.',
    group: 'Commercial',
    monthly: true,
    columns: [
      { key: 'line', label: 'Line' },
      { key: 'detail', label: 'Detail' },
      { key: 'amount', label: 'Amount (UGX)', format: 'money', align: 'right' },
    ],
    build: (snap, month) => {
      const purchases = snap.purchases.filter((p) => monthOf(p.date) === month);
      const ops = snap.operations.filter((o) => monthOf(o.date) === month);
      const meals = snap.meals.filter((m) => monthOf(m.date) === month);
      const expenses = snap.expenses.filter((e) => monthOf(e.date) === month);
      const dispatches = snap.dispatches.filter((d) => monthOf(d.date) === month);
      const pay = finalPayments(snap, month);

      return [
        { line: 'Purchases', detail: `${purchases.length} entries`, amount: purchases.reduce((a, p) => a + p.totalCost, 0) },
        { line: 'Direct labour earned', detail: `${ops.length} operations`, amount: ops.reduce((a, o) => a + o.directLabourCost, 0) },
        { line: 'Company meal contribution', detail: `${meals.length} meals`, amount: meals.reduce((a, m) => a + m.companyContribution, 0) },
        { line: 'Worker meal recovery', detail: 'Net of cash paid', amount: -meals.reduce((a, m) => a + m.netWorkerMealBalance, 0) },
        { line: 'Provider & other expenses', detail: `${expenses.length} bills`, amount: expenses.reduce((a, e) => a + e.totalBill, 0) },
        { line: 'Sales / dispatch value', detail: `${dispatches.length} dispatches`, amount: dispatches.reduce((a, d) => a + d.qty * (d.unitPrice ?? 0), 0) },
        { line: 'Net worker payments due', detail: 'After all deductions', amount: pay.reduce((a, p) => a + p.finalPayment, 0) },
      ];
    },
  },
];

export function reportBySlug(slug: string): ReportDef | undefined {
  return REPORTS.find((r) => r.slug === slug);
}

export const REPORT_GROUPS = ['Production', 'Inventory', 'Labour & Pay', 'Meals', 'Commercial'] as const;
