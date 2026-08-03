/**
 * Accounting CSV exports.
 *
 * Each line carries the debit and credit account taken from Accounting Export
 * Settings, so the file can be imported straight into a ledger.
 */

import { finalPayments, stockRows, type Snapshot } from './core';
import { monthOf } from './dates';

export type JournalLine = {
  date: string;
  month: string;
  referenceId: string;
  description: string;
  party: string;
  itemOrProduct: string;
  quantity: number | '';
  debitAccount: string;
  creditAccount: string;
  amount: number;
  notes: string;
  sourceSheet: string;
  sourceRef: string;
};

export type ExportDef = {
  key: string;
  title: string;
  description: string;
  mappingKeys: string[];
  build: (snap: Snapshot, month: string, accounts: AccountLookup) => JournalLine[];
};

export type AccountLookup = (mappingKey: string) => { debit: string; credit: string };

const CATEGORY_MAPPING: Record<string, string> = {
  'Raw Material': 'RAW_MATERIAL_PURCHASE',
  Consumable: 'CONSUMABLE_PURCHASE',
  'Manufactured Component': 'RAW_MATERIAL_PURCHASE',
  'Finished Good': 'RAW_MATERIAL_PURCHASE',
};

export const EXPORTS: ExportDef[] = [
  {
    key: 'purchases',
    title: 'Purchases',
    description: 'Raw material and consumable purchases, split by item category.',
    mappingKeys: ['RAW_MATERIAL_PURCHASE', 'CONSUMABLE_PURCHASE'],
    build: (snap, month, accounts) =>
      snap.purchases
        .filter((p) => monthOf(p.date) === month)
        .map((p) => {
          const item = snap.itemById.get(p.itemId);
          const key = CATEGORY_MAPPING[item?.category ?? ''] ?? 'RAW_MATERIAL_PURCHASE';
          const acct = accounts(key);
          return {
            date: p.date,
            month,
            referenceId: p.code,
            description: `Purchase of ${item?.name ?? ''}`,
            party: snap.supplierById.get(p.supplierId)?.name ?? '',
            itemOrProduct: item?.code ?? '',
            quantity: p.qty,
            debitAccount: acct.debit,
            creditAccount: acct.credit,
            amount: p.totalCost,
            notes: p.qualityNotes ?? '',
            sourceSheet: 'Purchases',
            sourceRef: p.batchNo ?? '',
          };
        }),
  },
  {
    key: 'direct-labour',
    title: 'Direct Labour',
    description: 'Gross piecework earned, per operation.',
    mappingKeys: ['DIRECT_LABOUR'],
    build: (snap, month, accounts) => {
      const acct = accounts('DIRECT_LABOUR');
      return snap.operations
        .filter((o) => monthOf(o.date) === month && o.directLabourCost > 0)
        .map((o) => ({
          date: o.date,
          month,
          referenceId: o.code,
          description: `${snap.processById.get(o.processId)?.code ?? ''} piecework`,
          party: snap.workerById.get(o.workerId)?.name ?? '',
          itemOrProduct: snap.itemById.get(o.productItemId)?.code ?? '',
          quantity: o.acceptedQty,
          debitAccount: acct.debit,
          creditAccount: acct.credit,
          amount: o.directLabourCost,
          notes: o.notes ?? '',
          sourceSheet: 'Production Operations',
          sourceRef: o.inputBatch ?? '',
        }));
    },
  },
  {
    key: 'meals',
    title: 'Meals',
    description: 'Company contribution and worker meal recovery.',
    mappingKeys: ['COMPANY_MEAL', 'WORKER_MEAL_DEDUCTION'],
    build: (snap, month, accounts) => {
      const company = accounts('COMPANY_MEAL');
      const worker = accounts('WORKER_MEAL_DEDUCTION');
      const lines: JournalLine[] = [];

      for (const m of snap.meals.filter((x) => monthOf(x.date) === month)) {
        const name = snap.workerById.get(m.workerId)?.name ?? '';
        if (m.companyContribution > 0) {
          lines.push({
            date: m.date,
            month,
            referenceId: m.code,
            description: 'Company meal contribution',
            party: name,
            itemOrProduct: 'MEAL',
            quantity: m.qualifiedPlates,
            debitAccount: company.debit,
            creditAccount: company.credit,
            amount: m.companyContribution,
            notes: m.note ?? '',
            sourceSheet: 'Meal Log',
            sourceRef: m.weekStart,
          });
        }
        if (m.netWorkerMealBalance > 0) {
          lines.push({
            date: m.date,
            month,
            referenceId: m.code,
            description: 'Worker meal deduction',
            party: name,
            itemOrProduct: 'MEAL',
            quantity: m.plateCount,
            debitAccount: worker.debit,
            creditAccount: worker.credit,
            amount: m.netWorkerMealBalance,
            notes: m.note ?? '',
            sourceSheet: 'Meal Log',
            sourceRef: m.weekStart,
          });
        }
      }
      return lines;
    },
  },
  {
    key: 'deductions',
    title: 'Other Deductions',
    description: 'Approved non-meal deductions.',
    mappingKeys: ['OTHER_DEDUCTION'],
    build: (snap, month, accounts) => {
      const acct = accounts('OTHER_DEDUCTION');
      return snap.deductions
        .filter((d) => monthOf(d.date) === month && d.status === 'Approved')
        .map((d) => ({
          date: d.date,
          month,
          referenceId: d.code,
          description: `${d.deductionType} deduction`,
          party: snap.workerById.get(d.workerId)?.name ?? '',
          itemOrProduct: '',
          quantity: '' as const,
          debitAccount: acct.debit,
          creditAccount: acct.credit,
          amount: d.amount,
          notes: d.reason ?? '',
          sourceSheet: 'Deductions Log',
          sourceRef: d.approvedBy ?? '',
        }));
    },
  },
  {
    key: 'sales',
    title: 'Sales & Dispatch',
    description: 'Finished goods dispatched.',
    mappingKeys: ['SALES_DISPATCH'],
    build: (snap, month, accounts) => {
      const acct = accounts('SALES_DISPATCH');
      return snap.dispatches
        .filter((d) => monthOf(d.date) === month)
        .map((d) => ({
          date: d.date,
          month,
          referenceId: d.code,
          description: 'Finished goods dispatch',
          party: d.destinationName,
          itemOrProduct: snap.itemById.get(d.productItemId)?.code ?? '',
          quantity: d.qty,
          debitAccount: acct.debit,
          creditAccount: acct.credit,
          amount: d.qty * (d.unitPrice ?? 0),
          notes: d.note ?? '',
          sourceSheet: 'Sales - Dispatch',
          sourceRef: d.salesOrderNo ?? d.deliveryNoteNo ?? '',
        }));
    },
  },
  {
    key: 'inventory-adjustments',
    title: 'Inventory Adjustments',
    description: 'Adjustments and returns recorded in the ledger.',
    mappingKeys: ['INVENTORY_ADJUSTMENT'],
    build: (snap, month, accounts) => {
      const acct = accounts('INVENTORY_ADJUSTMENT');
      return snap.movements
        .filter(
          (m) =>
            monthOf(m.date) === month && (m.movementType === 'Adjustment' || m.movementType === 'Return'),
        )
        .map((m) => ({
          date: m.date,
          month,
          referenceId: m.code,
          description: m.movementType,
          party: m.byName ?? '',
          itemOrProduct: snap.itemById.get(m.itemId)?.code ?? '',
          quantity: m.qty,
          debitAccount: acct.debit,
          creditAccount: acct.credit,
          amount: m.qty * (m.unitCost ?? 0),
          notes: m.note ?? '',
          sourceSheet: 'Inventory Ledger',
          sourceRef: m.batchNo ?? '',
        }));
    },
  },
  {
    key: 'worker-payments',
    title: 'Final Worker Payments',
    description: 'Net amount payable to each worker.',
    mappingKeys: ['FINAL_WORKER_PAYMENT'],
    build: (snap, month, accounts) => {
      const acct = accounts('FINAL_WORKER_PAYMENT');
      return finalPayments(snap, month)
        .filter((p) => p.finalPayment > 0)
        .map((p) => ({
          date: `${month}-01`,
          month,
          referenceId: `PAY-${month}-${p.workerId}`,
          description: 'Final worker payment',
          party: p.worker,
          itemOrProduct: '',
          quantity: '' as const,
          debitAccount: acct.debit,
          creditAccount: acct.credit,
          amount: p.finalPayment,
          notes: p.status,
          sourceSheet: 'Final Worker Payment',
          sourceRef: month,
        }));
    },
  },
  {
    key: 'provider-payments',
    title: 'Provider Payments',
    description: 'Payments to food, transport and service providers.',
    mappingKeys: ['FOOD_PROVIDER_PAYMENT'],
    build: (snap, month, accounts) => {
      const acct = accounts('FOOD_PROVIDER_PAYMENT');
      return snap.expenses
        .filter((e) => monthOf(e.date) === month && e.amountPaid > 0)
        .map((e) => ({
          date: e.date,
          month,
          referenceId: e.code,
          description: e.expenseCategory ?? 'Provider payment',
          party: snap.supplierById.get(e.providerId)?.name ?? '',
          itemOrProduct: '',
          quantity: e.plates ?? ('' as const),
          debitAccount: acct.debit,
          creditAccount: acct.credit,
          amount: e.amountPaid,
          notes: e.notes ?? '',
          sourceSheet: 'Expense & Provider Payments',
          sourceRef: e.transactionNo ?? '',
        }));
    },
  },
  {
    key: 'inventory-valuation',
    title: 'Inventory Valuation (memo)',
    description: 'Month-end valuation of every item at standard cost.',
    mappingKeys: ['INVENTORY_VALUATION'],
    build: (snap, month, accounts) => {
      const acct = accounts('INVENTORY_VALUATION');
      return stockRows(snap)
        .filter((r) => r.balance !== 0)
        .map((r) => ({
          date: `${month}-01`,
          month,
          referenceId: `VAL-${month}-${r.code}`,
          description: `Valuation — ${r.name}`,
          party: '',
          itemOrProduct: r.code,
          quantity: r.balance,
          debitAccount: acct.debit,
          creditAccount: acct.credit,
          amount: r.valueOnHand,
          notes: r.status,
          sourceSheet: 'Inventory Valuation',
          sourceRef: r.category,
        }));
    },
  },
];

