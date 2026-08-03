import { Badge, Callout, PageHeader, Section, Stat, StatGrid, StatusBadge, TableWrap } from '@/components/ui';
import { dataIssues, loadSnapshot, readiness, totalOpenIssues } from '@/lib/core';

export const dynamic = 'force-dynamic';

export default async function DataIssuesPage() {
  const snap = await loadSnapshot();
  const issues = dataIssues(snap);
  const total = totalOpenIssues(snap);
  const ready = readiness(snap);

  return (
    <>
      <PageHeader
        title="Data Issues"
        subtitle="Automatic checks across every entry log and summary. Every count should read zero."
        badge={total === 0 ? <Badge tone="ok">All clear</Badge> : <Badge tone="warn">{total} open</Badge>}
      />

      <StatGrid cols={3}>
        <Stat label="Total open issues" value={total} tone={total > 0 ? 'warn' : 'ok'} />
        <Stat label="Checks run" value={issues.length} />
        <Stat
          label="Setup items outstanding"
          value={ready.filter((r) => !r.ready).length}
          tone={ready.some((r) => !r.ready) ? 'warn' : 'ok'}
        />
      </StatGrid>

      <Section title="Checks" className="mt-6">
        <TableWrap>
          <table className="data">
            <thead>
              <tr>
                <th>Check</th>
                <th className="num">Count</th>
                <th>Status</th>
                <th>Where to fix</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((i) => (
                <tr key={i.check}>
                  <td className={i.count > 0 ? 'font-medium text-ink' : ''}>{i.check}</td>
                  <td className={`num ${i.count > 0 ? 'font-semibold text-warn' : 'text-muted'}`}>
                    {i.count}
                  </td>
                  <td>
                    <StatusBadge status={i.count === 0 ? 'OK' : 'FIX'} />
                  </td>
                  <td className="text-muted">{i.where}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total open issues</td>
                <td className="num">{total}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </TableWrap>
      </Section>

      <Section title="Setup readiness">
        <TableWrap>
          <table className="data">
            <thead>
              <tr>
                <th>Check</th>
                <th className="num">Count</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {ready.map((r) => (
                <tr key={r.check}>
                  <td>{r.check}</td>
                  <td className="num">{r.count}</td>
                  <td>
                    <StatusBadge status={r.ready ? 'READY' : 'FIX'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Section>

      <Callout tone="info" title="Coverage">
        These checks extend the spreadsheet&rsquo;s original set to cover the Meal Log, Deductions
        Log and Expenses — three sheets that had per-row validation but were never rolled up into the
        headline count.
      </Callout>
    </>
  );
}
