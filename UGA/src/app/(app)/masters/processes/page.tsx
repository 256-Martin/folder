import Link from 'next/link';
import { RecordForm } from '@/components/RecordForm';
import { Badge, Callout, PageHeader, Section, Stat, StatGrid, StatusBadge, TableWrap } from '@/components/ui';
import { saveProcess } from '@/lib/actions/masters';
import { requireAdmin } from '@/lib/auth';
import { WIP_STAGES } from '@/lib/constants';
import { loadSnapshot } from '@/lib/core';

export const dynamic = 'force-dynamic';

export default async function ProcessesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  await requireAdmin();
  const { edit } = await searchParams;
  const snap = await loadSnapshot();

  const ordered = [...snap.processes].sort((a, b) => a.sequenceNo - b.sequenceNo);
  const editing = edit ? snap.processes.find((p) => String(p.id) === edit) : undefined;
  const tracked = new Set(WIP_STAGES.flatMap((s) => [s.from, s.to].filter(Boolean) as string[]));

  return (
    <>
      <PageHeader
        title="Process Master"
        subtitle="The routing. Sequence number drives the order of operations; input and output stages drive the WIP calculation."
        badge={<Badge tone="warn">Admin</Badge>}
        actions={
          editing ? (
            <Link href="/masters/processes" className="btn-secondary btn-sm">
              Cancel edit
            </Link>
          ) : null
        }
      />

      <StatGrid cols={3}>
        <Stat label="Processes" value={snap.processes.length} />
        <Stat label="Tracked as WIP stages" value={ordered.filter((p) => tracked.has(p.code)).length} />
        <Stat
          label="Produce a stock item"
          value={ordered.filter((p) => (p.producesStockItem ?? '').toLowerCase().startsWith('yes')).length}
        />
      </StatGrid>

      <div className="my-6">
        <RecordForm
          key={editing?.id ?? 'new'}
          action={saveProcess}
          title={editing ? `Edit ${editing.code}` : 'Add a process'}
          submitLabel={editing ? 'Save changes' : 'Add process'}
          fields={[
            { name: 'id', label: '', type: 'hidden', defaultValue: editing?.id ?? '' },
            { name: 'code', label: 'Process code', type: 'text', required: true, defaultValue: editing?.code },
            { name: 'name', label: 'Process name', type: 'text', required: true, defaultValue: editing?.name, span: 2 },
            { name: 'sequenceNo', label: 'Sequence no.', type: 'number', required: true, step: 'any', defaultValue: editing?.sequenceNo ?? '' },
            { name: 'inputStage', label: 'Input stage', type: 'text', defaultValue: editing?.inputStage ?? '' },
            { name: 'outputStage', label: 'Output stage', type: 'text', defaultValue: editing?.outputStage ?? '' },
            { name: 'consumesMaterials', label: 'Consumes materials?', type: 'text', defaultValue: editing?.consumesMaterials ?? '' },
            { name: 'producesStockItem', label: 'Produces stock item?', type: 'text', defaultValue: editing?.producesStockItem ?? '' },
            { name: 'active', label: 'Active', type: 'checkbox', defaultValue: editing ? (editing.active ? 1 : '') : 1 },
          ]}
        />
      </div>

      <Section title="Routing order">
        <TableWrap>
          <table className="data">
            <thead>
              <tr>
                <th className="num">Seq</th>
                <th>Code</th>
                <th>Name</th>
                <th>Input stage</th>
                <th>Output stage</th>
                <th>Consumes</th>
                <th>Produces stock</th>
                <th>WIP tracked</th>
                <th>Active</th>
                <th className="no-print" />
              </tr>
            </thead>
            <tbody>
              {ordered.map((p) => (
                <tr key={p.id}>
                  <td className="num text-muted">{p.sequenceNo}</td>
                  <td className="font-medium">{p.code}</td>
                  <td>{p.name}</td>
                  <td className="text-muted">{p.inputStage ?? '—'}</td>
                  <td className="text-muted">{p.outputStage ?? '—'}</td>
                  <td className="text-2xs text-muted">{p.consumesMaterials ?? '—'}</td>
                  <td className="text-2xs text-muted">{p.producesStockItem ?? '—'}</td>
                  <td>
                    <StatusBadge status={tracked.has(p.code) ? 'Yes' : 'No'} />
                  </td>
                  <td>
                    <StatusBadge status={p.active ? 'Active' : 'Inactive'} />
                  </td>
                  <td className="no-print">
                    <Link href={`/masters/processes?edit=${p.id}`} className="btn-ghost btn-sm">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Section>

      <Callout tone="info" title="Processes outside the WIP ladder">
        HAIRPREP and USMAKE feed tufting as materials rather than as line stages, so they are not WIP
        columns. USMAKE produces U-staple stock; HAIRPREP&rsquo;s output (prepared hair) is not
        currently held as a stock item, so its production is visible only through direct labour.
      </Callout>
    </>
  );
}
