/**
 * Functional test of the write path and the calculation chain.
 *
 * Simulates a real production day: sets the missing piece rates, records
 * operations across the routing, then checks that WIP, direct labour, meal
 * qualification and payroll all respond correctly. Everything is rolled back at
 * the end, so the database is left exactly as it was found.
 *
 *   npx tsx scripts/functional.ts
 */

import './_env';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '../src/db';
import * as s from '../src/db/schema';
import { loadSnapshot, finalPayments, labourByWorker, rateInForce, wipHandles, wipProducts } from '../src/lib/core';
import { costMeal, qualificationFor } from '../src/lib/meal-engine';
import { nextBatchNo, nextOperationCode, nextPurchaseCode } from '../src/lib/codes';
import { weekStart } from '../src/lib/dates';

let passed = 0;
let failed = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const a = typeof actual === 'number' ? Math.round(actual * 1000) / 1000 : actual;
  const e = typeof expected === 'number' ? Math.round(expected * 1000) / 1000 : expected;
  if (a === e) {
    passed++;
    console.log(`  PASS  ${label.padEnd(56)} ${String(a)}`);
  } else {
    failed++;
    console.log(`  FAIL  ${label.padEnd(56)} got ${String(a)}, expected ${String(e)}`);
  }
}

function heading(text: string) {
  console.log(`\n${text}\n${'-'.repeat(82)}`);
}

const TEST_DATE = '2026-07-13'; // a Monday, so the whole test week is closed
const createdOpIds: number[] = [];
const patchedRateIds: number[] = [];

