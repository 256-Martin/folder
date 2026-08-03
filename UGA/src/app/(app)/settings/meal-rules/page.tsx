import Link from 'next/link';
import { RecordForm } from '@/components/RecordForm';
import { Badge, Callout, PageHeader, Section, Stat, StatGrid, StatusBadge, TableWrap } from '@/components/ui';
import { saveMealRule } from '@/lib/actions/masters';
import { requireAdmin } from '@/lib/auth';
import { loadSnapshot } from '@/lib/core';
import { qty } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function MealRulesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  await requireAdmin();
  const { edit } = await searchParams;
  const snap = await loadSnapshot();

  const rules = [...snap.mealRules].sort((a, b) => a.sortOrder - b.sortOrder);
  const editing = edit ? rules.find((r) => String(r.id) === edit) : undefined;
  const daily = rules.filter((r) => r.ruleBasis === 'Daily');
  const weekly = rules.filter((r) => r.ruleBasis === 'Weekly');

  return (
    <>
      <PageHeader
        title="Meal Qualification Rules"
        subtitle="How production earns eating days. Daily rules test a per-process threshold; weekly rules award tiers from tufting volume."
        badge={<Badge tone="warn">Admin</Badge>}
        actions={
          editing ? (
            <Link href="/settings/meal-rules" className="btn-secondary btn-sm">
              Cancel edit
            </Link>
          ) : null
        }
      />

      <StatGrid cols={4}>
        <Stat label="Rules" value={rules.length} />
        <Stat label="Daily rules" value={daily.length} />
        <Stat label="Weekly TUFT tiers" value={weekly.length} />
        <Stat label="Active" value={rules.filter((r) => r.active).length} />
      </StatGrid>

      <div className="my-6">
        <RecordForm
          key={editing?.id ?? 'new'}
          action={saveMealRule}
          title={editing ? `Edit ${editing.ruleId}` : 'Add a rule'}
          submitLabel={editing ? 'Save changes' : 'Add rule'}
          fields={[
            { name: 'id', label: '', type: 'hidden', defaultValue: editing?.id ?? '' },
            { name: 'ruleId', label: 'Rule ID', type: 'text', defaultValue: editing?.ruleId ?? '', placeholder: 'R27' },
            { name: 'processCode', label: 'Process code', type: 'text', required: true, defaultValue: editing?.processCode ?? '' },
            {
              name: 'ruleBasis',
              label: 'Basis',
              type: 'select',
              options: [
                { value: 'Daily', label: 'Daily' },
                { value: 'Weekly', label: 'Weekly' },
              ],
              defaultValue: editing?.ruleBasis ?? 'Daily',
            },
            { name: 'product', label: 'Product (code or ANY)', type: 'text', defaultValue: editing?.product ?? '' },
            {
              name: 'condition',
              label: 'Condition (daily)',
              type: 'select',
              options: [
                { value: '>=', label: '≥ at least' },
                { value: '>', label: '> more than' },
              ],
              defaultValue: editing?.condition ?? '>=',
            },
            { name: 'threshold', label: 'Threshold / day', type: 'number', step: 'any', defaultValue: editing?.threshold ?? '' },
            { name: 'weeklySmallMin', label: 'Weekly small ≥ (BR-S)', type: 'number', step: 'any', defaultValue: editing?.weeklySmallMin ?? '' },
            { name: 'weeklyLargeMin', label: 'Weekly large ≥ (BR-L + CUSTOM)', type: 'number', step: 'any', defaultValue: editing?.weeklyLargeMin ?? '' },
            { name: 'eatingDaysEarned', label: 'Eating days earned', type: 'number', step: 'any', defaultValue: editing?.eatingDaysEarned ?? 1 },
            { name: 'active', label: 'Active', type: 'checkbox', defaultValue: editing ? (editing.active ? 1 : '') : 1 },
            { name: 'notes', label: 'Notes', type: 'text', defaultValue: editing?.notes ?? '', span: 6 },
          ]}
        />
      </div>

      <Section title="Daily rules">
        <TableWrap>
          <table className="data">
            <thead>
              <tr>
                <th>Rule</th>
                <th>Process</th>
                <th>Product</th>
                <th>Condition</th>
                <th className="num">Threshold / day</th>
                <th className="num">Days earned</th>
                <th>Active</th>
                <th>Notes</th>
                <th className="no-print" />
              </tr>
            </thead>
            <tbody>
              {daily.map((r) => (
                <tr key={r.id}>
                  <td className="font-mono text-xs font-medium">{r.ruleId}</td>
                  <td>{r.processCode}</td>
                  <td className="text-muted">{r.product ?? 'ANY'}</td>
                  <td className="text-muted">{r.condition ?? '≥'}</td>
                  <td className="num">{qty(r.threshold ?? 0)}</td>
                  <td className="num font-medium">{qty(r.eatingDaysEarned)}</td>
                  <td>
                    <StatusBadge status={r.active ? 'Yes' : 'No'} />
                  </td>
                  <td className="max-w-[22rem] truncate text-2xs text-muted">{r.notes ?? '—'}</td>
                  <td className="no-print">
                    <Link href={`/settings/meal-rules?edit=${r.id}`} className="btn-ghost btn-sm">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Section>

      <Section title="Weekly tufting tiers" description="The highest tier a worker satisfies is the one that applies.">
        <TableWrap>
          <table className="data">
            <thead>
              <tr>
                <th>Rule</th>
                <th className="num">Small ≥</th>
                <th className="num">Large ≥</th>
                <th className="num">Days earned</th>
                <th>Active</th>
                <th>Notes</th>
                <th className="no-print" />
              </tr>
            </thead>
            <tbody>
              {weekly.map((r) => (
                <tr key={r.id}>
                  <td className="font-mono text-xs font-medium">{r.ruleId}</td>
                  <td className="num">{r.weeklySmallMin ? qty(r.weeklySmallMin) : '—'}</td>
                  <td className="num">{r.weeklyLargeMin ? qty(r.weeklyLargeMin) : '—'}</td>
                  <td className="num font-medium">{qty(r.eatingDaysEarned)}</td>
                  <td>
                    <StatusBadge status={r.active ? 'Yes' : 'No'} />
                  </td>
                  <td className="max-w-[22rem] truncate text-2xs text-muted">{r.notes ?? '—'}</td>
                  <td className="no-print">
                    <Link href={`/settings/meal-rules?edit=${r.id}`} className="btn-ghost btn-sm">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Section>

      <Callout tone="info" title="Combining daily and weekly">
        The two results are combined using the &ldquo;Combine Meal Qualification Rules&rdquo; setting
        (currently{' '}
        <strong>{snap.mealSetting('Combine Meal Qualification Rules (Max / Add)') ?? 'Max'}</strong>).
        Max takes the higher of the two and avoids double counting; Add sums them and then applies
        the weekly cap.
      </Callout>
    </>
  );
}
