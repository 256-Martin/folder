import { desc } from 'drizzle-orm';
import { db } from '@/db';
import * as s from '@/db/schema';
import { FilterBar } from '@/components/FilterBar';
import { InlineAction, RecordForm } from '@/components/RecordForm';
import { Badge, DataCheck, PageHeader, Section, Stat, StatGrid, StatusBadge, TableWrap } from '@/components/ui';
import { createExpense } from '@/lib/actions/transactions';
import { voidEntry } from '@/lib/actions/system';
import { getSession } from '@/lib/auth';
import { expenseChecker, loadSnapshot } from '@/lib/core';
import { monthOf, today } from '@/lib/dates';
import { dateLong, money, qty } from '@/lib/format';
import { listOptions, monthOptions, supplierOptions } from '@/lib/options';

export const dynamic = 'force-dynamic';

function statusOf(totalBill: number, amountPaid: number): string {
  if (amountPaid <= 0) return 'Unpaid';
  if (amountPaid < totalBill) return 'Partly Paid';
  return 'Paid';
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; provider?: string; category?: string }>;
}) {
  const params = await searchParams;
  const user = await getSession();
  const snap = await loadSnapshot();

  const dataCheck = expenseChecker();

  const all = await db.select().from(s.expense).orderBy(desc(s.expense.date), desc(s.expense.id));

  const rows = all.filter((e) => {
    if (params.month && e.date.slice(0, 7) !== params.month) return false;
    if (params.provider && String(e.providerId) !== params.provider) return false;
    if (params.category && e.expenseCategory !== params.category) return false;
    return true;
  });

  const live = rows.filter((r) => !r.voidedAt);
  const billed = live.reduce((a, e) => a + e.totalBill, 0);
  const paid = live.reduce((a, e) => a + e.amountPaid, 0);

  return (
    <>
      <PageHeader
        title="Expenses & Provider Payments"
        subtitle="Food provider bills, meal transport and other services. Balance and payment status are calculated for you."
        badge={<Badge tone="brand">Entry</Badge>}
      />

      {user && user.role !== 'VIEW' && (
        <div className="mb-6">
          <RecordForm
            action={createExpense}
            title="Record an expense or payment"
            submitLabel="Record expense"
            fields={[
              { name: 'date', label: 'Date', type: 'date', required: true, defaultValue: today() },
              {
                name: 'providerId',
                label: 'Provider / supplier',
                type: 'select',
                required: true,
                options: supplierOptions(snap),
              },
              {
                name: 'expenseCategory',
                label: 'Category',
                type: 'select',
                options: listOptions(snap, 'Expense Category'),
              },
              { name: 'periodFrom', label: 'Period from', type: 'date' },
              { name: 'periodTo', label: 'Period to', type: 'date' },
              { name: 'plates', label: 'Plates', type: 'number', step: 'any', help: 'For food provider bills.' },
              { name: 'plateCost', label: 'Plate cost (UGX)', type: 'number', step: 'any' },
              { name: 'totalBill', label: 'Total bill (UGX)', type: 'number', required: true, step: 'any', min: '0' },
              { name: 'amountPaid', label: 'Amount paid (UGX)', type: 'number', step: 'any', min: '0', defaultValue: 0 },
              {
                name: 'accountPaidFrom',
                label: 'Account paid from',
                type: 'select',
                options: listOptions(snap, 'Payment Account'),
              },
              {
                name: 'paymentMethod',
                label: 'Payment method',
                type: 'select',
                options: listOptions(snap, 'Payment Method'),
              },
              { name: 'transactionNo', label: 'Transaction no.', type: 'text' },
              { name: 'paidBy', label: 'Paid by', type: 'text' },
              { name: 'notes', label: 'Notes', type: 'textarea', span: 6 },
            ]}
          />
        </div>
      )}

      <StatGrid cols={4}>
        <Stat label="Entries shown" value={live.length} />
        <Stat label="Total billed" value={money(billed)} hint="UGX" />
        <Stat label="Total paid" value={money(paid)} tone="ok" />
        <Stat
          label="Outstanding balance"
          value={money(billed - paid)}
          tone={billed - paid > 0 ? 'warn' : 'ok'}
        />
      </StatGrid>

      <Section className="mt-6">
        <FilterBar
          fields={[
            { type: 'select', name: 'month', label: 'Month', value: params.month, options: monthOptions(snap) },
            {
              type: 'select',
              name: 'provider',
              label: 'Provider',
              value: params.provider,
              options: snap.suppliers.map((x) => ({ value: String(x.id), label: x.name })),
            },
            {
              type: 'select',
              name: 'category',
              label: 'Category',
              value: params.category,
              options: listOptions(snap, 'Expense Category').map((o) => ({ value: o.value, label: o.label })),
            },
          ]}
        />

        <TableWrap>
          <table className="data">
            <thead>
              <tr>
                <th>ID</th>
                <th>Date</th>
                <th>Month</th>
                <th>Provider</th>
                <th>Category</th>
                <th>Period</th>
                <th className="num">Plates</th>
                <th className="num">Plate cost</th>
                <th className="num">Total bill</th>
                <th className="num">Paid</th>
                <th className="num">Balance</th>
                <th>Status</th>
                <th>Method</th>
                <th>Transaction no.</th>
                <th>Notes</th>
                <th>Data check</th>
                {user?.role === 'ADMIN' && <th className="no-print" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className={e.voidedAt ? 'opacity-45' : undefined}>
                  <td className="whitespace-nowrap font-mono text-xs">
                    {e.code}
                    {e.voidedAt && (
                      <Badge tone="danger" className="ml-1.5">
                        Void
                      </Badge>
                    )}
                  </td>
                  <td className="whitespace-nowrap">{dateLong(e.date)}</td>
                  <td className="whitespace-nowrap font-mono text-xs text-muted">{monthOf(e.date)}</td>
                  <td className="max-w-[14rem] truncate">
                    {snap.supplierById.get(e.providerId)?.name ?? '—'}
                  </td>
                  <td className="text-muted">{e.expenseCategory ?? '—'}</td>
                  <td className="whitespace-nowrap text-2xs text-muted">
                    {e.periodFrom ? `${dateLong(e.periodFrom)} → ${dateLong(e.periodTo)}` : '—'}
                  </td>
                  <td className="num">{e.plates !== null ? qty(e.plates) : '—'}</td>
                  <td className="num text-muted">{e.plateCost !== null ? money(e.plateCost) : '—'}</td>
                  <td className="num">{money(e.totalBill)}</td>
                  <td className="num">{money(e.amountPaid)}</td>
                  <td className="num font-medium">{money(e.totalBill - e.amountPaid)}</td>
                  <td>
                    <StatusBadge status={statusOf(e.totalBill, e.amountPaid)} />
                  </td>
                  <td className="text-muted">{e.paymentMethod ?? '—'}</td>
                  <td className="text-muted">{e.transactionNo ?? '—'}</td>
                  <td className="max-w-[14rem] truncate text-muted">{e.notes ?? '—'}</td>
                  <td className="whitespace-nowrap">
                    <DataCheck value={dataCheck(e)} />
                  </td>
                  {user?.role === 'ADMIN' && (
                    <td className="no-print">
                      {!e.voidedAt && (
                        <InlineAction
                          action={voidEntry}
                          label="Void"
                          confirm="Reason for void"
                          variant="danger"
                          icon="trash"
                          fields={{ entity: 'expense', id: e.id }}
                        />
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={user?.role === 'ADMIN' ? 17 : 16} className="py-10 text-center text-muted">
                    No expenses recorded.
                  </td>
                </tr>
              )}
            </tbody>
            {live.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={8}>Total ({live.length})</td>
                  <td className="num">{money(billed)}</td>
                  <td className="num">{money(paid)}</td>
                  <td className="num">{money(billed - paid)}</td>
                  <td colSpan={user?.role === 'ADMIN' ? 6 : 5} />
                </tr>
              </tfoot>
            )}
          </table>
        </TableWrap>
      </Section>
    </>
  );
}
