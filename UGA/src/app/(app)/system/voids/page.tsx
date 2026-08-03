import { desc } from 'drizzle-orm';
import { db } from '@/db';
import * as s from '@/db/schema';
import { InlineAction } from '@/components/RecordForm';
import { Badge, Callout, PageHeader, Section, Stat, StatGrid, StatusBadge, TableWrap } from '@/components/ui';
import { Snapshot } from '@/components/Snapshot';
import { restoreEntry } from '@/lib/actions/system';
import { requireAdmin } from '@/lib/auth';
import { loadSnapshot } from '@/lib/core';
import { dateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function VoidRegisterPage() {
  await requireAdmin();
  const rows = await db.select().from(s.voidRegister).orderBy(desc(s.voidRegister.timestamp));

  // Lookups so a snapshot can show "TIRE" rather than "itemId: 3".
  const snap = await loadSnapshot();
  const names = {
    item: Object.fromEntries(snap.items.map((i) => [i.id, i.code])),
    supplier: Object.fromEntries(snap.suppliers.map((x) => [x.id, x.name])),
    worker: Object.fromEntries(snap.workers.map((x) => [x.id, x.name])),
    process: Object.fromEntries(snap.processes.map((x) => [x.id, x.code])),
  };

  const voided = rows.filter((r) => r.status === 'Voided').length;
  const restored = rows.filter((r) => r.status === 'Restored').length;
  const imported = rows.filter((r) => r.sourceId === null).length;

  return (
    <>
      <PageHeader
        title="Void Register"
        subtitle="Voided entries never leave the database. Each one is flagged, snapshotted here, and can be restored intact."
        badge={<Badge tone="warn">Admin</Badge>}
      />

      <StatGrid cols={3}>
        <Stat label="Currently voided" value={voided} tone={voided ? 'warn' : 'ok'} />
        <Stat label="Restored" value={restored} />
        <Stat label="Imported from Sheets" value={imported} hint="Cannot be auto-restored" />
      </StatGrid>

      <Section className="mt-6">
        <TableWrap>
          <table className="data">
            <thead>
              <tr>
                <th>Void ID</th>
                <th>When</th>
                <th>Type</th>
                <th>Sheet</th>
                <th>Entry</th>
                <th>Reason</th>
                <th>By</th>
                <th>Status</th>
                <th>Restored at</th>
                <th>Restored by</th>
                <th>Effect</th>
                <th>Snapshot</th>
                <th className="no-print" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap font-mono text-xs font-medium">{r.code}</td>
                  <td className="whitespace-nowrap text-xs text-muted">{dateTime(r.timestamp)}</td>
                  <td className="text-muted">{r.logType}</td>
                  <td className="text-muted">{r.entity}</td>
                  <td className="whitespace-nowrap font-mono text-xs">{r.entryCode ?? '—'}</td>
                  <td className="max-w-[12rem] truncate">{r.reason}</td>
                  <td className={r.voidedByName === '(unknown)' ? 'text-faint' : ''}>{r.voidedByName}</td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="whitespace-nowrap text-xs text-muted">
                    {r.restoredAt ? dateTime(r.restoredAt) : '—'}
                  </td>
                  <td className="text-muted">{r.restoredByName ?? '—'}</td>
                  <td className="max-w-[18rem] truncate text-2xs text-muted">
                    {r.reversalEffect ?? '—'}
                  </td>
                  <td className="max-w-[18rem] align-top">
                    <Snapshot data={r.oldValues} names={names} />
                  </td>
                  <td className="no-print">
                    {r.status === 'Voided' && r.sourceId !== null && (
                      <InlineAction
                        action={restoreEntry}
                        label="Restore"
                        variant="secondary"
                        icon="undo"
                        fields={{ voidId: r.id }}
                      />
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={13} className="py-10 text-center text-muted">
                    Nothing has been voided.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </TableWrap>
      </Section>

      <Callout tone="info" title="Stable references">
        Each void points at the record&rsquo;s permanent database ID as well as its display code. In
        the spreadsheet, IDs were derived from row position, so deleting a row renumbered everything
        below it and left the register pointing at the wrong entry. That cannot happen here.
      </Callout>
    </>
  );
}