async function main() {
  console.log('\nUGABRUSH — functional test\n' + '='.repeat(82));

  /* ------------------------------------------------------- code generation */
  heading('Identifier generation');
  const pu = await nextPurchaseCode();
  const op = await nextOperationCode();
  check('next purchase code follows the highest existing', pu, 'PU00046');
  check('next operation code starts the sequence', op, 'OP00001');
  const batchNo = await nextBatchNo('HAIR', TEST_DATE);
  check('next batch number for HAIR on 13/07/26', batchNo, 'HAIR-130726-01');

  /* ------------------------------------------------------------ piece rates */
  heading('Filling the blank piece rates');
  let snap = await loadSnapshot();
  const blanks = snap.rates.filter((r) => r.ratePerUnit === null);
  check('blank rates before', blanks.length, 11);

  // Give every blank rate a value so operations can be recorded.
  for (const r of blanks) {
    await db.update(s.pieceRate).set({ ratePerUnit: 100 }).where(eq(s.pieceRate.id, r.id));
    patchedRateIds.push(r.id);
  }
  snap = await loadSnapshot();
  check('blank rates after', snap.rates.filter((r) => r.ratePerUnit === null).length, 0);

  /* ------------------------------------------------- record a production day */
  heading('Recording a production day');

  const worker = snap.workers.find((w) => w.name.includes('Nalugo'))!;
  const proc = (code: string) => snap.processes.find((p) => p.code === code)!;
  const item = (code: string) => snap.itemByCode.get(code)!;

  // 120 small handles through the handle line, then 100 brushes through tufting.
  const plan: { process: string; product: string; accepted: number; rejected?: number }[] = [
    { process: 'MSAND', product: 'HDL-S', accepted: 120 },
    { process: 'DRILL', product: 'HDL-S', accepted: 110 },
    { process: 'HSAND', product: 'HDL-S', accepted: 105 },
    { process: 'TUFT', product: 'BR-S', accepted: 100 },
    { process: 'TRIM', product: 'BR-S', accepted: 98, rejected: 2 },
    { process: 'FINISH', product: 'BR-S', accepted: 95 },
    { process: 'QC', product: 'BR-S', accepted: 92 },
    { process: 'PACK', product: 'BR-S', accepted: 90 },
  ];

  let expectedLabour = 0;
  for (const step of plan) {
    const p = proc(step.process);
    const it = item(step.product);
    const rate = rateInForce(snap, p.id, it.id, TEST_DATE) ?? 0;
    expectedLabour += step.accepted * rate;

    const [row] = await db
      .insert(s.productionOperation)
      .values({
        code: await nextOperationCode(),
        date: TEST_DATE,
        workerId: worker.id,
        processId: p.id,
        productItemId: it.id,
        acceptedQty: step.accepted,
        rejectedQty: step.rejected ?? 0,
        rejectReason: step.rejected ? 'Poor finish/varnish' : null,
        pieceRateApplied: rate,
        directLabourCost: step.accepted * rate,
        wipStage: p.outputStage,
        createdByName: 'functional test',
      })
      .returning();
    createdOpIds.push(row.id);
  }
  check('operations inserted', createdOpIds.length, 8);

  snap = await loadSnapshot();

  /* --------------------------------------------------------------- labour -- */
  heading('Direct labour');
  const labour = labourByWorker(snap, '2026-07').find((w) => w.id === worker.id)!;
  check('accepted units recorded', labour.accepted, 810);
  check('rejected units recorded', labour.rejected, 2);
  check('direct labour cost matches rates x accepted', labour.cost, expectedLabour);
  check('cost is greater than zero', labour.cost > 0, true);

  /* ------------------------------------------------------------------ WIP -- */
  heading('Work in progress');
  const hdlS = wipHandles(snap).find((h) => h.handleCode === 'HDL-S')!;
  const stage = (rows: { key: string; value: number }[], key: string) =>
    rows.find((r) => r.key === key)?.value ?? 0;

  check('HDL-S: m/sanded not drilled  (120 - 110)', stage(hdlS.stages, 'msand'), 10);
  check('HDL-S: drilled not h/sanded  (110 - 105)', stage(hdlS.stages, 'drill'), 5);
  check('HDL-S: h/sanded not tufted   (105 - 100)', stage(hdlS.stages, 'hsand'), 5);

  const brS = wipProducts(snap).find((p) => p.productCode === 'BR-S')!;
  check('BR-S: tufted not trimmed     (100 - 98)', stage(brS.stages, 'tuft'), 2);
  check('BR-S: trimmed not finished   (98 - 95)', stage(brS.stages, 'trim'), 3);
  check('BR-S: finished not QC        (95 - 92)', stage(brS.stages, 'finish'), 3);
  check('BR-S: QC not packed          (92 - 90)', stage(brS.stages, 'qc'), 2);
  // 90 packed less 1,490 already dispatched.
  check('BR-S: packed less dispatched (90 - 1490)', stage(brS.stages, 'packed'), -1400);

  // The large handle is shared by BR-L and BR-CUSTOM — it must not double count.
  const hdlL = wipHandles(snap).find((h) => h.handleCode === 'HDL-L')!;
  check('HDL-L reported once, not once per product', hdlL.stages.length, 4);

  /* ------------------------------------------------- meal qualification --- */
  heading('Meal qualification earned from that production');
  const q = qualificationFor(snap, worker.id, TEST_DATE);
  check('week start is the Monday', q.weekStart, weekStart(TEST_DATE, snap.weekStartsOn));
  // MSAND >= 100 small = 1 day; DRILL >= 100 small = 1 day; HSAND > 50 = 1 day.
  // Capped at 1 eating day per calendar day.
  check('daily eating days earned (capped at 1/day)', q.dailyDaysEarned, 1);
  check('weekly TUFT small counted', q.tuftSmallWeek, 100);
  // 100 small tufted clears the >= 90 tier, which awards 6 days.
  check('weekly TUFT tier days', q.tuftWeeklyDays, 6);
  check('combined (Max rule) then weekly cap', q.finalDaysEarned, 6);
  check('days remaining before any meals', q.daysRemaining, 6);

  /* ------------------------------------------------------- meal costing --- */
  heading('Meal costing');
  const qualifiedMeal = costMeal(snap, { plateCount: 1, daysRemaining: q.daysRemaining, workerCashPaid: 0 });
  check('qualified plate is qualified', qualifiedMeal.qualifiedPlates, 1);
  check('company pays the top-up', qualifiedMeal.companyContribution, 1500);
  check('worker owes the capped contribution', qualifiedMeal.totalWorkerDeduction, 1000);

  const unqualifiedMeal = costMeal(snap, { plateCount: 2, daysRemaining: 0, workerCashPaid: 2000 });
  check('no days left -> both plates unqualified', unqualifiedMeal.unqualifiedPlates, 2);
  check('charged at full plate cost (2 x 2500)', unqualifiedMeal.fullCostDeduction, 5000);
  check('net after 2,000 cash paid', unqualifiedMeal.netWorkerMealBalance, 3000);

  const sponsored = costMeal(snap, {
    plateCount: 3,
    daysRemaining: 0,
    companyFullySponsored: true,
  });
  check('fully sponsored costs the worker nothing', sponsored.totalWorkerDeduction, 0);
  check('fully sponsored is billed to the company', sponsored.companyContribution, 7500);

  /* ------------------------------------------------------------ payroll --- */
  heading('Payroll');
  const pay = finalPayments(snap, '2026-07').find((p) => p.workerId === worker.id)!;
  check('gross equals direct labour earned', pay.grossDirectLabour, expectedLabour);
  check('net payable = gross less deductions', pay.finalPayment, Math.max(0, pay.grossDirectLabour - pay.totalDeductions));
  check('status is payable', pay.status, 'PAYABLE');

  /* -------------------------------------------------------------- voiding -- */
  heading('Voiding');
  const target = createdOpIds[0];
  await db.update(s.productionOperation).set({ voidedAt: new Date() }).where(eq(s.productionOperation.id, target));
  snap = await loadSnapshot();
  const afterVoid = labourByWorker(snap, '2026-07').find((w) => w.id === worker.id)!;
  check('voided operation drops out of labour', afterVoid.operations, 7);
  check('voided operation drops out of accepted', afterVoid.accepted, 690);

  await db.update(s.productionOperation).set({ voidedAt: null }).where(eq(s.productionOperation.id, target));
  snap = await loadSnapshot();
  const afterRestore = labourByWorker(snap, '2026-07').find((w) => w.id === worker.id)!;
  check('restoring brings it back', afterRestore.accepted, 810);

  /* -------------------------------------------------------------- cleanup -- */
  heading('Cleanup');
  await db.delete(s.productionOperation).where(inArray(s.productionOperation.id, createdOpIds));
  for (const id of patchedRateIds) {
    await db.update(s.pieceRate).set({ ratePerUnit: null }).where(eq(s.pieceRate.id, id));
  }

  const finalSnap = await loadSnapshot();
  check('operations removed', finalSnap.operations.length, 0);
  check('blank rates restored', finalSnap.rates.filter((r) => r.ratePerUnit === null).length, 11);

  console.log(`\n${'='.repeat(82)}`);
  console.log(`${passed} passed, ${failed} failed`);
  console.log('='.repeat(82) + '\n');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  // Best-effort cleanup so a failure never leaves test data behind.
  if (createdOpIds.length) {
    await db.delete(s.productionOperation).where(inArray(s.productionOperation.id, createdOpIds));
  }
  for (const id of patchedRateIds) {
    await db.update(s.pieceRate).set({ ratePerUnit: null }).where(eq(s.pieceRate.id, id));
  }
  process.exit(1);
});
