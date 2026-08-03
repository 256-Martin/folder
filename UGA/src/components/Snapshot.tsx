import { money, qty as fmtQty, dateLong } from '@/lib/format';

/**
 * Renders the "before" copy stored against a voided entry.
 *
 * Snapshots come in two shapes. Rows imported from the workbook hold a short,
 * friendly object (`{item, qty, cost}`). Rows voided in the app hold the whole
 * database record, including plumbing that means nothing to a reader — internal
 * ids, timestamps, and fields that are always null at the moment of voiding.
 *
 * Rather than print either as raw JSON, this drops the plumbing, turns keys into
 * readable labels, formats money and dates, and resolves the *Id columns to the
 * codes and names they point at.
 */

/** Never worth showing: internal keys, or fields that are null when voided. */
const HIDDEN = new Set([
  'id',
  'code',
  'createdAt',
  'createdById',
  'createdByName',
  'voidedAt',
  'voidedById',
  'voidedByName',
  'voidReason',
  'purchaseId',
  'sourcePurchaseId',
  'sourceDispatchId',
  'weekStart',
]);

/** Columns that hold a reference, and the lookup that turns them into a name. */
const REFERENCES: Record<string, 'item' | 'supplier' | 'worker' | 'process'> = {
  itemId: 'item',
  productItemId: 'item',
  supplierId: 'supplier',
  providerId: 'supplier',
  foodProviderId: 'supplier',
  workerId: 'worker',
  processId: 'process',
};

const MONEY = /cost|price|amount|bill|paid|contribution|deduction|balance|rate/i;
const DATEISH = /^date$|date$/i;

export type SnapshotNames = {
  item: Record<number, string>;
  supplier: Record<number, string>;
  worker: Record<number, string>;
  process: Record<number, string>;
};

/** "totalCost" -> "Total cost", "batchNo" -> "Batch no". */
function humanise(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .toLowerCase()
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function present(key: string, value: unknown, names: SnapshotNames): string | null {
  if (value === null || value === undefined || value === '') return null;

  const ref = REFERENCES[key];
  if (ref && typeof value === 'number') {
    return names[ref][value] ?? `#${value}`;
  }

  if (typeof value === 'number') {
    if (MONEY.test(key)) return money(value);
    return fmtQty(value);
  }

  if (typeof value === 'boolean') return value ? 'Yes' : 'No';

  const str = String(value);
  if (DATEISH.test(key) && /^\d{4}-\d{2}-\d{2}/.test(str)) return dateLong(str.slice(0, 10));
  return str;
}

type Row = { label: string; value: string };

function toRows(data: unknown, names: SnapshotNames): Row[] {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return [];
  const out: Row[] = [];
  for (const [key, raw] of Object.entries(data as Record<string, unknown>)) {
    if (HIDDEN.has(key)) continue;
    const value = present(key, raw, names);
    if (value === null) continue;
    // "itemId" reads as "Item" once it has been resolved to a name.
    const label = humanise(REFERENCES[key] ? key.replace(/Id$/, '') : key);
    out.push({ label, value });
  }
  return out;
}

export function Snapshot({ data, names }: { data: unknown; names: SnapshotNames }) {
  const rows = toRows(data, names);

  if (rows.length === 0) {
    return (
      <span className="text-2xs italic text-faint">No snapshot was recorded</span>
    );
  }

  // Collapsed line: enough to recognise the entry without opening it.
  const summary = rows
    .slice(0, 3)
    .map((r) => r.value)
    .join(' · ');

  return (
    <details className="group">
      <summary className="cursor-pointer list-none truncate text-2xs text-muted hover:text-ink">
        {summary}
        <span className="ml-1 font-medium text-info group-open:hidden">· more</span>
      </summary>
      <dl className="mt-1.5 space-y-0.5 rounded-lg bg-raised p-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-3 text-2xs">
            <dt className="shrink-0 text-muted">{r.label}</dt>
            <dd className="min-w-0 truncate text-right font-medium text-ink">{r.value}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
