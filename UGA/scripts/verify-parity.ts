/**
 * Parity harness.
 *
 * Asserts that the application's calculation engine reproduces the figures the
 * Google Sheet shows today. Run after seeding:
 *
 *   npm run verify
 */

import './_env';
import {
  finishedGoods,
  handleStock,
  loadSnapshot,
  materialStock,
  mealDeductions,
  stockRows,
  supplierScorecard,
  ustapleStock,
} from '../src/lib/core';

let passed = 0;
let failed = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const a = typeof actual === 'number' ? Math.round(actual * 1000) / 1000 : actual;
  const e = typeof expected === 'number' ? Math.round(expected * 1000) / 1000 : expected;
  const ok = a === e;
  if (ok) {
    passed++;
    console.log(`  PASS  ${label.padEnd(52)} ${String(a)}`);
  } else {
    failed++;
    console.log(`  FAIL  ${label.padEnd(52)} got ${String(a)}, expected ${String(e)}`);
  }
}

function heading(text: string) {
  console.log(`\n${text}`);
  console.log('-'.repeat(78));
}

async function main() {
  const snap = await loadSnapshot();
  const stock = new Map(stockRows(snap).map((r) => [r.code, r]));
  const scorecard = new Map(supplierScorecard(snap).map((r) => [r.supplier, r]));
  const fg = new Map(finishedGoods(snap).map((r) => [r.code, r]));

  console.log('\nUGABRUSH — parity against the spreadsheet\n' + '='.repeat(78));

  /* -------------------------------------------------------------- volumes -- */
  heading('Record counts');
  check('items', snap.items.length, 15);
  check('suppliers', snap.suppliers.length, 6);
  check('workers', snap.workers.length, 10);
  check('processes', snap.processes.length, 11);
  check('piece rates', snap.rates.length, 25);
  check('piece rates blank (TO CONFIRM)', snap.rates.filter((r) => r.ratePerUnit === null).length, 11);
  check('purchases', snap.purchases.length, 45);
  check('inventory movements', snap.movements.length, 147);
  check('batches', snap.batches.length, 45);
  check('production operations', snap.operations.length, 0);
  check('dispatches', snap.dispatches.length, 3);
  check('meals', snap.meals.length, 5);
  check('meal qualification rules', snap.mealRules.length, 26);

  /* ------------------------------------------------------ material stock -- */
  heading('Material Stock Summary — balances');
  check('HAIR received', stock.get('HAIR')?.received, 15880);
  check('HAIR issued', stock.get('HAIR')?.issued, 1375);
  check('HAIR balance', stock.get('HAIR')?.balance, 14505);
  check('HAIR status', stock.get('HAIR')?.status, 'OK');
  check('TMB balance', stock.get('TMB')?.balance, 5);
  check('TIRE balance', stock.get('TIRE')?.balance, 0);
  check('TIRE status', stock.get('TIRE')?.status, 'LOW');
  check('VARN balance', stock.get('VARN')?.balance, 4);
  check('VARN status', stock.get('VARN')?.status, 'LOW');
  check('THIN balance', stock.get('THIN')?.balance, 4.5);
  check('HSPAPER balance', stock.get('HSPAPER')?.balance, 4);
  check('MBELT balance', stock.get('MBELT')?.balance, 6);
  check('WSPAPER balance', stock.get('WSPAPER')?.balance, 8);

  /* ------------------------------------------------------- handle stock --- */
  heading('Handle & U-Staple Stock');
  check('HDL-S received', stock.get('HDL-S')?.received, 3805);
  check('HDL-S issued', stock.get('HDL-S')?.issued, 1821);
  check('HDL-S balance', stock.get('HDL-S')?.balance, 1984);
  check('HDL-L received', stock.get('HDL-L')?.received, 1909);
  check('HDL-L issued', stock.get('HDL-L')?.issued, 1129);
  check('HDL-L balance', stock.get('HDL-L')?.balance, 780);
  check('USTAPLE balance', stock.get('USTAPLE')?.balance, 0);
  check('USTAPLE status', stock.get('USTAPLE')?.status, 'LOW');

  /* ----------------------------------------------------- finished goods --- */
  heading('Finished Goods Stock');
  check('BR-S produced', fg.get('BR-S')?.produced, 1590);
  check('BR-S dispatched', fg.get('BR-S')?.dispatched, 1490);
  check('BR-S in stock', fg.get('BR-S')?.inStock, 100);
  check('BR-S value on hand', fg.get('BR-S')?.valueOnHand, 250000);
  check('BR-L produced', fg.get('BR-L')?.produced, 100);
  check('BR-L dispatched', fg.get('BR-L')?.dispatched, 100);
  check('BR-L in stock', fg.get('BR-L')?.inStock, 0);
  check('BR-CUSTOM in stock', fg.get('BR-CUSTOM')?.inStock, 0);
  check(
    'total finished goods in stock',
    finishedGoods(snap).reduce((a, f) => a + f.inStock, 0),
    100,
  );

  /* ---------------------------------------------------------- purchases --- */
  heading('Purchases & Supplier Scorecard');
  check(
    'total purchase spend (all time)',
    snap.purchases.reduce((a, p) => a + p.totalCost, 0),
    7693735,
  );
  check('Nakawa Meat Packers — purchases', scorecard.get('Nakawa Meat Packers')?.purchases, 21);
  check('Nakawa Meat Packers — qty', scorecard.get('Nakawa Meat Packers')?.totalQty, 13297);
  check('Nakawa Meat Packers — cost', scorecard.get('Nakawa Meat Packers')?.totalCost, 4385500);
  check('Nakawa Meat Packers — open batches', scorecard.get('Nakawa Meat Packers')?.openBatchBalance, 11922);
  check('Kyengera — purchases', scorecard.get('Kyengera')?.purchases, 4);
  check('Kyengera — cost', scorecard.get('Kyengera')?.totalCost, 905000);
  check('Moses Timber — purchases', scorecard.get('Moses Timber and Furniture- Ndeeba')?.purchases, 9);
  check('Moses Timber — cost', scorecard.get('Moses Timber and Furniture- Ndeeba')?.totalCost, 1885735);
  check('Mr. Aniganyira Ismail — cost', scorecard.get('Mr. Aniganyira Ismail')?.totalCost, 307000);
  check('100% Jesus Hardware — cost', scorecard.get('100% Jesus General Hardware')?.totalCost, 210500);
  check('Mrs. Nangobi Lilian — purchases', scorecard.get('Mrs. Nangobi Lilian')?.purchases, 0);

  /* --------------------------------------------------------------- meals -- */
  heading('Meal Deductions — 2026-07');
  const meals = mealDeductions(snap, '2026-07');
  check('unqualified plates (total)', meals.reduce((a, m) => a + m.unqualifiedPlates, 0), 9);
  check('qualified plates (total)', meals.reduce((a, m) => a + m.qualifiedPlates, 0), 0);
  check('full-cost deductions (total)', meals.reduce((a, m) => a + m.fullCostDeductions, 0), 22500);
  check('worker cash paid (total)', meals.reduce((a, m) => a + m.workerCashPaid, 0), 8000);
  // DEVIATION 1: the sheet reported 1,000 here because the net used a flat cap.
  check('net meal deduction (corrected)', meals.reduce((a, m) => a + m.netMealDeduction, 0), 14500);

  /* ------------------------------------------------------------- summary -- */
  console.log('\n' + '='.repeat(78));
  console.log(`${passed} passed, ${failed} failed`);
  console.log('='.repeat(78) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
