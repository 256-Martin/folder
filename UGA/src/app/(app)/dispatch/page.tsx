import { desc } from 'drizzle-orm';
import { db } from '@/db';
import * as s from '@/db/schema';
import { FilterBar } from '@/components/FilterBar';
import { InlineAction, RecordForm } from '@/components/RecordForm';
import { Badge, DataCheck, PageHeader, Section, Stat, StatGrid, TableWrap } from '@/components/ui';
import { createDispatch } from '@/lib/actions/transactions';
import { voidEntry } from '@/lib/actions/system';
import { getSession } from '@/lib/auth';
import { dispatchChecker, finishedGoods, loadSnapshot } from '@/lib/core';
import { monthOf, today } from '@/lib/dates';
import { dateLong, money, qty } from '@/lib/format';
import { itemOptions, listOptions, monthOptions } from '@/lib/options';

export const dynamic = 'force-dynamic';

export default async function DispatchPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; product?: string; q?: string }>;
}) {
  const params = await searchParams;
  const user = await getSession();
  const snap = await loadSnapshot();

  const dataCheck = dispatchChecker(snap);

  const all = await db.select().from(s.dispatch).orderBy(desc(s.dispatch.date), desc(s.dispatch.id));

  const rows = all.filter((d) => {
    if (params.month && d.date.slice(0, 7) !== params.month) return false;
    if (params.product && String(d.productItemId) !== params.product) return false;
    if (params.q) {
      const hay = `${d.code} ${d.destinationName} ${d.salesOrderNo ?? ''} ${d.deliveryNoteNo ?? ''}`.toLowerCase();
      if (!hay.includes(params.q.toLowerCase())) return false;
    }
    return true;
  });

  const live = rows.filter((r) => !r.voidedAt);
  const units = live.reduce((a, d) => a + d.qty, 0);
  const value = live.reduce((a, d) => a + d.qty * (d.unitPrice ?? 0), 0);
  const fg = finishedGoods(snap);

  return (
    <>
      <PageHeader
        title="Sales & Dispatch"
        subtitle="Finished goods leaving the factory. Recording a dispatch also writes the matching Inventory Ledger movement."
        badge={<Badge tone="brand">Entry</Badge>}
      />

      {user && user.role !== 'VIEW' && (
        <div className="mb-6">
          <RecordForm
            action={createDispatch}
            title="Record a dispatch"
            submitLabel="Record dispatch"
            fields={[
              { name: 'date', label: 'Date', type: 'date', required: true, defaultValue: today() },
              {
                name: 'productItemId',
                label: 'Product',
                type: 'select',
                required: true,
                options: itemOptions(snap, (cat) => cat === 'Finished Good'),
              },
              { name: 'qty', label: 'Quantity', type: 'number', required: true, step: 'any', min: '0' },
              { name: 'unitPrice', label: 'Unit price (UGX)', type: 'number', step: 'any', min: '0' },
              { name: 'destinationName', label: 'Dispatch to', type: 'text', required: true },
              {
                name: 'destinationType',
                label: 'Destination type',
                type: 'select',
                options: listOptions(snap, 'Dispatch Destination Type'),
              },
              { name: 'personResponsible', label: 'Received by', type: 'text' },
              { name: 'deliveryNoteNo', label: 'Delivery note no.', type: 'text' },
              { name: 'salesOrderNo', label: 'Sales order ref', type: 'text' },
              { name: 'note', label: 'Note', type: 'textarea', span: 6 },
            ]}
          />
        </div>
      )}

      <StatGrid cols={4}>
        <Stat label="Dispatches shown" value={live.length} />
        <Stat label="Units dispatched" value={qty(units)} />
        <Stat label="Dispatch value" value={money(value)} hint="UGX" />
        <Stat
          label="Finished goods on hand"
          value={qty(fg.reduce((a, f) => a + f.inStock, 0))}
          href="/stock/finished"
        />
      </StatGrid>

      <Section className="mt-6">
        <FilterBar
          fields={[
            { type: 'select', name: 'month', label: 'Month', value: params.month, options: monthOptions(snap) },
            {
              type: 'select',
              name: 'product',
              label: 'Product',
              value: params.product,
              options: snap.items
                .filter((i) => i.category === 'Finished Good')
                .map((i) => ({ value: String(i.id), label: i.code })),
            },
            { type: 'search', name: 'q', label: 'Search', value: params.q, placeholder: 'ID, customer, order ref' },
          ]}
        />

        <TableWrap>
          <table className="data">
            <thead>
              <tr>
                <th>ID</th>
                <th>Date</th>
                <th>Month</th>
                <th>Dispatch to</th>
                <th>Type</th>
                <th>Product</th>
                <th>Product name</th>
                <th>UoM</th>
                <th className="num">Qty</th>
                <th className="num">Unit price</th>
                <th className="num">Value</th>
                <th>Received by</th>
                <th>Refs</th>
                <th>Note</th>
                <th>Data check</th>
                {user?.role === 'ADMIN' && <th className="no-print" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id} className={d.voidedAt ? 'opacity-45' : undefined}>
                  <td className="whitespace-nowrap font-mono text-xs">
                    {d.code}
                    {d.voidedAt && (
                      <Badge tone="danger" className="ml-1.5">
                        Void
                      </Badge>
                    )}
                  </td>
                  <td className="whitespace-nowrap">{dateLong(d.date)}</td>
                  <td className="whitespace-nowrap font-mono text-xs text-muted">{monthOf(d.date)}</td>
                  <td className="max-w-[14rem] truncate">{d.destinationName}</td>
                  <td className="text-muted">{d.destinationType ?? '—'}</td>
                  <td>{snap.itemById.get(d.productItemId)?.code ?? '—'}</td>
                  <td className="text-muted">{snap.itemById.get(d.productItemId)?.name ?? '—'}</td>
                  <td className="text-muted">{snap.itemById.get(d.productItemId)?.baseUom ?? '—'}</td>
                  <td className="num">{qty(d.qty)}</td>
                  <td className="num">{money(d.unitPrice)}</td>
                  <td className="num font-medium">{money(d.qty * (d.unitPrice ?? 0))}</td>
                  <td className="text-muted">{d.personResponsible ?? '—'}</td>
                  <td className="text-2xs text-muted">
                    {[d.deliveryNoteNo && `DN ${d.deliveryNoteNo}`, d.salesOrderNo && `SO ${d.salesOrderNo}`]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </td>
                  <td className="max-w-[14rem] truncate text-muted">{d.note ?? '—'}</td>
                  <td className="whitespace-nowrap">
                    <DataCheck value={dataCheck(d)} />
                  </td>
                  {user?.role === 'ADMIN' && (
                    <td className="no-print">
                      {!d.voidedAt && (
                        <InlineAction
                          action={voidEntry}
                          label="Void"
                          confirm="Reason for void"
                          variant="danger"
                          icon="trash"
                          fields={{ entity: 'dispatch', id: d.id }}
                        />
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={user?.role === 'ADMIN' ? 16 : 15} className="py-10 text-center text-muted">
                    No dispatches match these filters.
                  </td>
                </tr>
              )}
            </tbody>
            {live.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={8}>Total ({live.length})</td>
                  <td className="num">{qty(units)}</td>
                  <td />
                  <td className="num">{money(value)}</td>
                  <td colSpan={user?.role === 'ADMIN' ? 5 : 4} />
                </tr>
              </tfoot>
            )}
          </table>
        </TableWrap>
      </Section>
    </>
  );
}
