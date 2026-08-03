/**
 * Seed the database from the real Ugabrush spreadsheet export.
 *
 *   npm run db:seed
 *
 * Business identifiers (PU00001, MV00001, MEAL0001 ...) are reproduced exactly
 * as they appear in the sheet today, so existing paperwork still matches.
 */

import './_env';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { closeDb, db, explainDbError } from '../src/db';
import * as s from '../src/db/schema';

type Row = Record<string, any>;
type Seed = Record<string, any>;

const file = path.join(process.cwd(), 'src', 'db', 'seed-data.json');
const data: Seed = JSON.parse(fs.readFileSync(file, 'utf8'));

/* ------------------------------------------------------------------ utils -- */

const d10 = (v: any): string | null => (typeof v === 'string' ? v.slice(0, 10) : null);
const ts = (v: any): Date | null => (typeof v === 'string' ? new Date(v) : null);
const num = (v: any): number | null =>
  v === null || v === undefined || v === '' ? null : Number(v);
const n0 = (v: any): number => Number(v ?? 0) || 0;
const yes = (v: any): boolean => String(v ?? '').trim().toLowerCase() === 'yes';
const pad = (n: number, w: number) => String(n).padStart(w, '0');

/** Monday-based week start, matching Meal Cost Settings "Week starts on". */
function weekStartOf(iso: string, weekStartsOn = 1): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  const isoDow = ((d.getUTCDay() + 6) % 7) + 1; // Mon=1 .. Sun=7
  const offset = (isoDow - weekStartsOn + 7) % 7;
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
}

function parseJson(v: any) {
  if (typeof v !== 'string') return v ?? null;
  try {
    return JSON.parse(v);
  } catch {
    return { raw: v };
  }
}

/* ------------------------------------------------------------------ clear -- */

async function clearAll() {
  // Children first, then parents.
  const order = [
    s.mealQualificationSummary,
    s.batchRenameLog,
    s.voidRegister,
    s.reportLog,
    s.auditLog,
    s.expense,
    s.deduction,
    s.meal,
    s.dispatch,
    s.productionOperation,
    s.inventoryMovement,
    s.batch,
    s.purchase,
    s.pieceRate,
    s.workerProcessSkill,
    s.mealQualificationRule,
    s.accountingMapping,
    s.listOption,
    s.reportHeaderSetting,
    s.mealCostSetting,
    s.appSetting,
    s.process,
    s.worker,
    s.supplier,
    s.item,
    s.appUser,
  ];
  for (const t of order) await db.delete(t);
}

/* ------------------------------------------------------------------- main -- */

