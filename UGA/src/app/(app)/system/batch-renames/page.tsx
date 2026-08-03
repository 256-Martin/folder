import { desc } from 'drizzle-orm';
import { db } from '@/db';
import * as s from '@/db/schema';
import { RecordForm } from '@/components/RecordForm';
import { Badge, Callout, PageHeader, Section, Stat, StatGrid, TableWrap } from '@/components/ui';
import { renameBatch } from '@/lib/actions/system';
import { requireAdmin } from '@/lib/auth';
import { loadSnapshot } from '@/lib/core';
import { dateLong, dateTime } from '@/lib/format';
import type { ActionState } from '@/components/RecordForm';

export const dynamic = 'force-dynamic';

async function renameAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  'use server';
  try {
    await renameBatch(form);
    return { ok: true, message: 'Batch renamed and every linked record updated.' };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Rename failed.' };
  }
}

export default async function BatchRenamesPage() {
  await requireAdmin();
  const snap = await loadSnapshot();
  const rows = await db.select().from(s.batchRenameLog).orderBy(desc(s.batchRenameLog.timestamp));

  return (
    <>
      <PageHeader
        title="Batch Rename Log"
        subtitle="Correcting a batch number rewrites it everywhere — the register, the ledger, the purchase and any operations that used it — and records the change here."
        badge={<Badge tone="warn">Admin</Badge>}
      />

      <StatGrid cols={2}>
        <Stat label="Renames recorded" value={rows.length} />
        <Stat label="Batches in register" value={snap.batches.length} />
      </StatGrid>

      <div className="my-6">
        <RecordForm
          action={renameAction}
          title="Rename a batch"
          description="Use this rather than editing the batch number directly, so linked records stay consistent."
          submitLabel="Rename batch"
          fields={[
            {
              name: 'oldBatchNo',
              label: 'Current batch number',
              type: 'select',
              required: true,
              options: snap.batches.map((b) => ({ value: b.batchNo, label: b.batchNo })),
              span: 2,
            },
            { name: 'newBatchNo', label: 'New batch number', type: 'text', required: true, span: 2 },
            { name: 'reason', label: 'Reason', type: 'text', required: true, span: 2 },
          ]}
        />
      </div>

      <Section title="History">
        <TableWrap>
          <table className="data">
            <thead>
              <tr>
                <th>When</th>
                <th>Item</th>
                <th>Old batch</th>
                <th>New batch</th>
                <th>Old purchase date</th>
                <th>New purchase date</th>
                <th>Source purchase</th>
                <th>Changed by</th>
                <th>Reason</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap text-xs text-muted">{dateTime(r.timestamp)}</td>
                  <td className="text-muted">{r.itemCode ?? '—'}</td>
                  <td className="font-mono text-xs">{r.oldBatchNo}</td>
                  <td className="font-mono text-xs font-medium">{r.newBatchNo}</td>
                  <td className="whitespace-nowrap text-muted">
                    {r.oldPurchaseDate ? dateLong(r.oldPurchaseDate) : '—'}
                  </td>
                  <td className="whitespace-nowrap text-muted">
                    {r.newPurchaseDate ? dateLong(r.newPurchaseDate) : '—'}
                  </td>
                  <td className="whitespace-nowrap font-mono text-xs text-muted">
                    {r.sourcePurchaseCode ?? '—'}
                  </td>
                  <td>{r.changedByName}</td>
                  <td className="text-muted">{r.reason ?? '—'}</td>
                  <td className="text-muted">{r.status}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-muted">
                    No batch renames recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </TableWrap>
      </Section>

      <Callout tone="warn" title="Batch numbers are unique">
        A rename is rejected if the new number already exists, which keeps the duplicate-batch check
        on the Data Issues page at zero.
      </Callout>
    </>
  );
}
