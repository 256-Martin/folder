import { FilterBar } from '@/components/FilterBar';
import { Badge, Callout, PageHeader, Section, Stat, StatGrid, TableWrap } from '@/components/ui';
import { loadSnapshot, mealDeductions } from '@/lib/core';
import { money, qty } from '@/lib/format';
import { monthOptions } from '@/lib/options';

export const dynamic = 'force-dynamic';

export default async function MealDeductionsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const snap = await loadSnapshot();
  const month = params.month ?? snap.month;
  const rows = mealDeductions(snap, month);

  const t = {
    qualified: rows.reduce((a, r) => a + r.qualifiedPlates, 0),
    unqualified: rows.reduce((a, r) => a + r.unqualifiedPlates, 0),
    company: rows.reduce((a, r) => a + r.companyContribution, 0),
    topUp: rows.reduce((a, r) => a + r.workerTopUp, 0),
    fullCost: rows.reduce((a, r) => a + r.fullCostDeductions, 0),
    cash: rows.reduce((a, r) => a + r.workerCashPaid, 0),
    net: rows.reduce((a, r) => a + r.netMealDeduction, 0),
  };

  return (
    <>
      <PageHeader
        title="Meal Deductions Summary"
        subtitle={`Per worker for ${month}. The net figure is what carries into Final Worker Payment.`}
        badge={<Badge tone="info">View only</Badge>}
      />

      <StatGrid cols={4}>
        <Stat label="Qualified plates" value={qty(t.qualified)} tone={t.qualified > 0 ? 'ok' : 'warn'} />
        <Stat label="Unqualified plates" value={qty(t.unqualified)} />
        <Stat label="Company contribution" value={money(t.company)} />
        <Stat label="Net owed by workers" value={money(t.net)} tone={t.net > 0 ? 'warn' : 'ok'} />
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
                <th className="num">Qualified plates</th>
                <th className="num">Unqualified plates</th>
                <th className="num">Company contribution</th>
                <th className="num">Worker top-up</th>
                <th className="num">Full-cost deductions</th>
                <th className="num">Cash paid</th>
                <th className="num">Net meal deduction</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.workerId}>
                  <td>{r.worker}</td>
                  <td className="num">{qty(r.qualifiedPlates)}</td>
                  <td className="num">{qty(r.unqualifiedPlates)}</td>
                  <td className="num text-muted">{money(r.companyContribution)}</td>
                  <td className="num">{money(r.workerTopUp)}</td>
                  <td className="num">{money(r.fullCostDeductions)}</td>
                  <td className="num text-muted">{money(r.workerCashPaid)}</td>
                  <td className="num font-semibold">{money(r.netMealDeduction)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td className="num">{qty(t.qualified)}</td>
                <td className="num">{qty(t.unqualified)}</td>
                <td className="num">{money(t.company)}</td>
                <td className="num">{money(t.topUp)}</td>
                <td className="num">{money(t.fullCost)}</td>
                <td className="num">{money(t.cash)}</td>
                <td className="num">{money(t.net)}</td>
              </tr>
            </tfoot>
          </table>
        </TableWrap>
      </Section>

      <Callout tone="info" title="How the net figure is derived">
        Net meal deduction is <strong>total worker deduction less cash already paid</strong>, floored
        at zero. Total worker deduction is the worker&rsquo;s top-up on qualified plates plus the
        full plate cost on unqualified ones. See DEVIATIONS.md — the spreadsheet used a flat
        per-plate cap here, which under-recovered whenever a worker took more than one unqualified
        plate.
      </Callout>
    </>
  );
}
