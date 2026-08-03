import Link from 'next/link';
import { FilterBar } from '@/components/FilterBar';
import { Icon } from '@/components/icons';
import { Badge, Callout, PageHeader, Section, Stat, StatGrid, StatusBadge, TableWrap } from '@/components/ui';
import { finalPayments, loadSnapshot } from '@/lib/core';
import { money } from '@/lib/format';
import { monthOptions } from '@/lib/options';

export const dynamic = 'force-dynamic';

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const snap = await loadSnapshot();
  const month = params.month ?? snap.month;
  const rows = finalPayments(snap, month);

  const t = {
    gross: rows.reduce((a, r) => a + r.grossDirectLabour, 0),
    meal: rows.reduce((a, r) => a + r.mealDeduction, 0),
    other: rows.reduce((a, r) => a + r.otherDeductions, 0),
    total: rows.reduce((a, r) => a + r.totalDeductions, 0),
    payable: rows.reduce((a, r) => a + r.finalPayment, 0),
    owed: rows.reduce((a, r) => a + r.balanceOwed, 0),
  };

  return (
    <>
      <PageHeader
        title="Final Worker Payment"
        subtitle={`Gross direct labour less meal and approved other deductions, for ${month}.`}
        badge={<Badge tone="info">View only</Badge>}
        actions={
          <Link href={`/reports/payment-statements?month=${month}`} className="btn-secondary btn-sm">
            <Icon name="print" size={14} />
            Payment statements
          </Link>
        }
      />

      <StatGrid cols={4}>
        <Stat label="Gross direct labour" value={money(t.gross)} hint="UGX" />
        <Stat label="Total deductions" value={money(t.total)} />
        <Stat label="Payable" value={money(t.payable)} tone="ok" />
        <Stat label="Balances owed" value={money(t.owed)} tone={t.owed > 0 ? 'warn' : 'ok'} />
      </StatGrid>

      <Section className="mt-6">
        <FilterBar
          fields={[{ type: 'select', name: 'month', label: 'Month', value: params.month, options: monthOptions(snap) }]}
        />

        <TableWrap>
          <table className="data">
            <thead>
              <tr>
                <th>Worker</th>
                <th className="num">Gross direct labour</th>
                <th className="num">Meal deduction</th>
                <th className="num">Other deductions</th>
                <th className="num">Total deductions</th>
                <th className="num">Final payment</th>
                <th className="num">Balance owed</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.workerId}>
                  <td>{r.worker}</td>
                  <td className="num">{money(r.grossDirectLabour)}</td>
                  <td className="num">{money(r.mealDeduction)}</td>
                  <td className="num">{money(r.otherDeductions)}</td>
                  <td className="num">{money(r.totalDeductions)}</td>
                  <td className="num font-semibold text-ok">{money(r.finalPayment)}</td>
                  <td className={`num ${r.balanceOwed > 0 ? 'font-semibold text-warn' : ''}`}>
                    {money(r.balanceOwed)}
                  </td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td className="num">{money(t.gross)}</td>
                <td className="num">{money(t.meal)}</td>
                <td className="num">{money(t.other)}</td>
                <td className="num">{money(t.total)}</td>
                <td className="num">{money(t.payable)}</td>
                <td className="num">{money(t.owed)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </TableWrap>
      </Section>

      {t.gross === 0 && t.total > 0 && (
        <Callout tone="warn" title="Deductions without earnings">
          Workers carry a balance owed because deductions exist but no direct labour has been earned
          this month. Direct labour comes entirely from the Production Operations log.
        </Callout>
      )}
    </>
  );
}
