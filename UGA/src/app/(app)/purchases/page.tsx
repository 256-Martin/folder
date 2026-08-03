import { FilterBar } from '@/components/FilterBar';
import { InlineAction, RecordForm } from '@/components/RecordForm';
import { Badge, DataCheck, PageHeader, Section, Stat, StatGrid, TableWrap } from '@/components/ui';
import { createPurchase } from '@/lib/actions/transactions';
import { voidEntry } from '@/lib/actions/system';
import { getSession } from '@/lib/auth';
import { loadSnapshot, purchaseChecker } from '@/lib/core';
import { monthOf, today } from '@/lib/dates';
import { dateLong, money, qty } from '@/lib/format';
import { itemOptions, monthOptions, supplierOptions } from '@/lib/options';
import { db } from '@/db';
import * as s from '@/db/schema';
import { desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; supplier?: string; item?: string; q?: string }>;
}) {
  const params = await searchParams;
  const user = await getSession();
  const snap = await loadSnapshot();

  const dataCheck = purchaseChecker(snap);

  const all = await db.select().from(s.purchase).orderBy(desc(s.purchase.date), desc(s.purchase.id));

  const rows = all.filter((p) => {
    if (params.month && p.date.slice(0, 7) !== params.month) return false;
    if (params.supplier && String(p.supplierId) !== params.supplier) return false;
    if (params.item && String(p.itemId) !== params.item) return false;
    if (params.q) {
      const hay = `${p.code} ${p.batchNo ?? ''} ${p.qualityNotes ?? ''}`.toLowerCase();
      if (!hay.includes(params.q.toLowerCase())) return false;
    }
    return true;
  });

  const live = rows.filter((r) => !r.voidedAt);
  const spend = live.reduce((a, p) => a + p.totalCost, 0);
  const units = live.reduce((a, p) => a + p.qty, 0);

  return (
    <>
      <PageHeader
        title="Purchases"
        subtitle="Every purchase, for any item. Saving here also writes the Batch Register row and the Inventory Ledger receipt — all three in one transaction."
        badge={<Badge tone="brand">Entry</Badge>}
      />

      {user && user.role !== 'VIEW' && (
        <div className="mb-6">
          <RecordForm
            action={createPurchase}
            title="Record a purchase"
            description="Leave the batch number blank and the system generates ITEMCODE-ddmmyy-NN for you."
            submitLabel="Record purchase"
            fields={[
              { name: 'date', label: 'Date', type: 'date', required: true, defaultValue: today() },
              {
                name: 'supplierId',
                label: 'Supplier',
                type: 'select',
                required: true,
                options: supplierOptions(snap),
              },
              {
                name: 'itemId',
                label: 'Item',
                type: 'select',
                required: true,
                options: itemOptions(snap),
              },
              { name: 'qty', label: 'Quantity', type: 'number', required: true, step: 'any', min: '0' },
              {
                name: 'totalCost',
                label: 'Total cost (UGX)',
                type: 'number',
                required: true,
                step: 'any',
                min: '0',
                help: 'Unit cost is calculated automatically.',
              },
              {
                name: 'batchNo',
                label: 'Batch number',
                type: 'text',
                placeholder: 'auto',
                help: 'Only for batch-tracked items.',
              },
              { name: 'qualityNotes', label: 'Quality notes', type: 'textarea', span: 6 },
            ]}
          />
        </div>
      )}

      <StatGrid cols={3}>
        <Stat label="Entries shown" value={live.length} />
        <Stat label="Quantity purchased" value={qty(units)} />
        <Stat label="Total spend" value={money(spend)} hint="UGX" />
      </StatGrid>

      <Section className="mt-6">
        <FilterBar
          fields={[
            { type: 'select', name: 'month', label: 'Month', value: params.month, options: monthOptions(snap) },
            {
              type: 'select',
              name: 'supplier',
              label: 'Supplier',
              value: params.supplier,
              options: snap.suppliers.map((x) => ({ value: String(x.id), label: x.name })),
            },
            {
              type: 'select',
              name: 'item',
              label: 'Item',
              value: params.item,
              options: snap.items.map((x) => ({ value: String(x.id), label: x.code })),
            },
            { type: 'search', name: 'q', label: 'Search', value: params.q, placeholder: 'ID, batch, notes' },
          ]}
        />

        <TableWrap>
          <table className="data">
            <thead>
              <tr>
                <th>ID</th>
                <th>Date</th>
                <th>Month</th>
                <th>Supplier</th>
                <th>Item</th>
                <th>Item name</th>
                <th>UoM</th>
                <th>Batch</th>
                <th className="num">Qty</th>
                <th className="num">Total cost</th>
                <th className="num">Unit cost</th>
                <th>Quality notes</th>
                <th>Data check</th>
                {user?.role === 'ADMIN' && <th className="no-print" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const item = snap.itemById.get(p.itemId);
                const supplier = snap.supplierById.get(p.supplierId);
                return (
                  <tr key={p.id} className={p.voidedAt ? 'opacity-45' : undefined}>
                    <td className="whitespace-nowrap font-mono text-xs">
                      {p.code}
                      {p.voidedAt && (
                        <Badge tone="danger" className="ml-1.5">
                          Void
                        </Badge>
                      )}
                    </td>
                    <td className="whitespace-nowrap">{dateLong(p.date)}</td>
                    <td className="whitespace-nowrap font-mono text-xs text-muted">{monthOf(p.date)}</td>
                    <td>{supplier?.name ?? '—'}</td>
                    <td className="font-medium">{item?.code ?? '—'}</td>
                    <td className="text-muted">{item?.name ?? '—'}</td>
                    <td className="text-muted">{item?.baseUom ?? '—'}</td>
                    <td className="whitespace-nowrap font-mono text-xs">{p.batchNo ?? '—'}</td>
                    <td className="num">{qty(p.qty)}</td>
                    <td className="num">{money(p.totalCost)}</td>
                    <td className="num text-muted">{money(p.totalCost / (p.qty || 1), { decimals: 2 })}</td>
                    <td className="max-w-[16rem] truncate text-muted">{p.qualityNotes ?? '—'}</td>
                    <td className="whitespace-nowrap">
                      <DataCheck value={dataCheck(p)} />
                    </td>
                    {user?.role === 'ADMIN' && (
                      <td className="no-print">
                        {!p.voidedAt && (
                          <InlineAction
                            action={voidEntry}
                            label="Void"
                            confirm="Reason for void"
                            variant="danger"
                            icon="trash"
                            fields={{ entity: 'purchase', id: p.id }}
                          />
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={user?.role === 'ADMIN' ? 14 : 13} className="py-10 text-center text-muted">
                    No purchases match these filters.
                  </td>
                </tr>
              )}
            </tbody>
            {live.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={8}>Total ({live.length} live entries)</td>
                  <td className="num">{qty(units)}</td>
                  <td className="num">{money(spend)}</td>
                  <td colSpan={user?.role === 'ADMIN' ? 4 : 3} />
                </tr>
              </tfoot>
            )}
          </table>
        </TableWrap>
      </Section>
    </>
  );
}
