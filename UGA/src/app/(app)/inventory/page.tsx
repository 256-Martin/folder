import { desc } from 'drizzle-orm';
import { db } from '@/db';
import * as s from '@/db/schema';
import { FilterBar } from '@/components/FilterBar';
import { InlineAction, RecordForm } from '@/components/RecordForm';
import { Badge, Callout, DataCheck, PageHeader, Section, Stat, StatGrid, TableWrap } from '@/components/ui';
import { createMovement } from '@/lib/actions/transactions';
import { voidEntry } from '@/lib/actions/system';
import { getSession } from '@/lib/auth';
import { signOf } from '@/lib/constants';
import { loadSnapshot, movementChecker } from '@/lib/core';
import { monthOf, today } from '@/lib/dates';
import { dateLong, money, qty } from '@/lib/format';
import { batchOptions, itemOptions, listOptions, monthOptions } from '@/lib/options';

export const dynamic = 'force-dynamic';

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; item?: string; type?: string; q?: string }>;
}) {
  const params = await searchParams;
  const user = await getSession();
  const snap = await loadSnapshot();

  const dataCheck = movementChecker(snap);

  const all = await db
    .select()
    .from(s.inventoryMovement)
    .orderBy(desc(s.inventoryMovement.date), desc(s.inventoryMovement.id));

  const rows = all.filter((m) => {
    if (params.month && m.date.slice(0, 7) !== params.month) return false;
    if (params.item && String(m.itemId) !== params.item) return false;
    if (params.type && m.movementType !== params.type) return false;
    if (params.q) {
      const hay = `${m.code} ${m.batchNo ?? ''} ${m.note ?? ''} ${m.refSource ?? ''}`.toLowerCase();
      if (!hay.includes(params.q.toLowerCase())) return false;
    }
    return true;
  });

  const live = rows.filter((r) => !r.voidedAt);
  const inQty = live
    .filter((m) => signOf(m.movementType, snap.movementSigns) > 0)
    .reduce((a, m) => a + m.qty, 0);
  const outQty = live
    .filter((m) => signOf(m.movementType, snap.movementSigns) < 0)
    .reduce((a, m) => a + m.qty, 0);

  return (
    <>
      <PageHeader
        title="Inventory Ledger"
        subtitle="The single source of truth for stock. One row per movement — every balance in the system is the signed sum of these rows, never a typed figure."
        badge={<Badge tone="brand">Entry</Badge>}
      />

      {user && user.role !== 'VIEW' && (
        <div className="mb-6">
          <RecordForm
            action={createMovement}
            title="Record a stock movement"
            description="Receipts are normally created by the Purchases page. Use this for issues to production, returns and adjustments."
            submitLabel="Record movement"
            fields={[
              { name: 'date', label: 'Date', type: 'date', required: true, defaultValue: today() },
              { name: 'itemId', label: 'Item', type: 'select', required: true, options: itemOptions(snap) },
              {
                name: 'movementType',
                label: 'Movement type',
                type: 'select',
                required: true,
                options: listOptions(snap, 'Movement Type'),
                help: 'Issues and dispatches reduce stock.',
              },
              { name: 'qty', label: 'Quantity', type: 'number', required: true, step: 'any' },
              {
                name: 'batchNo',
                label: 'Batch',
                type: 'select',
                options: batchOptions(snap),
                help: 'Required when issuing a batch-tracked item.',
              },
              { name: 'unitCost', label: 'Unit cost (UGX)', type: 'number', step: 'any' },
              {
                name: 'issuedToType',
                label: 'Issued to (type)',
                type: 'select',
                options: listOptions(snap, 'Issued To Type'),
              },
              { name: 'issuedTo', label: 'Issued to / received by', type: 'text' },
              { name: 'receivedBy', label: 'Confirmed by', type: 'text' },
              { name: 'note', label: 'Note', type: 'textarea', span: 6 },
            ]}
          />
        </div>
      )}

      <StatGrid cols={3}>
        <Stat label="Movements shown" value={live.length} />
        <Stat label="Quantity in" value={qty(inQty)} tone="ok" />
        <Stat label="Quantity out" value={qty(outQty)} tone="warn" />
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
              options: snap.items.map((x) => ({ value: String(x.id), label: x.code })),
            },
            {
              type: 'select',
              name: 'type',
              label: 'Movement type',
              value: params.type,
              options: listOptions(snap, 'Movement Type').map((o) => ({ value: o.value, label: o.label })),
            },
            { type: 'search', name: 'q', label: 'Search', value: params.q, placeholder: 'ID, batch, note' },
          ]}
        />

        <TableWrap>
          <table className="data">
            <thead>
              <tr>
                <th>ID</th>
                <th>Date</th>
                <th>Month</th>
                <th>Item</th>
                <th>Item name</th>
                <th>UoM</th>
                <th>Batch</th>
                <th>Type</th>
                <th className="num">Qty</th>
                <th className="num">Signed</th>
                <th className="num">Value</th>
                <th>Reference</th>
                <th>Issued to</th>
                <th>By</th>
                <th>Note</th>
                <th>Data check</th>
                {user?.role === 'ADMIN' && <th className="no-print" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => {
                const item = snap.itemById.get(m.itemId);
                const sign = signOf(m.movementType, snap.movementSigns);
                const signed = m.qty * sign;
                return (
                  <tr key={m.id} className={m.voidedAt ? 'opacity-45' : undefined}>
                    <td className="whitespace-nowrap font-mono text-xs">
                      {m.code}
                      {m.voidedAt && (
                        <Badge tone="danger" className="ml-1.5">
                          Void
                        </Badge>
                      )}
                    </td>
                    <td className="whitespace-nowrap">{dateLong(m.date)}</td>
                    <td className="whitespace-nowrap font-mono text-xs text-muted">{monthOf(m.date)}</td>
                    <td className="font-medium">{item?.code ?? '—'}</td>
                    <td className="text-muted">{item?.name ?? '—'}</td>
                    <td className="text-muted">{item?.baseUom ?? '—'}</td>
                    <td className="whitespace-nowrap font-mono text-xs">{m.batchNo ?? '—'}</td>
                    <td>
                      <Badge tone={sign > 0 ? 'ok' : 'warn'}>{m.movementType}</Badge>
                    </td>
                    <td className="num">{qty(m.qty)}</td>
                    <td className={`num font-medium ${signed < 0 ? 'text-warn' : 'text-ok'}`}>
                      {signed > 0 ? '+' : ''}
                      {qty(signed)}
                    </td>
                    <td className="num text-muted">
                      {m.unitCost !== null ? money(signed * m.unitCost) : '—'}
                    </td>
                    <td className="text-muted">{m.refSource ?? '—'}</td>
                    <td className="text-muted">{m.issuedTo ?? '—'}</td>
                    <td className="text-muted">{m.byName ?? '—'}</td>
                    <td className="max-w-[14rem] truncate text-muted">{m.note ?? '—'}</td>
                    <td className="whitespace-nowrap">
                      <DataCheck value={dataCheck(m)} />
                    </td>
                    {user?.role === 'ADMIN' && (
                      <td className="no-print">
                        {!m.voidedAt && (
                          <InlineAction
                            action={voidEntry}
                            label="Void"
                            confirm="Reason for void"
                            variant="danger"
                            icon="trash"
                            fields={{ entity: 'movement', id: m.id }}
                          />
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={user?.role === 'ADMIN' ? 17 : 16} className="py-10 text-center text-muted">
                    No movements match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </TableWrap>

        <div className="mt-4">
          <Callout tone="info" title="How balances are derived">
            Each movement type carries a sign from the Lists tab: Receipt, Produced, Return and
            Adjustment add to stock; Issue to production and Dispatch subtract. Change a sign under
            Settings → Lists and every summary recalculates.
          </Callout>
        </div>
      </Section>
    </>
  );
}
