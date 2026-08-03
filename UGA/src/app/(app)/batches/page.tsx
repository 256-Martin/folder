import { FilterBar } from '@/components/FilterBar';
import { Badge, Callout, DataCheck, PageHeader, Section, Stat, StatGrid, StatusBadge, TableWrap } from '@/components/ui';
import { getSession } from '@/lib/auth';
import { batchChecker, batchRows, loadSnapshot } from '@/lib/core';
import { monthOf } from '@/lib/dates';
import { dateLong, money, percent, qty } from '@/lib/format';
import { monthOptions } from '@/lib/options';

export const dynamic = 'force-dynamic';

export default async function BatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; item?: string; status?: string; q?: string }>;
}) {
  const params = await searchParams;
  await getSession();
  const snap = await loadSnapshot();

  const all = batchRows(snap).sort((a, b) =>
    a.purchaseDate === b.purchaseDate
      ? a.batchNo.localeCompare(b.batchNo)
      : a.purchaseDate < b.purchaseDate
        ? 1
        : -1,
  );

  const dataCheck = batchChecker(all);

  const rows = all.filter((b) => {
    if (params.month && b.purchaseDate.slice(0, 7) !== params.month) return false;
    if (params.item && b.itemCode !== params.item) return false;
    if (params.status && b.status !== params.status) return false;
    if (params.q && !b.batchNo.toLowerCase().includes(params.q.toLowerCase())) return false;
    return true;
  });

  const openBalance = rows.reduce((a, b) => a + b.balance, 0);
  const notUsed = rows.filter((b) => b.status === 'Not yet used').length;

  return (
    <>
      <PageHeader
        title="Batch Register"
        subtitle="Lot traceability. Batch numbers follow ITEMCODE-ddmmyy-NN and are created automatically when a purchase is recorded."
        badge={<Badge tone="info">Derived from purchases</Badge>}
      />

      <StatGrid cols={4}>
        <Stat label="Batches shown" value={rows.length} />
        <Stat label="Open balance" value={qty(openBalance)} hint="Received less issued" />
        <Stat label="Not yet used" value={notUsed} tone={notUsed > 0 ? 'warn' : 'ok'} />
        <Stat
          label="Batches with output linked"
          value={rows.filter((b) => b.outputLinked > 0).length}
          hint="Requires production operations"
        />
      </StatGrid>

      <Section className="mt-6">
        <FilterBar
          fields={[
            { type: 'select', name: 'month', label: 'Month', value: params.month, options: monthOptions(snap) },
            {
              type: 'select',
              name: 'item',
              label: 'Item',
              value: params.item,
              options: snap.items.map((x) => ({ value: x.code, label: x.code })),
            },
            {
              type: 'select',
              name: 'status',
              label: 'Status',
              value: params.status,
              options: [
                { value: 'OK', label: 'OK' },
                { value: 'Not yet used', label: 'Not yet used' },
                { value: 'NEGATIVE', label: 'Negative' },
              ],
            },
            { type: 'search', name: 'q', label: 'Search batch', value: params.q, placeholder: 'HAIR-010626-01' },
          ]}
        />

        <TableWrap>
          <table className="data">
            <thead>
              <tr>
                <th>Batch No.</th>
                <th>Item</th>
                <th>Item name</th>
                <th>UoM</th>
                <th>Supplier</th>
                <th>Purchased</th>
                <th>Month</th>
                <th className="num">Received</th>
                <th className="num">Unit cost</th>
                <th className="num">Issued</th>
                <th className="num">Balance</th>
                <th>Status</th>
                <th className="num">Output linked</th>
                <th className="num">Defect rate</th>
                <th>Quality</th>
                <th>Data check</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id}>
                  <td className="whitespace-nowrap font-mono text-xs font-medium">{b.batchNo}</td>
                  <td>{b.itemCode}</td>
                  <td className="text-muted">{b.itemName}</td>
                  <td className="text-muted">{snap.itemByCode.get(b.itemCode)?.baseUom ?? '—'}</td>
                  <td className="max-w-[14rem] truncate">{b.supplierName ?? '—'}</td>
                  <td className="whitespace-nowrap">{dateLong(b.purchaseDate)}</td>
                  <td className="whitespace-nowrap font-mono text-xs text-muted">{monthOf(b.purchaseDate)}</td>
                  <td className="num">{qty(b.qtyReceived)}</td>
                  <td className="num text-muted">{money(b.unitCost, { decimals: 2 })}</td>
                  <td className="num">{qty(b.qtyIssued)}</td>
                  <td className="num font-medium">{qty(b.balance)}</td>
                  <td>
                    <StatusBadge status={b.status} />
                  </td>
                  <td className="num">{b.outputLinked ? qty(b.outputLinked) : '—'}</td>
                  <td className="num">{b.defectRate !== null ? percent(b.defectRate) : '—'}</td>
                  <td className="max-w-[14rem] truncate text-muted">{b.quality ?? '—'}</td>
                  <td className="whitespace-nowrap">
                    <DataCheck value={dataCheck(b)} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={16} className="py-10 text-center text-muted">
                    No batches match these filters.
                  </td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={4}>Total</td>
                  <td className="num">{qty(rows.reduce((a, b) => a + b.qtyReceived, 0))}</td>
                  <td />
                  <td className="num">{qty(rows.reduce((a, b) => a + b.qtyIssued, 0))}</td>
                  <td className="num">{qty(openBalance)}</td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            )}
          </table>
        </TableWrap>

        <div className="mt-4">
          <Callout tone="info" title="Output linked & defect rate">
            Both columns are driven by production operations that name this batch as their input.
            Until operations are recorded they stay empty, and supplier quality scoring stays blank
            with them.
          </Callout>
        </div>
      </Section>
    </>
  );
}
