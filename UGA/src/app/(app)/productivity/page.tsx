import { FilterBar } from '@/components/FilterBar';
import { BarList } from '@/components/charts';
import { Badge, Card, PageHeader, Section, Stat, StatGrid, TableWrap } from '@/components/ui';
import { labourByWorker, loadSnapshot } from '@/lib/core';
import { money, percent, qty } from '@/lib/format';
import { monthOptions } from '@/lib/options';

export const dynamic = 'force-dynamic';

export default async function ProductivityPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const snap = await loadSnapshot();
  const month = params.month ?? snap.month;
  const rows = labourByWorker(snap, month);

  const operations = rows.reduce((a, r) => a + r.operations, 0);
  const accepted = rows.reduce((a, r) => a + r.accepted, 0);
  const rejected = rows.reduce((a, r) => a + r.rejected, 0);

  return (
    <>
      <PageHeader
        title="Worker Productivity"
        subtitle="Output and quality per worker, all time and for the selected month."
        badge={<Badge tone="info">View only</Badge>}
      />

      <StatGrid cols={4}>
        <Stat label="Operations logged" value={operations} />
        <Stat label="Accepted units" value={qty(accepted)} />
        <Stat label="Rejected units" value={qty(rejected)} tone={rejected > 0 ? 'warn' : 'neutral'} />
        <Stat
          label="Overall reject rate"
          value={accepted + rejected > 0 ? percent(rejected / (accepted + rejected)) : '—'}
        />
      </StatGrid>

      <Section className="mt-6">
        <FilterBar
          fields={[{ type: 'select', name: 'month', label: 'Month', value: params.month, options: monthOptions(snap) }]}
        />
      </Section>

      <div className="grid gap-6 lg:grid-cols-5">
        <Section title="Per worker" className="lg:col-span-3">
          <TableWrap>
            <table className="data">
              <thead>
                <tr>
                  <th>Worker</th>
                  <th className="num">Operations</th>
                  <th className="num">Accepted</th>
                  <th className="num">Rejected</th>
                  <th className="num">Reject %</th>
                  <th className="num">Direct labour cost</th>
                  <th className="num">Accepted ({month})</th>
                  <th className="num">Cost ({month})</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td className="num">{r.operations}</td>
                    <td className="num">{qty(r.accepted)}</td>
                    <td className="num">{qty(r.rejected)}</td>
                    <td className="num">{r.rejectRate !== null ? percent(r.rejectRate) : '—'}</td>
                    <td className="num">{money(r.cost)}</td>
                    <td className="num">{qty(r.acceptedThisMonth)}</td>
                    <td className="num font-medium">{money(r.costThisMonth)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Section>

        <Section title="Accepted output" className="lg:col-span-2">
          <Card>
            <BarList
              data={rows
                .filter((r) => r.accepted > 0)
                .sort((a, b) => b.accepted - a.accepted)
                .map((r) => ({
                  label: r.name,
                  value: r.accepted,
                  display: qty(r.accepted),
                  sub: r.rejectRate !== null ? `${percent(r.rejectRate)} rejected` : undefined,
                }))}
              emptyMessage="No operations recorded yet."
            />
          </Card>
        </Section>
      </div>
    </>
  );
}
