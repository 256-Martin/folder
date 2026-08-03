import { FilterBar } from '@/components/FilterBar';
import { BarList } from '@/components/charts';
import { Badge, Card, PageHeader, Section, Stat, StatGrid, TableWrap } from '@/components/ui';
import { labourByProcess, labourByWorker, loadSnapshot } from '@/lib/core';
import { money, percent, qty } from '@/lib/format';
import { monthOptions } from '@/lib/options';

export const dynamic = 'force-dynamic';

export default async function LabourPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const snap = await loadSnapshot();
  const month = params.month ?? snap.month;

  const byWorker = labourByWorker(snap, month);
  const byProcess = labourByProcess(snap);

  const totalAll = byWorker.reduce((a, w) => a + w.cost, 0);
  const totalMonth = byWorker.reduce((a, w) => a + w.costThisMonth, 0);
  const acceptedAll = byWorker.reduce((a, w) => a + w.accepted, 0);
  const rejectedAll = byWorker.reduce((a, w) => a + w.rejected, 0);

  return (
    <>
      <PageHeader
        title="Direct Labour Summary"
        subtitle="Piecework earnings from accepted work only. Rejected units are never paid, so the worker carries the cost of their own rejects."
        badge={<Badge tone="info">View only</Badge>}
      />

      <StatGrid cols={4}>
        <Stat label="Direct labour (all time)" value={money(totalAll)} hint="UGX" />
        <Stat label={`Direct labour (${month})`} value={money(totalMonth)} hint="UGX" />
        <Stat label="Accepted units (all time)" value={qty(acceptedAll)} />
        <Stat
          label="Reject rate (all time)"
          value={acceptedAll + rejectedAll > 0 ? percent(rejectedAll / (acceptedAll + rejectedAll)) : '—'}
        />
      </StatGrid>

      <Section className="mt-6">
        <FilterBar
          fields={[{ type: 'select', name: 'month', label: 'Month', value: params.month, options: monthOptions(snap) }]}
        />
      </Section>

      <div className="grid gap-6 lg:grid-cols-5">
        <Section title="By worker" className="lg:col-span-3">
          <TableWrap>
            <table className="data">
              <thead>
                <tr>
                  <th>Worker</th>
                  <th className="num">Operations</th>
                  <th className="num">Accepted (all)</th>
                  <th className="num">Rejected (all)</th>
                  <th className="num">Cost (all)</th>
                  <th className="num">Reject rate</th>
                  <th className="num">Accepted ({month})</th>
                  <th className="num">Rejected ({month})</th>
                  <th className="num">Cost ({month})</th>
                </tr>
              </thead>
              <tbody>
                {byWorker.map((w) => (
                  <tr key={w.id}>
                    <td>{w.name}</td>
                    <td className="num">{w.operations}</td>
                    <td className="num">{qty(w.accepted)}</td>
                    <td className="num">{qty(w.rejected)}</td>
                    <td className="num">{money(w.cost)}</td>
                    <td className="num">{w.rejectRate !== null ? percent(w.rejectRate) : '—'}</td>
                    <td className="num">{qty(w.acceptedThisMonth)}</td>
                    <td className="num">{qty(w.rejectedThisMonth)}</td>
                    <td className="num font-medium">{money(w.costThisMonth)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td className="num">{qty(acceptedAll)}</td>
                  <td className="num">{qty(rejectedAll)}</td>
                  <td className="num">{money(totalAll)}</td>
                  <td className="num">{qty(byWorker.reduce((a, w) => a + w.acceptedThisMonth, 0))}</td>
                  <td className="num">{qty(byWorker.reduce((a, w) => a + w.rejectedThisMonth, 0))}</td>
                  <td className="num">{money(totalMonth)}</td>
                </tr>
              </tfoot>
            </table>
          </TableWrap>
        </Section>

        <Section title="Cost by worker" className="lg:col-span-2">
          <Card>
            <BarList
              data={byWorker
                .filter((w) => w.cost > 0)
                .sort((a, b) => b.cost - a.cost)
                .map((w) => ({ label: w.name, value: w.cost, display: money(w.cost) }))}
              emptyMessage="No direct labour recorded yet."
            />
          </Card>
        </Section>
      </div>

      <Section title="By process (all time)">
        <TableWrap>
          <table className="data">
            <thead>
              <tr>
                <th>Process</th>
                <th className="num">Operations</th>
                <th className="num">Accepted</th>
                <th className="num">Rejected</th>
                <th className="num">Reject rate</th>
                <th className="num">Direct labour cost</th>
              </tr>
            </thead>
            <tbody>
              {byProcess.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium">{p.name}</td>
                  <td className="num">{p.operations}</td>
                  <td className="num">{qty(p.accepted)}</td>
                  <td className="num">{qty(p.rejected)}</td>
                  <td className="num">{p.rejectRate !== null ? percent(p.rejectRate) : '—'}</td>
                  <td className="num">{money(p.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Section>
    </>
  );
}
