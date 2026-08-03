import Link from 'next/link';
import { RecordForm } from '@/components/RecordForm';
import { Badge, PageHeader, Section, Stat, StatGrid, StatusBadge, TableWrap } from '@/components/ui';
import { saveWorker } from '@/lib/actions/masters';
import { requireAdmin } from '@/lib/auth';
import { labourByWorker, loadSnapshot } from '@/lib/core';
import { money, qty } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function WorkersPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  await requireAdmin();
  const { edit } = await searchParams;
  const snap = await loadSnapshot();
  const labour = new Map(labourByWorker(snap).map((r) => [r.id, r]));
  const editing = edit ? snap.workers.find((w) => String(w.id) === edit) : undefined;

  return (
    <>
      <PageHeader
        title="Worker Master"
        subtitle="Production workers. The name here is what appears in every dropdown, on payment statements and in the meal log."
        badge={<Badge tone="warn">Admin</Badge>}
        actions={
          editing ? (
            <Link href="/masters/workers" className="btn-secondary btn-sm">
              Cancel edit
            </Link>
          ) : null
        }
      />

      <StatGrid cols={3}>
        <Stat label="Workers" value={snap.workers.length} />
        <Stat label="Active" value={snap.workers.filter((w) => w.active).length} />
        <Stat
          label="Workers with recorded output"
          value={[...labour.values()].filter((r) => r.accepted > 0).length}
          href="/productivity"
        />
      </StatGrid>

      <div className="my-6">
        <RecordForm
          key={editing?.id ?? 'new'}
          action={saveWorker}
          title={editing ? `Edit ${editing.name}` : 'Add a worker'}
          submitLabel={editing ? 'Save changes' : 'Add worker'}
          fields={[
            { name: 'id', label: '', type: 'hidden', defaultValue: editing?.id ?? '' },
            { name: 'code', label: 'Worker code', type: 'text', required: true, defaultValue: editing?.code, placeholder: 'W11' },
            { name: 'name', label: 'Worker name', type: 'text', required: true, defaultValue: editing?.name, span: 3 },
            {
              name: 'processesAbleToDo',
              label: 'Processes able to do (free text)',
              type: 'text',
              defaultValue: editing?.processesAbleToDo ?? '',
              span: 6,
              help: 'A readable summary. The enforceable list lives in Worker Skills.',
            },
            { name: 'active', label: 'Active', type: 'checkbox', defaultValue: editing ? (editing.active ? 1 : '') : 1 },
          ]}
        />
      </div>

      <Section title="All workers">
        <TableWrap>
          <table className="data">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Processes able to do</th>
                <th className="num">Accepted (all)</th>
                <th className="num">Direct labour (all)</th>
                <th>Active</th>
                <th className="no-print" />
              </tr>
            </thead>
            <tbody>
              {snap.workers.map((w) => (
                <tr key={w.id}>
                  <td className="font-medium">{w.code}</td>
                  <td>{w.name}</td>
                  <td className="max-w-[24rem] truncate text-2xs text-muted">
                    {w.processesAbleToDo ?? '—'}
                  </td>
                  <td className="num">{qty(labour.get(w.id)?.accepted ?? 0)}</td>
                  <td className="num">{money(labour.get(w.id)?.cost ?? 0)}</td>
                  <td>
                    <StatusBadge status={w.active ? 'Yes' : 'No'} />
                  </td>
                  <td className="no-print">
                    <Link href={`/masters/workers?edit=${w.id}`} className="btn-ghost btn-sm">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Section>
    </>
  );
}