export function exportByKey(key: string): ExportDef | undefined {
  return EXPORTS.find((e) => e.key === key);
}

/* ------------------------------------------------------------------- CSV -- */

const HEADERS: { key: keyof JournalLine; label: string }[] = [
  { key: 'date', label: 'Date' },
  { key: 'month', label: 'Month' },
  { key: 'referenceId', label: 'Reference ID' },
  { key: 'description', label: 'Description' },
  { key: 'party', label: 'Party' },
  { key: 'itemOrProduct', label: 'Item/Product' },
  { key: 'quantity', label: 'Quantity' },
  { key: 'debitAccount', label: 'Debit Account' },
  { key: 'creditAccount', label: 'Credit Account' },
  { key: 'amount', label: 'Amount' },
  { key: 'notes', label: 'Notes' },
  { key: 'sourceSheet', label: 'Source Sheet' },
  { key: 'sourceRef', label: 'Source Ref' },
];

function escapeCsv(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(lines: JournalLine[]): string {
  const rows = [HEADERS.map((h) => h.label).join(',')];
  for (const line of lines) {
    rows.push(HEADERS.map((h) => escapeCsv(line[h.key])).join(','));
  }
  // BOM so Excel opens UTF-8 correctly.
  return `﻿${rows.join('\r\n')}\r\n`;
}
