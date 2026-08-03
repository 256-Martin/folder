import { InlineAction, RecordForm } from '@/components/RecordForm';
import { Badge, Callout, Card, PageHeader, Section, Stat, StatGrid } from '@/components/ui';
import { deleteListOption, saveListOption } from '@/lib/actions/masters';
import { requireAdmin } from '@/lib/auth';
import { loadSnapshot } from '@/lib/core';

export const dynamic = 'force-dynamic';

export default async function ListsPage() {
  await requireAdmin();
  const snap = await loadSnapshot();

  const categories = [...new Set(snap.listOptions.map((o) => o.category))].sort();
  const byCategory = new Map<string, typeof snap.listOptions>();
  for (const o of snap.listOptions) {
    if (!byCategory.has(o.category)) byCategory.set(o.category, []);
    byCategory.get(o.category)!.push(o);
  }

  return (
    <>
      <PageHeader
        title="Lists & Dropdowns"
        subtitle="Every dropdown in the system reads from here. Movement types also carry the +1 / −1 sign that drives all stock balances."
        badge={<Badge tone="warn">Admin</Badge>}
      />

      <StatGrid cols={3}>
        <Stat label="Categories" value={categories.length} />
        <Stat label="Options" value={snap.listOptions.length} />
        <Stat label="Movement types" value={byCategory.get('Movement Type')?.length ?? 0} />
      </StatGrid>

      <div className="my-6">
        <RecordForm
          action={saveListOption}
          title="Add a dropdown option"
          submitLabel="Add option"
          fields={[
            {
              name: 'category',
              label: 'Category',
              type: 'select',
              required: true,
              options: categories.map((c) => ({ value: c, label: c })),
            },
            { name: 'value', label: 'Value', type: 'text', required: true, span: 2 },
            {
              name: 'numericMeta',
              label: 'Stock sign',
              type: 'number',
              step: '1',
              help: 'Movement types only: 1 adds to stock, -1 subtracts.',
            },
          ]}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {categories.map((category) => (
          <Card key={category}>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
              {category}
            </h3>
            <ul className="space-y-1">
              {(byCategory.get(category) ?? [])
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((o) => (
                  <li
                    key={o.id}
                    className="group flex items-center justify-between gap-2 rounded-md px-2 py-1 text-sm hover:bg-raised"
                  >
                    <span className={`min-w-0 truncate ${o.active ? 'text-ink' : 'text-faint line-through'}`}>
                      {o.value}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {!o.active && <Badge tone="neutral">Inactive</Badge>}
                      {o.numericMeta !== null && (
                        <Badge tone={o.numericMeta > 0 ? 'ok' : 'warn'}>
                          {o.numericMeta > 0 ? '+1' : '−1'}
                        </Badge>
                      )}
                      <span className="opacity-0 transition group-hover:opacity-100 no-print">
                        <InlineAction
                          action={deleteListOption}
                          label="Remove"
                          variant="ghost"
                          fields={{ id: o.id }}
                        />
                      </span>
                    </span>
                  </li>
                ))}
            </ul>
          </Card>
        ))}
      </div>

      <div className="mt-6">
        <Callout tone="warn" title="Removing an option">
          Existing records keep whatever value they were saved with — removing an option only stops
          it appearing in new entries. Changing a movement type&rsquo;s sign, however, recalculates
          every stock balance in the system immediately.
        </Callout>
      </div>
    </>
  );
}
