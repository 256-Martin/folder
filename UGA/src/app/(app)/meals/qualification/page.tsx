import { FilterBar } from '@/components/FilterBar';
import { Badge, Callout, PageHeader, Section, Stat, StatGrid, TableWrap } from '@/components/ui';
import { loadSnapshot } from '@/lib/core';
import { weeklyMealSummaries } from '@/lib/meal-engine';
import { dateLong, money, qty } from '@/lib/format';
import { monthOptions } from '@/lib/options';

export const dynamic = 'force-dynamic';

export default async function MealQualificationPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const snap = await loadSnapshot();
  const rows = weeklyMealSummaries(snap, params.month);

  const earned = rows.reduce((a, r) => a + r.finalDaysEarned, 0);
  const used = rows.reduce((a, r) => a + r.qualifiedPlates, 0);
  const expired = rows.reduce((a, r) => a + r.expiredUnusedDays, 0);

  const activeRules = snap.mealRules.filter((r) => r.active).length;

  return (
    <>
      <PageHeader
        title="Meal Qualification Summary"
        subtitle="Eating days earned from production, by worker and week. This is calculated live — there is no refresh button to forget."
        badge={<Badge tone="info">Live calculation</Badge>}
      />

      <StatGrid cols={4}>
        <Stat label="Worker-weeks" value={rows.length} />
        <Stat label="Eating days earned" value={qty(earned)} tone={earned > 0 ? 'ok' : 'warn'} />
        <Stat label="Days used" value={qty(used)} />
        <Stat label="Expired unused" value={qty(expired)} tone={expired > 0 ? 'warn' : 'neutral'} />
      </StatGrid>

      <Section className="mt-6">
        <FilterBar
          fields={[{ type: 'select', name: 'month', label: 'Month', value: params.month, options: monthOptions(snap) }]}
        />

        <TableWrap>
          <table className="data">
            <thead>
              <tr>
                <th>Worker</th>
                <th>Week</th>
                <th className="num">Daily days</th>
                <th className="num">TUFT small</th>
                <th className="num">TUFT large</th>
                <th className="num">Weekly tier days</th>
                <th className="num">Final days earned</th>
                <th className="num">Plates taken</th>
                <th className="num">Qualified</th>
                <th className="num">Unqualified</th>
                <th className="num">Worker deduction</th>
                <th className="num">Expired</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.workerId}-${r.weekStart}`}>
                  <td>{r.worker}</td>
                  <td className="whitespace-nowrap text-2xs text-muted">
                    {dateLong(r.weekStart)} → {dateLong(r.weekEnd)}
                  </td>
                  <td className="num">{qty(r.dailyDaysEarned)}</td>
                  <td className="num text-muted">{qty(r.tuftSmallWeek)}</td>
                  <td className="num text-muted">{qty(r.tuftLargeWeek)}</td>
                  <td className="num">{qty(r.tuftWeeklyDays)}</td>
                  <td className="num font-semibold">{qty(r.finalDaysEarned)}</td>
                  <td className="num">{qty(r.platesTaken)}</td>
                  <td className="num">{qty(r.qualifiedPlates)}</td>
                  <td className="num">{qty(r.unqualifiedPlates)}</td>
                  <td className="num">{money(r.totalWorkerDeduction)}</td>
                  <td className="num">{qty(r.expiredUnusedDays)}</td>
                  <td className="text-2xs text-muted">{r.status}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={13} className="py-10 text-center text-muted">
                    No worker-weeks with production or meals in this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </TableWrap>
      </Section>

      <Callout tone="info" title={`Driven by ${activeRules} active qualification rules`}>
        Daily rules award a day when a worker passes a per-process threshold (for example hand
        sanding more than 50 in a day). Weekly rules award 2–6 days from tufting volume tiers. The
        two are combined using the “{snap.mealSetting('Combine Meal Qualification Rules (Max / Add)') ?? 'Max'}”
        setting, capped at{' '}
        {snap.mealSetting('Max eating days per worker per week') ??
          snap.mealSetting('Working days per week') ??
          6}{' '}
        days per week. Unused days expire at week end. Edit the rules under Settings → Meal
        Qualification Rules.
      </Callout>
    </>
  );
}
