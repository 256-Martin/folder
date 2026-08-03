import { desc } from 'drizzle-orm';
import { db } from '@/db';
import * as s from '@/db/schema';
import { FilterBar } from '@/components/FilterBar';
import { InlineAction, RecordForm } from '@/components/RecordForm';
import { Badge, Callout, DataCheck, PageHeader, Section, Stat, StatGrid, StatusBadge, TableWrap } from '@/components/ui';
import { createMeal } from '@/lib/actions/transactions';
import { voidEntry } from '@/lib/actions/system';
import { getSession } from '@/lib/auth';
import { loadSnapshot, mealChecker } from '@/lib/core';
import { qualificationFor } from '@/lib/meal-engine';
import { monthOf, today } from '@/lib/dates';
import { dateLong, money, qty } from '@/lib/format';
import { monthOptions, supplierOptions, workerOptions, yesNoOptions } from '@/lib/options';

export const dynamic = 'force-dynamic';

export default async function MealsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; worker?: string }>;
}) {
  const params = await searchParams;
  const user = await getSession();
  const snap = await loadSnapshot();

  const dataCheck = mealChecker(snap);

  const all = await db.select().from(s.meal).orderBy(desc(s.meal.date), desc(s.meal.id));

  const rows = all.filter((m) => {
    if (params.month && m.date.slice(0, 7) !== params.month) return false;
    if (params.worker && String(m.workerId) !== params.worker) return false;
    return true;
  });

  const live = rows.filter((r) => !r.voidedAt);
  const plates = live.reduce((a, m) => a + m.plateCount, 0);
  const qualified = live.reduce((a, m) => a + m.qualifiedPlates, 0);
  const netDue = live.reduce((a, m) => a + m.netWorkerMealBalance, 0);
  const companyPaid = live.reduce((a, m) => a + m.companyContribution, 0);

  // Eating days currently available, per worker, for this week.
  const entitlements = snap.workers
    .filter((w) => w.active)
    .map((w) => ({ worker: w, q: qualificationFor(snap, w.id, today()) }));
  const anyEarned = entitlements.some((e) => e.q.finalDaysEarned > 0);

  const plateCost = snap.mealNumber('Plate cost (UGX)', 2500);

  return (
    <>
      <PageHeader
        title="Meals"
        subtitle="Plates taken by workers. Qualification is checked automatically against production — eating days are earned, capped weekly, and expire at week end."
        badge={<Badge tone="brand">Entry</Badge>}
      />

      {!anyEarned && (
        <div className="mb-5">
          <Callout tone="warn" title="No eating days have been earned this week">
            Meal qualification is driven entirely by recorded production operations. With none
            recorded, every plate is treated as unqualified and charged at the full plate cost of{' '}
            {money(plateCost)} UGX.
          </Callout>
        </div>
      )}

      {user && user.role !== 'VIEW' && (
        <div className="mb-6">
          <RecordForm
            action={createMeal}
            title="Record a meal"
            description="Plate cost and company contribution are snapshotted onto the row, so later price changes never alter past meals."
            submitLabel="Record meal"
            fields={[
              { name: 'date', label: 'Date', type: 'date', required: true, defaultValue: today() },
              { name: 'workerId', label: 'Worker', type: 'select', required: true, options: workerOptions(snap) },
              { name: 'plateCount', label: 'Plates taken', type: 'number', required: true, step: '1', min: '1', defaultValue: 1 },
              {
                name: 'workerCashPaid',
                label: 'Cash paid today (UGX)',
                type: 'number',
                step: 'any',
                min: '0',
                defaultValue: 0,
                help: 'Reduces the balance carried to payroll.',
              },
              {
                name: 'foodProviderId',
                label: 'Food provider',
                type: 'select',
                options: supplierOptions(snap, 'Food Provider'),
                defaultValue:
                  snap.suppliers.find(
                    (x) => x.name === (snap.mealSetting('Default Food Supplier') ?? ''),
                  )?.id ?? '',
              },
              {
                name: 'companyFullySponsored',
                label: 'Company fully sponsored?',
                type: 'select',
                options: yesNoOptions(),
                defaultValue: 'No',
              },
              { name: 'actualPlateCost', label: 'Actual plate cost (UGX)', type: 'number', step: 'any', help: `Default ${money(plateCost)}` },
              { name: 'approvedBy', label: 'Approved by', type: 'text' },
              { name: 'note', label: 'Note', type: 'text', span: 2 },
              { name: 'reasonForChange', label: 'Reason for any price change', type: 'text', span: 6 },
            ]}
          />
        </div>
      )}

      <StatGrid cols={4}>
        <Stat label="Plates taken" value={qty(plates)} />
        <Stat label="Qualified plates" value={qty(qualified)} tone={qualified > 0 ? 'ok' : 'warn'} />
        <Stat label="Net owed by workers" value={money(netDue)} hint="Carried to payroll" />
        <Stat label="Company contribution" value={money(companyPaid)} />
      </StatGrid>

      <Section title="Eating days available this week" className="mt-6">
        <TableWrap>
          <table className="data">
            <thead>
              <tr>
                <th>Worker</th>
                <th className="num">Daily days earned</th>
                <th className="num">TUFT small</th>
                <th className="num">TUFT large</th>
                <th className="num">Weekly tier days</th>
                <th className="num">Total earned</th>
                <th className="num">Used</th>
                <th className="num">Remaining</th>
              </tr>
            </thead>
            <tbody>
              {entitlements.map(({ worker, q }) => (
                <tr key={worker.id}>
                  <td>{worker.name}</td>
                  <td className="num">{qty(q.dailyDaysEarned)}</td>
                  <td className="num text-muted">{qty(q.tuftSmallWeek)}</td>
                  <td className="num text-muted">{qty(q.tuftLargeWeek)}</td>
                  <td className="num">{qty(q.tuftWeeklyDays)}</td>
                  <td className="num font-medium">{qty(q.finalDaysEarned)}</td>
                  <td className="num">{qty(q.daysUsed)}</td>
                  <td className={`num font-semibold ${q.daysRemaining > 0 ? 'text-ok' : 'text-muted'}`}>
                    {qty(q.daysRemaining)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Section>

      <Section title="Meal log">
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
          ]}
        />

        <TableWrap>
          <table className="data">
            <thead>
              <tr>
                <th>ID</th>
                <th>Date</th>
                <th>Month</th>
                <th>Week start</th>
                <th>Worker</th>
                <th className="num">Plates</th>
                <th>Qualified?</th>
                <th className="num">Qual.</th>
                <th className="num">Unqual.</th>
                <th className="num">Plate cost</th>
                <th className="num">Company</th>
                <th className="num">Full cost</th>
                <th className="num">Worker owes</th>
                <th className="num">Cash paid</th>
                <th className="num">Net balance</th>
                <th>Price changed</th>
                <th>Contrib. changed</th>
                <th>Reason for change</th>
                <th>Note</th>
                <th>Approved by</th>
                <th>Data check</th>
                {user?.role === 'ADMIN' && <th className="no-print" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
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
                  <td className="whitespace-nowrap font-mono text-xs text-muted">{m.weekStart ?? '—'}</td>
                  <td>{snap.workerById.get(m.workerId)?.name ?? '—'}</td>
                  <td className="num">{qty(m.plateCount)}</td>
                  <td>
                    <StatusBadge status={m.qualified} />
                  </td>
                  <td className="num">{qty(m.qualifiedPlates)}</td>
                  <td className="num">{qty(m.unqualifiedPlates)}</td>
                  <td className="num text-muted">{money(m.actualPlateCost)}</td>
                  <td className="num text-muted">{money(m.companyContribution)}</td>
                  <td className="num text-muted">{money(m.fullCostDeduction)}</td>
                  <td className="num">{money(m.totalWorkerDeduction)}</td>
                  <td className="num text-muted">{money(m.workerCashPaid)}</td>
                  <td className="num font-semibold">{money(m.netWorkerMealBalance)}</td>
                  <td className="text-muted">{m.supplierPriceChanged ?? '—'}</td>
                  <td className="text-muted">{m.contributionChanged ?? '—'}</td>
                  <td className="max-w-[12rem] truncate text-muted">{m.reasonForChange ?? '—'}</td>
                  <td className="max-w-[12rem] truncate text-muted">{m.note ?? '—'}</td>
                  <td className="text-muted">{m.approvedBy ?? '—'}</td>
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
                          fields={{ entity: 'meal', id: m.id }}
                        />
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={user?.role === 'ADMIN' ? 22 : 21} className="py-10 text-center text-muted">
                    No meals match these filters.
                  </td>
                </tr>
              )}
            </tbody>
            {live.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={5}>Total ({live.length})</td>
                  <td className="num">{qty(plates)}</td>
                  <td />
                  <td className="num">{qty(qualified)}</td>
                  <td className="num">{qty(live.reduce((a, m) => a + m.unqualifiedPlates, 0))}</td>
                  <td />
                  <td className="num">{money(companyPaid)}</td>
                  <td className="num">{money(live.reduce((a, m) => a + m.fullCostDeduction, 0))}</td>
                  <td className="num">{money(live.reduce((a, m) => a + m.totalWorkerDeduction, 0))}</td>
                  <td className="num">{money(live.reduce((a, m) => a + m.workerCashPaid, 0))}</td>
                  <td className="num">{money(netDue)}</td>
                  <td colSpan={user?.role === 'ADMIN' ? 7 : 6} />
                </tr>
              </tfoot>
            )}
          </table>
        </TableWrap>
      </Section>
    </>
  );
}
