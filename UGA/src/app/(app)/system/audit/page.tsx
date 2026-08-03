import { desc } from 'drizzle-orm';
import { db } from '@/db';
import * as s from '@/db/schema';
import { FilterBar } from '@/components/FilterBar';
import { Badge, PageHeader, Section, Stat, StatGrid, TableWrap } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { dateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; user?: string; q?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;

  const all = await db.select().from(s.auditLog).orderBy(desc(s.auditLog.timestamp)).limit(1000);

  const rows = all.filter((a) => {
    if (params.action && a.action !== params.action) return false;
    if (params.user && a.userName !== params.user) return false;
    if (params.q) {
      const hay = `${a.entity ?? ''} ${a.refId ?? ''} ${JSON.stringify(a.details ?? {})}`.toLowerCase();
      if (!hay.includes(params.q.toLowerCase())) return false;
    }
    return true;
  });

  const actions = [...new Set(all.map((a) => a.action))].sort();
  const users = [...new Set(all.map((a) => a.userName))].sort();
  const attributed = all.filter((a) => a.userName !== '(unknown)').length;

  return (
    <>
      <PageHeader
        title="Audit Log"
        subtitle="Every recorded entry, setup change, correction and void — with who did it and the values before and after."
        badge={<Badge tone="warn">Admin</Badge>}
      />

      <StatGrid cols={3}>
        <Stat label="Entries" value={all.length} />
        <Stat label="Attributed to a user" value={attributed} tone={attributed ? 'ok' : 'warn'} />
        <Stat label="Imported from Sheets" value={all.length - attributed} hint="Recorded as (unknown)" />
      </StatGrid>

      <Section className="mt-6">
        <FilterBar
          fields={[
            {
              type: 'select',
              name: 'action',
              label: 'Action',
              value: params.action,
              options: actions.map((a) => ({ value: a, label: a })),
            },
            {
              type: 'select',
              name: 'user',
              label: 'User',
              value: params.user,
              options: users.map((u) => ({ value: u, label: u })),
            },
            { type: 'search', name: 'q', label: 'Search', value: params.q, placeholder: 'entity, ref, detail' },
          ]}
        />

        <TableWrap>
          <table className="data">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Reference</th>
                <th>Details</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap text-xs text-muted">{dateTime(a.timestamp)}</td>
                  <td className={a.userName === '(unknown)' ? 'text-faint' : ''}>{a.userName}</td>
                  <td>
                    <Badge
                      tone={
                        a.action === 'VOID'
                          ? 'danger'
                          : a.action === 'RESTORE'
                            ? 'info'
                            : a.action === 'SETUP_CHANGE'
                              ? 'warn'
                              : 'neutral'
                      }
                    >
                      {a.action}
                    </Badge>
                  </td>
                  <td className="text-muted">{a.entity ?? '—'}</td>
                  <td className="max-w-[14rem] truncate font-mono text-xs">{a.refId ?? '—'}</td>
                  <td className="max-w-[28rem]">
                    <details>
                      <summary className="cursor-pointer truncate text-2xs text-muted">
                        {JSON.stringify(a.details ?? {}).slice(0, 90)}
                      </summary>
                      <pre className="mt-1 max-h-56 overflow-auto rounded-lg bg-raised p-2 text-2xs">
                        {JSON.stringify(a.details ?? {}, null, 2)}
                      </pre>
                    </details>
                  </td>
                  <td className="text-muted">{a.result}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-muted">
                    No audit entries match these filters.
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
