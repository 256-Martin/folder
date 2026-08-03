# Deviations from the spreadsheet

You chose **"implement correct logic, document deviations."** This file is the complete
list. Everything not listed here behaves exactly as the Google Sheet does, and the
parity harness (`npm run verify`) asserts that against 60 real figures.

---

## 1. Net meal deduction is what the worker actually owes

**Sheet behaviour.** `Meal Log!S` computed `MAX(0, W − R)` where `W` is the
*Worker Required Contribution* — a flat per-plate cap of 1,000 UGX that was never
multiplied by plate count. `S` was the only column that flowed into
`Final Worker Payment Summary!C` and the dashboard, so the full-cost columns
(`J`, `K`) never reached payroll.

Two consequences:

- A worker taking four unqualified plates owed the same as one taking a single plate.
- The stated policy — "unqualified plate is fully worker-paid", `Meal Cost Settings!B8 = Yes` —
  never reached the payroll layer at all.

For July 2026 the sheet reported a net meal deduction of **1,000 UGX** against
full-cost deductions of 22,500 and cash received of 8,000.

**Here.** Net balance is:

```
totalWorkerDeduction = workerTopUp + fullCostDeduction
netWorkerMealBalance = max(0, totalWorkerDeduction − workerCashPaid)
```

The same July data now yields **14,500 UGX** — 22,500 charged less 8,000 already paid.
`scripts/verify-parity.ts` asserts both the inputs (9 unqualified plates, 22,500 charged,
8,000 cash) and the corrected 14,500 output.

**If you need the old number back:** change `costMeal()` in `src/lib/meal-engine.ts` to
return `Math.max(0, requiredPerQualified - cash)`.

---

## 2. Large-handle WIP is counted once

**Sheet behaviour.** `WIP Summary` mapped BR-L and BR-CUSTOM both to handle code
`HDL-L`. The four handle-stage formulas (columns D–G) keyed only on the handle code,
so rows 5 and 6 were byte-for-byte identical. The dashboard then summed
`D4:D6`, double-counting every large handle in the line. The `HSAND` half of the
crossover column was double-counted the same way.

**Here.** Handle-stage WIP is reported **per handle code** (`/wip`, upper table) and
brush-stage WIP **per product** (lower table). A large handle appears once regardless
of how many products are built on it. `scripts/functional.ts` asserts this.

This is currently invisible in your data because no handle operations have ever been
recorded — it would have appeared the moment CUT/MSAND/DRILL/HSAND were used.

---

## 3. Identifiers are stable

**Sheet behaviour.** Every ID came from row position:

```
=IF(AND($B4="",$C4=""),"","MEAL"&TEXT(ROW()-3,"0000"))
```

Deleting a row renumbered everything below it. This had already broken the audit
trail twice in your live data:

- VOID0001–0003 record MEAL0001/0002/0003 as voided (all three snapshots say
  *Ms Nalumansi Annet, 2026-07-13, 2 plates*). Today MEAL0002 is Ms Lunyole Justine
  and MEAL0003 is Ms Namukalaga Silvia — live, valid meals.
- VOID0004 and VOID0007 record PU00041 and PU00040 as voided. Both are live purchases today.

The voids themselves worked correctly — batch numbers are unique and stock is not
double-counted. Only the references rotted.

**Here.** IDs come from the database and never change. The Void Register stores the
record's permanent primary key alongside its display code, so a reference can never
drift onto a different record. Imported void rows are marked as such and cannot be
auto-restored, since their original targets no longer exist as distinct rows.

---

## 4. Data Issues covers three more sheets

**Sheet behaviour.** The rollup checked Purchases, Inventory Ledger, Production
Operations, Sales-Dispatch and Batch Register. The Meal Log, Deductions Log and
Expense & Provider Payments each had a working per-row `Data Check` column that was
never summed into the headline figure — so errors there never appeared anywhere.

**Here.** Three checks were added: meals without an approver, deductions still
pending approval, and expenses paid beyond the amount billed. The original checks are
all preserved.

---

## 5. Voiding never deletes

**Sheet behaviour.** Voiding removed the row and wrote a JSON snapshot to the Void
Register. Recovery meant re-keying from the snapshot by hand.

**Here.** The row is flagged with `voidedAt` and excluded from every calculation.
One click restores it, with linked records (a purchase's batch and ledger receipt;
a dispatch's ledger movement) carried along in the same transaction.

---

## 6. Every action records who performed it

**Sheet behaviour.** All 250 Audit Log rows, all 9 Void Register rows and all 122
Report Log rows read `(unknown)` — the Apps Script could not resolve the active user.

**Here.** The signed-in identity is attached to every mutation. Rows imported from
the spreadsheet keep `(unknown)` so the history is not misrepresented, and the Audit
Log page reports how many entries are attributed versus imported.

---

## 7. Stock summaries are item-driven

**Sheet behaviour.** `Material Stock Summary` was a hardcoded 8-row list. `S-TAPE`
(sealtape) was added to the Item Master later and never appeared in any stock
summary — 2 units and 16,000 UGX with no balance view, no low-stock alert and no
valuation. 14 of 15 items were covered.

**Here.** Stock pages read from the Item Master, so every item appears automatically
and new items can never fall into that blind spot.

---

## 8. Numeric storage

Quantities and money use PostgreSQL `double precision`, which is the same IEEE-754
arithmetic Google Sheets uses. That is deliberate — it guarantees figure-for-figure
parity with the workbook you are migrating from.

**For long-term accounting use**, migrate money columns to `numeric(18,4)`. UGX has
no minor unit in practice so the risk is low, but unit costs like
`378.3783783783784` (from 140,000 ÷ 370) do carry binary rounding. The change is a
column type migration plus a serialisation tweak in `src/db/schema.ts`; no business
logic depends on the storage type.

---

## Not changed

These were noted during the analysis and deliberately **left as they are**, because
changing them would alter figures you may still be reconciling against:

- **Operations do not move stock.** Recording a production operation does not write
  an inventory movement, exactly as in the sheet. Material issues and finished-goods
  receipts stay separate entries. This is the root cause of the 50 tires issued with
  zero U-staples produced, and of 2,950 handles issued against 1,690 brushes. A
  reconciliation view can be added without changing any recorded figure — say the
  word.
- **The CUT piece rate of 10,000 UGX/unit** is preserved as entered. It is 12–100×
  every other rate and looks like a per-timber-log figure sitting in a per-handle
  field, but it is your number to correct. The Piece Rates page shows it plainly.
- **Varnish and thinner standard costs** (78,000 and 24,000) are preserved. Both
  appear to be container prices in a per-litre field — VARN divides to exactly
  19,500/litre across 4 litres. Correct them in the Item Master when you're ready.
- **Row-503 capacity limits** simply do not exist here; tables grow without bound.
