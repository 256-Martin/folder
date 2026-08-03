import { desc } from 'drizzle-orm';
import { db } from '@/db';
import * as s from '@/db/schema';
import { FilterBar } from '@/components/FilterBar';
import { InlineAction, RecordForm } from '@/components/RecordForm';
import { Badge, Callout, DataCheck, PageHeader, Section, Stat, StatGrid, TableWrap } from '@/components/ui';
import { createOperation } from '@/lib/actions/transactions';
import { voidEntry } from '@/lib/actions/system';
import { getSession } from '@/lib/auth';
import { loadSnapshot, operationChecker } from '@/lib/core';
import { monthOf, today } from '@/lib/dates';
import { dateLong, money, percent, qty } from '@/lib/format';
import { batchOptions, itemOptions, listOptions, monthOptions, processOptions, workerOptions } from '@/lib/options';

export const dynamic = 'force-dynamic';

export default async function ProductionPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; worker?: string; process?: string; q?: string }>;
}) {
  const params = await searchParams;
  const user = await getSession();
  const snap = await loadSnapshot();

  const dataCheck = operationChecker(snap);

  const all = await db
    .select()
    .from(s.productionOperation)
    .orderBy(desc(s.productionOperation.date), desc(s.productionOperation.id));

  const rows = all.filter((o) => {
    if (params.month && o.date.slice(0, 7) !== params.month) return false;
    if (params.worker && String(o.workerId) !== params.worker) return false;
    if (params.process && String(o.processId) !== params.process) return false;
    if (params.q) {
      const hay = `${o.code} ${o.inputBatch ?? ''} ${o.outputBatch ?? ''} ${o.notes ?? ''}`.toLowerCase();
      if (!hay.includes(params.q.toLowerCase())) return false;
    }
    return true;
  });

  const live = rows.filter((r) => !r.voidedAt);
  const accepted = live.reduce((a, o) => a + o.acceptedQty, 0);
  const rejected = live.reduce((a, o) => a + o.rejectedQty, 0);
  const cost = live.reduce((a, o) => a + o.directLabourCost, 0);

  const missingRates = snap.rates.filter((r) => r.active && r.ratePerUnit === null);
  const blocksEntry = (snap.setting('Allow operation without piece rate') ?? 'No').toLowerCase() === 'no';

  return (
    <>
      <PageHeader
        title="Production Operations"
        subtitle="The heart of the system: one row per worker per operation. Drives direct labour, WIP and meal qualification."
        badge={<Badge tone="brand">Entry</Badge>}
      />

      {missingRates.length > 0 && (
        <div className="mb-5">
          <Callout tone={blocksEntry ? 'danger' : 'warn'} title={`${missingRates.length} piece rates are still TO CONFIRM`}>
            {blocksEntry ? (
              <>
                Operations for these process × product combinations <strong>cannot be recorded</strong>{' '}
                while their rate is blank, because Settings has “Allow operation without piece rate”
                set to No. Set the rates under Master&nbsp;Data → Piece&nbsp;Rates, or change that
                setting.
              </>
            ) : (
              <>
                Operations for these combinations will be recorded with a zero labour cost. Set the
                rates under Master&nbsp;Data → Piece&nbsp;Rates.
              </>
            )}
          </Callout>
        </div>
      )}

      {user && user.role !== 'VIEW' && (
        <div className="mb-6">
          <RecordForm
            action={createOperation}
            title="Record an operation"
            description="The piece rate in force on the operation date is applied and stored on the row, so later rate changes never rewrite history."
            submitLabel="Record operation"
            fields={[
              { name: 'date', label: 'Date', type: 'date', required: true, defaultValue: today() },
              { name: 'workerId', label: 'Worker', type: 'select', required: true, options: workerOptions(snap) },
              { name: 'processId', label: 'Process', type: 'select', required: true, options: processOptions(snap) },
              {
                name: 'productItemId',
                label: 'Product / handle',
                type: 'select',
                required: true,
                options: itemOptions(snap, (cat) => cat !== 'Consumable'),
                help: 'Handle stages use HDL-S / HDL-L; brush stages use BR-S / BR-L / BR-CUSTOM.',
              },
              { name: 'acceptedQty', label: 'Accepted qty', type: 'number', step: 'any', min: '0', defaultValue: 0 },
              { name: 'rejectedQty', label: 'Rejected qty', type: 'number', step: 'any', min: '0', defaultValue: 0 },
              {
                name: 'rejectReason',
                label: 'Reject reason',
                type: 'select',
                options: listOptions(snap, 'Reject Reason'),
                help: 'Required when rejected quantity is above zero.',
              },
              { name: 'inputBatch', label: 'Input batch', type: 'select', options: batchOptions(snap) },
              { name: 'outputBatch', label: 'Output batch', type: 'text' },
              { name: 'notes', label: 'Notes', type: 'textarea', span: 6 },
            ]}
          />
        </div>
      )}

      <StatGrid cols={4}>
        <Stat label="Operations shown" value={live.length} />
        <Stat label="Accepted" value={qty(accepted)} tone="ok" />
        <Stat
          label="Rejected"
          value={qty(rejected)}
          hint={accepted + rejected > 0 ? percent(rejected / (accepted + rejected)) : undefined}
          tone={rejected > 0 ? 'warn' : 'neutral'}
        />
        <Stat label="Direct labour cost" value={money(cost)} hint="UGX" />
      </StatGrid>

      <Section className="mt-6">
        <FilterBar
          fields={[
            { type: 'select', name: 'month', label: 'Month', value: params.month, options: monthOptions(snap) },
            {
              type: 'select',
              name: 'worker',
              label: 'Worker',
              value: params.worker,
              options: snap.workers.map((w) => ({ value: String(w.id), label: w.name })),
            },
            {
              type: 'select',
              name: 'process',
              label: 'Process',
              value: params.process,
              options: processOptions(snap).map((p) => ({ value: p.value, label: p.label })),
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
                <th>Worker</th>
                <th>Process</th>
                <th>Product</th>
                <th>Product name</th>
                <th>UoM</th>
                <th>Input batch</th>
                <th>Output batch</th>
                <th className="num">Accepted</th>
                <th className="num">Rejected</th>
                <th>Reject reason</th>
                <th className="num">Rate</th>
                <th className="num">Labour cost</th>
                <th>WIP stage</th>
                <th>Notes</th>
                <th>Data check</th>
                {user?.role === 'ADMIN' && <th className="no-print" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id} className={o.voidedAt ? 'opacity-45' : undefined}>
                  <td className="whitespace-nowrap font-mono text-xs">
                    {o.code}
                    {o.voidedAt && (
                      <Badge tone="danger" className="ml-1.5">
                        Void
                      </Badge>
                    )}
                  </td>
                  <td className="whitespace-nowrap">{dateLong(o.date)}</td>
                  <td className="whitespace-nowrap font-mono text-xs text-muted">{monthOf(o.date)}</td>
                  <td>{snap.workerById.get(o.workerId)?.name ?? '—'}</td>
                  <td>{snap.processById.get(o.processId)?.code ?? '—'}</td>
                  <td>{snap.itemById.get(o.productItemId)?.code ?? '—'}</td>
                  <td className="text-muted">{snap.itemById.get(o.productItemId)?.name ?? '—'}</td>
                  <td className="text-muted">{snap.itemById.get(o.productItemId)?.baseUom ?? '—'}</td>
                  <td className="whitespace-nowrap font-mono text-xs">{o.inputBatch ?? '—'}</td>
                  <td className="whitespace-nowrap font-mono text-xs">{o.outputBatch ?? '—'}</td>
                  <td className="num">{qty(o.acceptedQty)}</td>
                  <td className="num">{o.rejectedQty ? qty(o.rejectedQty) : '—'}</td>
                  <td className="text-muted">{o.rejectReason ?? '—'}</td>
                  <td className="num text-muted">{money(o.pieceRateApplied)}</td>
                  <td className="num font-medium">{money(o.directLabourCost)}</td>
                  <td className="text-muted">{o.wipStage ?? '—'}</td>
                  <td className="max-w-[14rem] truncate text-muted">{o.notes ?? '—'}</td>
                  <td className="whitespace-nowrap">
                    <DataCheck value={dataCheck(o)} />
                  </td>
                  {user?.role === 'ADMIN' && (
                    <td className="no-print">
                      {!o.voidedAt && (
                        <InlineAction
                          action={voidEntry}
                          label="Void"
                          confirm="Reason for void"
                          variant="danger"
                          icon="trash"
                          fields={{ entity: 'operation', id: o.id }}
                        />
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={user?.role === 'ADMIN' ? 19 : 18} className="py-12 text-center">
                    <div className="text-sm font-medium text-ink">No operations recorded</div>
                    <p className="mx-auto mt-1 max-w-md text-sm text-muted">
                      Until operations are recorded, direct labour, WIP and meal qualification all
                      read zero — those figures are derived entirely from this log.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
            {live.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={5}>Total ({live.length})</td>
                  <td className="num">{qty(accepted)}</td>
                  <td className="num">{qty(rejected)}</td>
                  <td colSpan={2} />
                  <td className="num">{money(cost)}</td>
                  <td colSpan={user?.role === 'ADMIN' ? 2 : 1} />
                </tr>
              </tfoot>
            )}
          </table>
        </TableWrap>
      </Section>
    </>
  );
}
