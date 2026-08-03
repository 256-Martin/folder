import { desc } from 'drizzle-orm';
import { db } from '@/db';
import * as s from '@/db/schema';
import { FilterBar } from '@/components/FilterBar';
import { InlineAction, RecordForm } from '@/components/RecordForm';
import { Badge, DataCheck, PageHeader, Section, Stat, StatGrid, StatusBadge, TableWrap } from '@/components/ui';
import { createDeduction } from '@/lib/actions/transactions';
import { voidEntry } from '@/lib/actions/system';
import { getSession } from '@/lib/auth';
import { deductionChecker, loadSnapshot } from '@/lib/core';
import { monthOf, today } from '@/lib/dates';
import { dateLong, money } from '@/lib/format';
import { listOptions, monthOptions, workerOptions } from '@/lib/options';

export const dynamic = 'force-dynamic';

export default async function DeductionsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; worker?: string; status?: string }>;
}) {
  const params = await searchParams;
  const user = await getSession();
  const snap = await loadSnapshot();

  const dataCheck = deductionChecker(snap);

  const all = await db.select().from(s.deduction).orderBy(desc(s.deduction.date), desc(s.deduction.id));

  const rows = all.filter((d) => {
    if (params.month && d.date.slice(0, 7) !== params.month) return false;
    if (params.worker && String(d.workerId) !== params.worker) return false;
    if (params.status && d.status !== params.status) return false;
    return true;
  });

  const live = rows.filter((r) => !r.voidedAt);
  const approved = live.filter((d) => d.status === 'Approved');
  const pending = live.filter((d) => d.status === 'Pending');

  return (
    <>
      <PageHeader
        title="Deductions"
        subtitle="Non-meal deductions and approved recoveries. Only entries marked Approved reach the Final Worker Payment calculation."
        badge={<Badge tone="brand">Entry</Badge>}
      />

      {user && user.role !== 'VIEW' && (
        <div className="mb-6">
          <RecordForm
            action={createDeduction}
            title="Record a deduction"
            submitLabel="Record deduction"
            fields={[
              { name: 'date', label: 'Date', type: 'date', required: true, defaultValue: today() },
              { name: 'workerId', label: 'Worker', type: 'select', required: true, options: workerOptions(snap) },
              {
                name: 'deductionType',
                label: 'Type',
                type: 'select',
                required: true,
                options: listOptions(snap, 'Deduction Type'),
              },
              { name: 'amount', label: 'Amount (UGX)', type: 'number', required: true, step: 'any', min: '0' },
              {
                name: 'status',
                label: 'Status',
                type: 'select',
                options: [
                  { value: 'Pending', label: 'Pending' },
                  { value: 'Approved', label: 'Approved' },
                  { value: 'Rejected', label: 'Rejected' },
                ],
                defaultValue: 'Pending',
                help: 'Only Approved deductions affect pay.',
              },
              { name: 'approvedBy', label: 'Approved by', type: 'text' },
              { name: 'reason', label: 'Reason', type: 'text', required: true, span: 3 },
              { name: 'notes', label: 'Notes', type: 'textarea', span: 6 },
            ]}
          />
        </div>
      )}

      <StatGrid cols={3}>
        <Stat label="Approved this view" value={money(approved.reduce((a, d) => a + d.amount, 0))} hint={`${approved.length} entries`} />
        <Stat label="Pending approval" value={money(pending.reduce((a, d) => a + d.amount, 0))} tone={pending.length ? 'warn' : 'neutral'} hint={`${pending.length} entries`} />
        <Stat label="Entries shown" value={live.length} />
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
              name: 'status',
              label: 'Status',
              value: params.status,
              options: [
                { value: 'Approved', label: 'Approved' },
                { value: 'Pending', label: 'Pending' },
                { value: 'Rejected', label: 'Rejected' },
              ],
            },
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
                <th>Type</th>
                <th className="num">Amount</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Approved by</th>
                <th>Notes</th>
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
                  <td>{snap.workerById.get(d.workerId)?.name ?? '—'}</td>
                  <td>{d.deductionType}</td>
                  <td className="num font-medium">{money(d.amount)}</td>
                  <td className="max-w-[18rem] truncate text-muted">{d.reason ?? '—'}</td>
                  <td>
                    <StatusBadge status={d.status} />
                  </td>
                  <td className="text-muted">{d.approvedBy ?? '—'}</td>
                  <td className="max-w-[14rem] truncate text-muted">{d.notes ?? '—'}</td>
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
                          fields={{ entity: 'deduction', id: d.id }}
                        />
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={user?.role === 'ADMIN' ? 12 : 11} className="py-10 text-center text-muted">
                    No deductions recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </TableWrap>
      </Section>
    </>
  );
}
