import { BarList } from '@/components/charts';
import { Badge, Callout, Card, PageHeader, Section, Stat, StatGrid, TableWrap } from '@/components/ui';
import { loadSnapshot, supplierScorecard } from '@/lib/core';
import { money, percent, qty } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function ScorecardPage() {
  const snap = await loadSnapshot();
  const rows = supplierScorecard(snap).sort((a, b) => b.totalCost - a.totalCost);

  const spend = rows.reduce((a, r) => a + r.totalCost, 0);
  const openBalance = rows.reduce((a, r) => a + r.openBatchBalance, 0);
  const withQuality = rows.filter((r) => r.avgDefectRate !== null).length;

  return (
    <>
      <PageHeader
        title="Supplier & Batch Scorecard"
        subtitle="Purchases, cost and quality per supplier. Defect rate comes from production operations that name a supplier's batch as their input."
        badge={<Badge tone="info">View only</Badge>}
      />

      <StatGrid cols={4}>
        <Stat label="Suppliers" value={rows.length} />
        <Stat label="Total spend" value={money(spend)} hint="UGX, all time" />
        <Stat label="Open batch balance" value={qty(openBalance)} hint="Received less issued" />
        <Stat
          label="Suppliers with quality data"
          value={`${withQuality} / ${rows.length}`}
          tone={withQuality === 0 ? 'warn' : 'neutral'}
        />
      </StatGrid>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Section title="Per supplier" className="lg:col-span-3">
          <TableWrap>
            <table className="data">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th className="num">Purchases</th>
                  <th className="num">Total qty</th>
                  <th className="num">Total cost</th>
                  <th className="num">Avg unit cost</th>
                  <th className="num">Batches</th>
                  <th className="num">Avg defect rate</th>
                  <th className="num">Open balance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.supplierId}>
                    <td className="max-w-[16rem] truncate font-medium">{r.supplier}</td>
                    <td className="num">{r.purchases}</td>
                    <td className="num">{qty(r.totalQty)}</td>
                    <td className="num">{money(r.totalCost)}</td>
                    <td className="num text-muted">{money(r.avgUnitCost, { decimals: 2 })}</td>
                    <td className="num">{r.batches}</td>
                    <td className="num">{r.avgDefectRate !== null ? percent(r.avgDefectRate) : '—'}</td>
                    <td className="num">{qty(r.openBatchBalance)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td className="num">{rows.reduce((a, r) => a + r.purchases, 0)}</td>
                  <td className="num">{qty(rows.reduce((a, r) => a + r.totalQty, 0))}</td>
                  <td className="num">{money(spend)}</td>
                  <td />
                  <td className="num">{rows.reduce((a, r) => a + r.batches, 0)}</td>
                  <td />
                  <td className="num">{qty(openBalance)}</td>
                </tr>
              </tfoot>
            </table>
          </TableWrap>
        </Section>

        <Section title="Spend by supplier" className="lg:col-span-2">
          <Card>
            <BarList
              data={rows
                .filter((r) => r.totalCost > 0)
                .map((r) => ({
                  label: r.supplier,
                  value: r.totalCost,
                  display: money(r.totalCost),
                  sub: `${r.purchases} purchases · ${qty(r.totalQty)} units`,
                }))}
            />
          </Card>
        </Section>
      </div>

      {withQuality === 0 && (
        <Callout tone="warn" title="Quality scoring is empty">
          Average defect rate stays blank until production operations record an input batch and a
          rejected quantity. Cost data is complete; quality data needs the operations log.
        </Callout>
      )}
    </>
  );
}
