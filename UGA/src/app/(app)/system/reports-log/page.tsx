import { desc } from 'drizzle-orm';
import { db } from '@/db';
import * as s from '@/db/schema';
import { FilterBar } from '@/components/FilterBar';
import { Badge, PageHeader, Section, Stat, StatGrid, TableWrap } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { dateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function ReportLogPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;

  const all = await db.select().from(s.reportLog).orderBy(desc(s.reportLog.timestamp)).limit(1000);
  const rows = params.type ? all.filter((r) => r.reportType === params.type) : all;

  const types = [...new Set(all.map((r) => r.reportType))].sort();
  const exports_ = all.filter((r) => r.action === 'EXPORT').length;

  return (
    <>
      <PageHeader
        title="Report Log"
        subtitle="Every report generated and every CSV exported, with who produced it and for which period."
        badge={<Badge tone="warn">Admin</Badge>}
      />

      <StatGrid cols={3}>
        <Stat label="Entries" value={all.length} />
        <Stat label="Distinct report types" value={types.length} />
        <Stat label="CSV exports" value={exports_} />
      </StatGrid>

      <Section className="mt-6">
        <FilterBar
          fields={[
            {
              type: 'select',
              name: 'type',
              label: 'Report type',
              value: params.type,
              options: types.map((t) => ({ value: t, label: t })),
            },
          ]}
        />

        <TableWrap>
          <table className="data">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Report type</th>
                <th>Period</th>
                <th>Filters</th>
                <th>Status</th>
                <th>Output</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap text-xs text-muted">{dateTime(r.timestamp)}</td>
                  <td className={r.userName === '(unknown)' ? 'text-faint' : ''}>{r.userName}</td>
                  <td>
                    <Badge tone={r.action === 'EXPORT' ? 'info' : 'neutral'}>{r.action}</Badge>
                  </td>
                  <td>{r.reportType}</td>
                  <td className="whitespace-nowrap text-muted">{r.period ?? '—'}</td>
                  <td className="max-w-[16rem] truncate text-muted">{r.filters ?? '—'}</td>
                  <td className="text-muted">{r.status}</td>
                  <td className="text-muted">{r.output ?? '—'}</td>
                  <td className="max-w-[16rem] truncate text-muted">{r.note ?? '—'}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-muted">
                    No reports logged.
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
