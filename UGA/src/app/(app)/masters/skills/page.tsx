import { db } from '@/db';
import * as s from '@/db/schema';
import { InlineAction, RecordForm } from '@/components/RecordForm';
import { Badge, Callout, PageHeader, Section, Stat, StatGrid, StatusBadge, TableWrap } from '@/components/ui';
import { deleteSkill, saveSkill } from '@/lib/actions/masters';
import { requireAdmin } from '@/lib/auth';
import { loadSnapshot } from '@/lib/core';
import { listOptions, processOptions, workerOptions } from '@/lib/options';

export const dynamic = 'force-dynamic';

export default async function SkillsPage() {
  await requireAdmin();
  const snap = await loadSnapshot();
  const skills = await db.select().from(s.workerProcessSkill);

  const byWorker = new Map<number, typeof skills>();
  for (const k of skills) {
    if (!byWorker.has(k.workerId)) byWorker.set(k.workerId, []);
    byWorker.get(k.workerId)!.push(k);
  }

  const ordered = [...snap.processes].sort((a, b) => a.sequenceNo - b.sequenceNo);
  const enforced = (snap.setting('Enforce Worker Process Assignment?') ?? 'No').toLowerCase() === 'yes';

  return (
    <>
      <PageHeader
        title="Worker Process Skills"
        subtitle="Which worker can support which process. One row per worker × process."
        badge={<Badge tone="warn">Admin</Badge>}
      />

      <StatGrid cols={3}>
        <Stat label="Assignments" value={skills.length} />
        <Stat label="Active" value={skills.filter((k) => k.active).length} />
        <Stat
          label="Enforced at entry"
          value={enforced ? 'Yes' : 'No'}
          tone={enforced ? 'ok' : 'warn'}
          href="/settings"
        />
      </StatGrid>

      {!enforced && (
        <div className="mt-5">
          <Callout tone="warn" title="This matrix is currently advisory">
            Settings has &ldquo;Enforce Worker Process Assignment?&rdquo; set to No, so production
            entry will accept any worker on any process. Switch it to Yes to make this matrix binding.
          </Callout>
        </div>
      )}

      <div className="my-6">
        <RecordForm
          action={saveSkill}
          title="Assign a worker to a process"
          description="Saving an existing pair updates it rather than creating a duplicate."
          submitLabel="Save assignment"
          fields={[
            { name: 'workerId', label: 'Worker', type: 'select', required: true, options: workerOptions(snap) },
            { name: 'processId', label: 'Process', type: 'select', required: true, options: processOptions(snap) },
            {
              name: 'skillStatus',
              label: 'Skill status',
              type: 'select',
              options: listOptions(snap, 'Skill Status'),
              defaultValue: 'Can Do',
            },
            { name: 'active', label: 'Active', type: 'checkbox', defaultValue: 1 },
            { name: 'notes', label: 'Notes', type: 'text', span: 6 },
          ]}
        />
      </div>

      <Section title="Skills matrix">
        <TableWrap>
          <table className="data">
            <thead>
              <tr>
                <th>Worker</th>
                {ordered.map((p) => (
                  <th key={p.id} className="text-center">
                    {p.code}
                  </th>
                ))}
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {snap.workers.map((w) => {
                const mine = byWorker.get(w.id) ?? [];
                return (
                  <tr key={w.id}>
                    <td className="whitespace-nowrap font-medium">{w.name}</td>
                    {ordered.map((p) => {
                      const hit = mine.find((k) => k.processId === p.id && k.active);
                      return (
                        <td key={p.id} className="text-center">
                          {hit ? (
                            <span className="inline-block h-2 w-2 rounded-full bg-ok" title={hit.skillStatus} />
                          ) : (
                            <span className="text-faint">·</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="num font-medium">{mine.filter((k) => k.active).length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      </Section>

      <Section title="All assignments">
        <TableWrap>
          <table className="data">
            <thead>
              <tr>
                <th>Worker</th>
                <th>Process</th>
                <th>Skill status</th>
                <th>Active</th>
                <th>Notes</th>
                <th className="no-print" />
              </tr>
            </thead>
            <tbody>
              {skills.map((k) => (
                <tr key={k.id}>
                  <td>{snap.workerById.get(k.workerId)?.name ?? '—'}</td>
                  <td>{snap.processById.get(k.processId)?.code ?? '—'}</td>
                  <td className="text-muted">{k.skillStatus}</td>
                  <td>
                    <StatusBadge status={k.active ? 'Yes' : 'No'} />
                  </td>
                  <td className="text-muted">{k.notes ?? '—'}</td>
                  <td className="no-print">
                    <InlineAction action={deleteSkill} label="Remove" variant="ghost" fields={{ id: k.id }} />
                  </td>
                </tr>
              ))}
              {skills.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-muted">
                    No assignments yet.
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