async function main() {
  console.log('Seeding Ugabrush Manufacturing System...\n');
  await clearAll();

  /* ---------------------------------------------------------------- users -- */
  const hash = await bcrypt.hash('ugabrush2026', 10);
  const users = await db
    .insert(s.appUser)
    .values([
      { email: 'muenoch@gmail.com', name: 'Enoch', passwordHash: hash, role: 'ADMIN' },
      { email: 'prossy@ugabrush.local', name: 'Ms. Prossy', passwordHash: hash, role: 'TEAM' },
      { email: 'viewer@ugabrush.local', name: 'Viewer', passwordHash: hash, role: 'VIEW' },
    ])
    .returning();
  const adminId = users[0].id;
  console.log(`  users                  ${users.length}`);

  /* --------------------------------------------------------------- items --- */
  const itemRows = await db
    .insert(s.item)
    .values(
      (data.items as Row[]).map((r, i) => ({
        code: String(r.code),
        name: String(r.name ?? r.code),
        category: String(r.category ?? 'Raw Material'),
        baseUom: String(r.baseUom ?? 'piece'),
        standardCost: num(r.standardCost),
        reorderLevel: num(r.reorderLevel),
        trackedByBatch: yes(r.trackedByBatch),
        active: r.active === null ? true : yes(r.active),
        sortOrder: i,
      })),
    )
    .returning();
  const itemByCode = new Map(itemRows.map((r) => [r.code, r.id]));
  console.log(`  items                  ${itemRows.length}`);

  /* ------------------------------------------------------------ suppliers -- */
  const supRows = await db
    .insert(s.supplier)
    .values(
      (data.suppliers as Row[]).map((r, i) => ({
        code: String(r.code),
        name: String(r.name ?? r.code),
        categorySupplied: r.categorySupplied ?? null,
        contact: r.contact ?? null,
        supplierType: String(r.supplierType ?? 'Inventory Supplier'),
        active: r.active === null ? true : yes(r.active),
        sortOrder: i,
      })),
    )
    .returning();
  const supByName = new Map(supRows.map((r) => [r.name, r.id]));
  console.log(`  suppliers              ${supRows.length}`);

  /* -------------------------------------------------------------- workers -- */
  const workerRows = await db
    .insert(s.worker)
    .values(
      (data.workers as Row[]).map((r, i) => ({
        code: String(r.code),
        name: String(r.name ?? r.code),
        processesAbleToDo: r.processesAbleToDo ?? null,
        active: r.active === null ? true : yes(r.active),
        sortOrder: i,
      })),
    )
    .returning();
  const workerByName = new Map(workerRows.map((r) => [r.name, r.id]));
  const workerByCode = new Map(workerRows.map((r) => [r.code, r.id]));
  console.log(`  workers                ${workerRows.length}`);

  /* ------------------------------------------------------------ processes -- */
  const procRows = await db
    .insert(s.process)
    .values(
      (data.processes as Row[]).map((r) => ({
        code: String(r.code),
        name: String(r.name ?? r.code),
        sequenceNo: n0(r.sequenceNo),
        inputStage: r.inputStage ?? null,
        outputStage: r.outputStage ?? null,
        consumesMaterials: r.consumesMaterials ?? null,
        producesStockItem: r.producesStockItem ?? null,
      })),
    )
    .returning();
  const procByCode = new Map(procRows.map((r) => [r.code, r.id]));
  console.log(`  processes              ${procRows.length}`);

  /* --------------------------------------------------------- worker skills -- */
  const skillValues = (data.workerSkills as Row[])
    .map((r) => ({
      workerId: workerByCode.get(String(r.workerCode)),
      processId: procByCode.get(String(r.processCode)),
      skillStatus: String(r.skillStatus ?? 'Can Do'),
      active: r.active === null ? true : yes(r.active),
      notes: r.notes ?? null,
    }))
    .filter((r) => r.workerId && r.processId) as any[];
  if (skillValues.length) await db.insert(s.workerProcessSkill).values(skillValues);
  console.log(`  worker skills          ${skillValues.length}`);

  /* --------------------------------------------------------- piece rates --- */
  const rateValues = (data.pieceRates as Row[])
    .map((r) => ({
      processId: procByCode.get(String(r.processCode)),
      productItemId: itemByCode.get(String(r.productType)),
      ratePerUnit: num(r.ratePerUnit),
      unit: String(r.unit ?? 'piece'),
      effectiveFrom: d10(r.effectiveFrom) ?? '2026-07-01',
      active: r.active === null ? true : yes(r.active),
      notes: r.notes ?? null,
    }))
    .filter((r) => r.processId && r.productItemId) as any[];
  if (rateValues.length) await db.insert(s.pieceRate).values(rateValues);
  console.log(`  piece rates            ${rateValues.length}`);

  /* ---------------------------------------------------------- purchases --- */
  const purchaseValues = (data.purchases as Row[])
    .map((r) => ({
      code: `PU${pad(r._row - 3, 5)}`,
      date: d10(r.date)!,
      supplierId: supByName.get(String(r.supplier)),
      itemId: itemByCode.get(String(r.itemCode)),
      batchNo: r.batchNo ?? null,
      qty: n0(r.qty),
      totalCost: n0(r.totalCost),
      qualityNotes: r.qualityNotes ?? null,
      createdById: adminId,
      createdByName: 'Imported from Sheets',
    }))
    .filter((r) => r.supplierId && r.itemId && r.date) as any[];
  const purchaseRows = purchaseValues.length
    ? await db.insert(s.purchase).values(purchaseValues).returning()
    : [];
  const purchaseByBatch = new Map(
    purchaseRows.filter((p) => p.batchNo).map((p) => [p.batchNo as string, p.id]),
  );
  console.log(`  purchases              ${purchaseRows.length}`);

  /* ------------------------------------------------------------- batches --- */
  const batchValues = (data.batches as Row[])
    .map((r) => ({
      batchNo: String(r.batchNo),
      itemId: itemByCode.get(String(r.itemCode)),
      supplierId: supByName.get(String(r.supplier)) ?? null,
      purchaseDate: d10(r.purchaseDate)!,
      qtyReceived: n0(r.qtyReceived),
      unitCost: num(r.unitCost),
      quality: r.quality ?? null,
      purchaseId: purchaseByBatch.get(String(r.batchNo)) ?? null,
    }))
    .filter((r) => r.itemId && r.purchaseDate) as any[];
  if (batchValues.length) await db.insert(s.batch).values(batchValues);
  console.log(`  batches                ${batchValues.length}`);

  /* ----------------------------------------------------------- movements --- */
  const movementValues = (data.movements as Row[])
    .map((r) => ({
      code: `MV${pad(r._row - 3, 5)}`,
      date: d10(r.date)!,
      itemId: itemByCode.get(String(r.itemCode)),
      batchNo: r.batchNo ?? null,
      movementType: String(r.movementType),
      qty: n0(r.qty),
      unitCost: num(r.unitCost),
      refSource: r.refSource ?? null,
      byName: r.by ?? null,
      note: r.note ?? null,
      issuedToType: r.issuedToType ?? null,
      issuedTo: r.issuedTo ?? null,
      receivedBy: r.receivedBy ?? null,
      sourcePurchaseId:
        r.refSource === 'Purchase' && r.batchNo
          ? purchaseByBatch.get(String(r.batchNo)) ?? null
          : null,
      createdById: adminId,
    }))
    .filter((r) => r.itemId && r.date && r.movementType) as any[];
  if (movementValues.length) await db.insert(s.inventoryMovement).values(movementValues);
  console.log(`  movements              ${movementValues.length}`);

  /* ---------------------------------------------------------- operations --- */
  const opValues = (data.operations as Row[])
    .map((r) => ({
      code: `OP${pad(r._row - 3, 5)}`,
      date: d10(r.date)!,
      workerId: workerByName.get(String(r.worker)),
      processId: procByCode.get(String(r.processCode)),
      productItemId: itemByCode.get(String(r.productType)),
      inputBatch: r.inputBatch ?? null,
      outputBatch: r.outputBatch ?? null,
      acceptedQty: n0(r.acceptedQty),
      rejectedQty: n0(r.rejectedQty),
      rejectReason: r.rejectReason ?? null,
      notes: r.notes ?? null,
      createdById: adminId,
    }))
    .filter((r) => r.workerId && r.processId && r.productItemId) as any[];
  if (opValues.length) await db.insert(s.productionOperation).values(opValues);
  console.log(`  operations             ${opValues.length}`);

  /* ---------------------------------------------------------- dispatches --- */
  const dispatchValues = (data.dispatches as Row[])
    .map((r) => ({
      code: `DS${pad(r._row - 3, 5)}`,
      date: d10(r.date)!,
      destinationName: String(r.destinationName ?? 'Unknown'),
      productItemId: itemByCode.get(String(r.productCode)),
      qty: n0(r.qty),
      unitPrice: num(r.unitPrice),
      note: r.note ?? null,
      destinationType: r.destinationType ?? null,
      personResponsible: r.personResponsible ?? null,
      deliveryNoteNo: r.deliveryNoteNo != null ? String(r.deliveryNoteNo) : null,
      salesOrderNo: r.salesOrderNo != null ? String(r.salesOrderNo) : null,
      createdById: adminId,
    }))
    .filter((r) => r.productItemId && r.date) as any[];
  if (dispatchValues.length) await db.insert(s.dispatch).values(dispatchValues);
  console.log(`  dispatches             ${dispatchValues.length}`);

  /* --------------------------------------------------------------- meals --- */
  const mealValues = (data.meals as Row[])
    .map((r) => {
      const topUp = n0(r.workerTopUp);
      const fullCost = n0(r.fullCostDeduction);
      const total = topUp + fullCost;
      const cash = n0(r.workerCashPaid);
      // DEVIATION 1: net balance derives from what the worker actually owes,
      // not from the flat per-plate cap. See DEVIATIONS.md.
      const net = Math.max(0, total - cash);
      return {
        code: `MEAL${pad(r._row - 3, 4)}`,
        date: d10(r.date)!,
        workerId: workerByName.get(String(r.worker)),
        plateCount: n0(r.plateCount),
        qualified: String(r.qualified ?? 'No'),
        qualifiedPlates: n0(r.qualifiedPlates),
        unqualifiedPlates: n0(r.unqualifiedPlates),
        companyContribution: n0(r.companyContribution),
        workerTopUp: topUp,
        fullCostDeduction: fullCost,
        totalWorkerDeduction: total,
        workerCashPaid: cash,
        netWorkerMealBalance: net,
        weekStart: weekStartOf(d10(r.date)!),
        companyFullySponsored: String(r.companyFullySponsored ?? 'No'),
        foodProviderId: supByName.get(String(r.foodProvider)) ?? null,
        actualPlateCost: num(r.actualPlateCost),
        actualCompanyContribution: num(r.actualCompanyContribution),
        workerRequiredContribution: num(r.workerRequiredContribution),
        supplierPriceChanged: String(r.supplierPriceChanged ?? 'No'),
        contributionChanged: String(r.contributionChanged ?? 'No'),
        reasonForChange: r.reasonForChange ?? null,
        note: r.note ?? null,
        approvedBy: r.approvedBy ?? null,
        createdById: adminId,
      };
    })
    .filter((r) => r.workerId && r.date) as any[];
  if (mealValues.length) await db.insert(s.meal).values(mealValues);
  console.log(`  meals                  ${mealValues.length}`);

  /* ---------------------------------------------------------- deductions --- */
  const dedValues = (data.deductions as Row[])
    .map((r) => ({
      code: `DED${pad(r._row - 3, 4)}`,
      date: d10(r.date)!,
      workerId: workerByName.get(String(r.worker)),
      deductionType: String(r.deductionType ?? 'Other'),
      amount: n0(r.amount),
      reason: r.reason ?? null,
      approvedBy: r.approvedBy ?? null,
      status: String(r.status ?? 'Pending'),
      notes: r.notes ?? null,
      createdById: adminId,
    }))
    .filter((r) => r.workerId && r.date) as any[];
  if (dedValues.length) await db.insert(s.deduction).values(dedValues);
  console.log(`  deductions             ${dedValues.length}`);

  /* ------------------------------------------------------------ expenses --- */
  const expValues = (data.expenses as Row[])
    .map((r) => ({
      code: `EXP${pad(r._row - 3, 4)}`,
      date: d10(r.date)!,
      providerId: supByName.get(String(r.provider)),
      expenseCategory: r.expenseCategory ?? null,
      periodFrom: d10(r.periodFrom),
      periodTo: d10(r.periodTo),
      plates: num(r.plates),
      plateCost: num(r.plateCost),
      totalBill: n0(r.totalBill),
      amountPaid: n0(r.amountPaid),
      accountPaidFrom: r.accountPaidFrom ?? null,
      paymentMethod: r.paymentMethod ?? null,
      transactionNo: r.transactionNo != null ? String(r.transactionNo) : null,
      paidBy: r.paidBy ?? null,
      notes: r.notes ?? null,
      createdById: adminId,
    }))
    .filter((r) => r.providerId && r.date) as any[];
  if (expValues.length) await db.insert(s.expense).values(expValues);
  console.log(`  expenses               ${expValues.length}`);

  /* --------------------------------------------------------- meal rules --- */
  const ruleValues = (data.mealRules as Row[]).map((r, i) => ({
    ruleId: String(r.ruleId),
    processCode: String(r.processCode),
    ruleBasis: String(r.ruleBasis ?? 'Daily'),
    product: r.product ?? null,
    condition: r.condition ?? null,
    threshold: num(r.threshold),
    weeklySmallMin: num(r.weeklySmallMin),
    weeklyLargeMin: num(r.weeklyLargeMin),
    eatingDaysEarned: n0(r.eatingDaysEarned),
    active: r.active === null ? true : yes(r.active),
    notes: r.notes ?? null,
    sortOrder: i,
  }));
  if (ruleValues.length) await db.insert(s.mealQualificationRule).values(ruleValues);
  console.log(`  meal rules             ${ruleValues.length}`);

  /* ------------------------------------------------------------ settings --- */
  const kv = (rows: Row[]) =>
    rows.map((r, i) => ({
      key: String(r.key),
      value: r.value === null ? null : String(r.value),
      note: r.note ?? null,
      sortOrder: i,
    }));

  await db.insert(s.appSetting).values(kv(data.settings));
  await db.insert(s.mealCostSetting).values(kv(data.mealCostSettings));
  await db.insert(s.reportHeaderSetting).values(kv(data.reportHeader));
  console.log(`  settings               ${data.settings.length}`);
  console.log(`  meal cost settings     ${data.mealCostSettings.length}`);
  console.log(`  report header          ${data.reportHeader.length}`);

  /* --------------------------------------------------------------- lists --- */
  const listValues: any[] = [];
  const signs = new Map<string, number>();
  // "Movement Type" and "Sign" are parallel columns in the sheet.
  const mt: string[] = data.lists['Movement Type'] ?? [];
  const sg: any[] = data.lists['Sign'] ?? [];
  mt.forEach((v, i) => signs.set(v, Number(sg[i] ?? 1)));

  for (const [category, values] of Object.entries(data.lists as Record<string, any[]>)) {
    if (category === 'Sign') continue; // stored as metadata on Movement Type
    values.forEach((v, i) => {
      const value = String(v);
      // Skip the trailing help text row under Movement Type.
      if (category === 'Movement Type' && !signs.has(value)) return;
      listValues.push({
        category,
        value,
        numericMeta: category === 'Movement Type' ? signs.get(value) ?? 1 : null,
        sortOrder: i,
      });
    });
  }
  await db.insert(s.listOption).values(listValues);
  console.log(`  list options           ${listValues.length}`);

  /* --------------------------------------------------- accounting mapping -- */
  await db.insert(s.accountingMapping).values(
    (data.accountingMappings as Row[]).map((r, i) => ({
      mappingKey: String(r.mappingKey),
      debitAccount: r.debitAccount ?? null,
      creditAccount: r.creditAccount ?? null,
      notes: r.notes ?? null,
      sortOrder: i,
    })),
  );
  console.log(`  accounting mappings    ${data.accountingMappings.length}`);

  /* ----------------------------------------------------------- audit log --- */
  const auditValues = (data.auditLog as Row[])
    .map((r) => ({
      timestamp: ts(r.timestamp) ?? new Date(),
      userId: null,
      userName: String(r.user ?? '(unknown)'),
      action: String(r.action ?? 'SETUP_CHANGE'),
      entity: r.sheet ?? null,
      refId: r.ref != null ? String(r.ref) : null,
      details: parseJson(r.details),
      result: String(r.result ?? 'OK'),
    }))
    .filter((r) => r.timestamp);
  if (auditValues.length) await db.insert(s.auditLog).values(auditValues as any);
  console.log(`  audit log              ${auditValues.length}`);

  /* ---------------------------------------------------------- report log --- */
  const reportValues = (data.reportLog as Row[]).map((r) => ({
    timestamp: ts(r.timestamp) ?? new Date(),
    userId: null,
    userName: String(r.user ?? '(unknown)'),
    action: String(r.action ?? 'REPORT_GENERATED'),
    reportType: String(r.reportType ?? 'Report'),
    period: r.period ? String(r.period).slice(0, 10) : null,
    filters: r.filters ?? null,
    note: r.note ?? null,
    status: String(r.status ?? 'OK'),
    output: r.output ?? null,
  }));
  if (reportValues.length) await db.insert(s.reportLog).values(reportValues as any);
  console.log(`  report log             ${reportValues.length}`);

  /* -------------------------------------------------------- void register -- */
  const voidValues = (data.voidRegister as Row[]).map((r) => ({
    code: `VOID${pad(r._row - 3, 4)}`,
    timestamp: ts(r.timestamp) ?? new Date(),
    logType: String(r.logType ?? 'unknown'),
    entity: String(r.sheet ?? 'unknown'),
    sourceId: null,
    entryCode: r.entryId ? String(r.entryId) : null,
    reason: String(r.reason ?? 'imported'),
    voidedByName: String(r.voidedBy ?? '(unknown)'),
    status: String(r.status ?? 'Voided'),
    restoredAt: ts(r.restoredAt),
    restoredByName: r.restoredBy ?? null,
    reversalEffect: r.reversalEffect ?? null,
    oldValues: parseJson(r.oldValues),
  }));
  if (voidValues.length) await db.insert(s.voidRegister).values(voidValues as any);
  console.log(`  void register          ${voidValues.length}`);

  /* ------------------------------------------------------- batch renames --- */
  const renameValues = (data.batchRenameLog as Row[]).map((r) => ({
    timestamp: ts(r.timestamp) ?? new Date(),
    oldBatchNo: String(r.oldBatchNo),
    newBatchNo: String(r.newBatchNo),
    itemCode: r.item ?? null,
    oldPurchaseDate: d10(r.oldPurchaseDate),
    newPurchaseDate: d10(r.newPurchaseDate),
    changedByName: String(r.changedBy ?? '(unknown)'),
    reason: r.reason ?? null,
    sourcePurchaseCode: r.sourcePurchaseId ?? null,
    status: String(r.status ?? 'Applied'),
  }));
  if (renameValues.length) await db.insert(s.batchRenameLog).values(renameValues as any);
  console.log(`  batch renames          ${renameValues.length}`);

  console.log('\nSeed complete.');
  console.log('Sign in with  muenoch@gmail.com  /  ugabrush2026');
}

main()
  .then(async () => {
    await closeDb();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(`\n${explainDbError(err)}\n`);
    await closeDb().catch(() => {});
    process.exit(1);
  });
