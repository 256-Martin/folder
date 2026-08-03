import Link from 'next/link';
import { RecordForm } from '@/components/RecordForm';
import { Badge, PageHeader, Section, Stat, StatGrid, StatusBadge, TableWrap } from '@/components/ui';
import { saveItem } from '@/lib/actions/masters';
import { requireAdmin } from '@/lib/auth';
import { loadSnapshot, stockRows } from '@/lib/core';
import { money, qty } from '@/lib/format';
import { listOptions } from '@/lib/options';

export const dynamic = 'force-dynamic';

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  await requireAdmin();
  const { edit } = await searchParams;
  const snap = await loadSnapshot();
  const balances = new Map(stockRows(snap).map((r) => [r.code, r]));

  const editing = edit ? snap.items.find((i) => String(i.id) === edit) : undefined;

  const categories = listOptions(snap, 'Category');
  const uoms = listOptions(snap, 'UoM');

  return (
    <>
      <PageHeader
        title="Item Master"
        subtitle="One row per item: raw materials, consumables, manufactured components and finished goods. Standard cost drives inventory valuation; reorder level drives low-stock alerts."
        badge={<Badge tone="warn">Admin</Badge>}
        actions={
          editing ? (
            <Link href="/masters/items" className="btn-secondary btn-sm">
              Cancel edit
            </Link>
          ) : null
        }
      />

      <StatGrid cols={4}>
        <Stat label="Items" value={snap.items.length} />
        <Stat label="Active" value={snap.items.filter((i) => i.active).length} />
        <Stat label="Batch-tracked" value={snap.items.filter((i) => i.trackedByBatch).length} />
        <Stat
          label="Missing standard cost"
          value={snap.items.filter((i) => i.standardCost === null).length}
          tone={snap.items.some((i) => i.standardCost === null) ? 'warn' : 'ok'}
        />
      </StatGrid>

      <div className="my-6">
        <RecordForm
          key={editing?.id ?? 'new'}
          action={saveItem}
          title={editing ? `Edit ${editing.code}` : 'Add an item'}
          submitLabel={editing ? 'Save changes' : 'Add item'}
          fields={[
            { name: 'id', label: '', type: 'hidden', defaultValue: editing?.id ?? '' },
            { name: 'code', label: 'Item code', type: 'text', required: true, defaultValue: editing?.code, placeholder: 'HAIR' },
            { name: 'name', label: 'Item name', type: 'text', required: true, defaultValue: editing?.name, span: 3 },
            {
              name: 'category',
              label: 'Category',
              type: 'select',
              required: true,
              options: categories.length ? categories : [{ value: 'Raw Material', label: 'Raw Material' }],
              defaultValue: editing?.category,
            },
            {
              name: 'baseUom',
              label: 'Base UoM',
              type: 'select',
              required: true,
              options: uoms.length ? uoms : [{ value: 'piece', label: 'piece' }],
              defaultValue: editing?.baseUom,
            },
            { name: 'standardCost', label: 'Standard cost (UGX)', type: 'number', step: 'any', defaultValue: editing?.standardCost ?? '' },
            { name: 'reorderLevel', label: 'Reorder level', type: 'number', step: 'any', defaultValue: editing?.reorderLevel ?? '' },
            { name: 'trackedByBatch', label: 'Tracked by batch', type: 'checkbox', defaultValue: editing?.trackedByBatch ? 1 : '' },
            { name: 'active', label: 'Active', type: 'checkbox', defaultValue: editing ? (editing.active ? 1 : '') : 1 },
          ]}
        />
      </div>

      <Section title="All items">
        <TableWrap>
          <table className="data">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Category</th>
                <th>UoM</th>
                <th className="num">Standard cost</th>
                <th className="num">Reorder level</th>
                <th className="num">Balance</th>
                <th>Batch?</th>
                <th>Active</th>
                <th className="no-print" />
              </tr>
            </thead>
            <tbody>
              {snap.items.map((i) => (
                <tr key={i.id}>
                  <td className="font-medium">{i.code}</td>
                  <td>{i.name}</td>
                  <td className="text-muted">{i.category}</td>
                  <td className="text-muted">{i.baseUom}</td>
                  <td className="num">{money(i.standardCost)}</td>
                  <td className="num text-muted">{i.reorderLevel !== null ? qty(i.reorderLevel) : '—'}</td>
                  <td className="num font-medium">{qty(balances.get(i.code)?.balance ?? 0)}</td>
                  <td>
                    <StatusBadge status={i.trackedByBatch ? 'Yes' : 'No'} />
                  </td>
                  <td>
                    <StatusBadge status={i.active ? 'Yes' : 'No'} />
                  </td>
                  <td className="no-print">
                    <Link href={`/masters/items?edit=${i.id}`} className="btn-ghost btn-sm">
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
