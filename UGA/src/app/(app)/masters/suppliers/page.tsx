import Link from 'next/link';
import { RecordForm } from '@/components/RecordForm';
import { Badge, PageHeader, Section, Stat, StatGrid, StatusBadge, TableWrap } from '@/components/ui';
import { saveSupplier } from '@/lib/actions/masters';
import { requireAdmin } from '@/lib/auth';
import { loadSnapshot, supplierScorecard } from '@/lib/core';
import { money } from '@/lib/format';
import { listOptions } from '@/lib/options';

export const dynamic = 'force-dynamic';

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  await requireAdmin();
  const { edit } = await searchParams;
  const snap = await loadSnapshot();
  const scores = new Map(supplierScorecard(snap).map((r) => [r.supplierId, r]));
  const editing = edit ? snap.suppliers.find((x) => String(x.id) === edit) : undefined;

  return (
    <>
      <PageHeader
        title="Supplier Master"
        subtitle="The canonical supplier list. Inventory Suppliers appear when recording purchases; Food, Transport and Service providers appear on the Expenses page."
        badge={<Badge tone="warn">Admin</Badge>}
        actions={
          editing ? (
            <Link href="/masters/suppliers" className="btn-secondary btn-sm">
              Cancel edit
            </Link>
          ) : null
        }
      />

      <StatGrid cols={3}>
        <Stat label="Suppliers" value={snap.suppliers.length} />
        <Stat label="Active" value={snap.suppliers.filter((x) => x.active).length} />
        <Stat
          label="Inventory suppliers"
          value={snap.suppliers.filter((x) => x.supplierType === 'Inventory Supplier').length}
        />
      </StatGrid>

      <div className="my-6">
        <RecordForm
          key={editing?.id ?? 'new'}
          action={saveSupplier}
          title={editing ? `Edit ${editing.name}` : 'Add a supplier'}
          submitLabel={editing ? 'Save changes' : 'Add supplier'}
          fields={[
            { name: 'id', label: '', type: 'hidden', defaultValue: editing?.id ?? '' },
            { name: 'code', label: 'Supplier code', type: 'text', required: true, defaultValue: editing?.code, placeholder: 'SUP07' },
            { name: 'name', label: 'Standard name', type: 'text', required: true, defaultValue: editing?.name, span: 3 },
            {
              name: 'supplierType',
              label: 'Supplier type',
              type: 'select',
              required: true,
              options: listOptions(snap, 'Supplier Type'),
              defaultValue: editing?.supplierType,
            },
            {
              name: 'categorySupplied',
              label: 'Category supplied',
              type: 'select',
              options: listOptions(snap, 'Supplier Category'),
              defaultValue: editing?.categorySupplied ?? '',
            },
            { name: 'contact', label: 'Contact', type: 'text', defaultValue: editing?.contact ?? '', span: 2 },
            { name: 'active', label: 'Active', type: 'checkbox', defaultValue: editing ? (editing.active ? 1 : '') : 1 },
          ]}
        />
      </div>

      <Section title="All suppliers">
        <TableWrap>
          <table className="data">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Type</th>
                <th>Category supplied</th>
                <th>Contact</th>
                <th className="num">Purchases</th>
                <th className="num">Total spend</th>
                <th>Active</th>
                <th className="no-print" />
              </tr>
            </thead>
            <tbody>
              {snap.suppliers.map((x) => (
                <tr key={x.id}>
                  <td className="font-medium">{x.code}</td>
                  <td>{x.name}</td>
                  <td className="text-muted">{x.supplierType}</td>
                  <td className="text-muted">{x.categorySupplied ?? '—'}</td>
                  <td className="text-muted">{x.contact ?? '—'}</td>
                  <td className="num">{scores.get(x.id)?.purchases ?? 0}</td>
                  <td className="num">{money(scores.get(x.id)?.totalCost ?? 0)}</td>
                  <td>
                    <StatusBadge status={x.active ? 'Yes' : 'No'} />
                  </td>
                  <td className="no-print">
                    <Link href={`/masters/suppliers?edit=${x.id}`} className="btn-ghost btn-sm">
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
