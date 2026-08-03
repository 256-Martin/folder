import Link from 'next/link';
import { RecordForm } from '@/components/RecordForm';
import { Badge, Callout, PageHeader, Section, Stat, StatGrid, StatusBadge, TableWrap } from '@/components/ui';
import { saveRate } from '@/lib/actions/masters';
import { requireAdmin } from '@/lib/auth';
import { loadSnapshot } from '@/lib/core';
import { dateLong, money } from '@/lib/format';
import { itemOptions, processOptions } from '@/lib/options';
import { today } from '@/lib/dates';

export const dynamic = 'force-dynamic';

export default async function RatesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  await requireAdmin();
  const { edit } = await searchParams;
  const snap = await loadSnapshot();

  const editing = edit ? snap.rates.find((r) => String(r.id) === edit) : undefined;

  const rows = [...snap.rates].sort((a, b) => {
    const pa = snap.processById.get(a.processId)?.sequenceNo ?? 0;
    const pb = snap.processById.get(b.processId)?.sequenceNo ?? 0;
    if (pa !== pb) return pa - pb;
    return (snap.itemById.get(a.productItemId)?.code ?? '').localeCompare(
      snap.itemById.get(b.productItemId)?.code ?? '',
    );
  });

  const missing = rows.filter((r) => r.active && r.ratePerUnit === null);
  const blocks = (snap.setting('Allow operation without piece rate') ?? 'No').toLowerCase() === 'no';

  return (
    <>
      <PageHeader
        title="Piece Rate Settings"
        subtitle="Direct-labour rates by process × product, with effective dates. The rate in force on the operation date is applied and stored on the operation."
        badge={<Badge tone="warn">Admin</Badge>}
        actions={
          editing ? (
            <Link href="/masters/rates" className="btn-secondary btn-sm">
              Cancel edit
            </Link>
          ) : null
        }
      />

      {missing.length > 0 && (
        <div className="mb-5">
          <Callout tone={blocks ? 'danger' : 'warn'} title={`${missing.length} rates are still TO CONFIRM`}>
            {blocks
              ? 'Operations for these combinations cannot be recorded until a rate is entered, because Settings has “Allow operation without piece rate” set to No. This is the single most common reason production entry appears blocked.'
              : 'Operations for these combinations will record a zero labour cost until a rate is entered.'}
          </Callout>
        </div>
      )}

      <StatGrid cols={4}>
        <Stat label="Rates defined" value={rows.length} />
        <Stat label="Set" value={rows.filter((r) => r.ratePerUnit !== null).length} tone="ok" />
        <Stat label="TO CONFIRM" value={missing.length} tone={missing.length ? 'danger' : 'ok'} />
        <Stat
          label="Entry without a rate"
          value={blocks ? 'Blocked' : 'Allowed'}
          tone={blocks ? 'warn' : 'neutral'}
          href="/settings"
        />
      </StatGrid>

      <div className="my-6">
        <RecordForm
          key={editing?.id ?? 'new'}
          action={saveRate}
          title={editing ? 'Edit piece rate' : 'Add or update a piece rate'}
          description="Leave the rate blank to mark it TO CONFIRM. Adding a new row with a later effective date creates a rate change without rewriting history."
          submitLabel={editing ? 'Save changes' : 'Save rate'}
          fields={[
            { name: 'id', label: '', type: 'hidden', defaultValue: editing?.id ?? '' },
            {
              name: 'processId',
              label: 'Process',
              type: 'select',
              required: true,
              options: processOptions(snap),
              defaultValue: editing?.processId ?? '',
            },
            {
              name: 'productItemId',
              label: 'Product / handle',
              type: 'select',
              required: true,
              options: itemOptions(snap, (cat) => cat !== 'Consumable'),
              defaultValue: editing?.productItemId ?? '',
            },
            {
              name: 'ratePerUnit',
              label: 'Rate per unit (UGX)',
              type: 'number',
              step: 'any',
              min: '0',
              defaultValue: editing?.ratePerUnit ?? '',
              help: 'Blank = TO CONFIRM',
            },
            { name: 'unit', label: 'Unit', type: 'text', defaultValue: editing?.unit ?? 'piece' },
            {
              name: 'effectiveFrom',
              label: 'Effective from',
              type: 'date',
              required: true,
              defaultValue: editing?.effectiveFrom ?? today(),
            },
            { name: 'active', label: 'Active', type: 'checkbox', defaultValue: editing ? (editing.active ? 1 : '') : 1 },
            { name: 'notes', label: 'Notes', type: 'text', defaultValue: editing?.notes ?? '', span: 6 },
          ]}
        />
      </div>

      <Section title="All rates">
        <TableWrap>
          <table className="data">
            <thead>
              <tr>
                <th>Process</th>
                <th>Product</th>
                <th className="num">Rate per unit</th>
                <th>Unit</th>
                <th>Effective from</th>
                <th>Status</th>
                <th>Active</th>
                <th>Notes</th>
                <th className="no-print" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const proc = snap.processById.get(r.processId);
                const prod = snap.itemById.get(r.productItemId);
                return (
                  <tr key={r.id}>
                    <td className="font-medium">{proc?.code ?? '—'}</td>
                    <td>{prod?.code ?? '—'}</td>
                    <td className="num font-medium">{r.ratePerUnit !== null ? money(r.ratePerUnit) : '—'}</td>
                    <td className="text-muted">{r.unit}</td>
                    <td className="whitespace-nowrap text-muted">{dateLong(r.effectiveFrom)}</td>
                    <td>
                      <StatusBadge status={r.ratePerUnit !== null ? 'SET' : 'TO CONFIRM'} />
                    </td>
                    <td>
                      <StatusBadge status={r.active ? 'Yes' : 'No'} />
                    </td>
                    <td className="max-w-[12rem] truncate text-2xs text-muted">{r.notes ?? '—'}</td>
                    <td className="no-print">
                      <Link href={`/masters/rates?edit=${r.id}`} className="btn-ghost btn-sm">
                        Edit
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      </Section>
    </>
  );
}
