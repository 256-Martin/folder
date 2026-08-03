import Link from 'next/link';
import { BarList, ColumnChart } from '@/components/charts';
import { Icon } from '@/components/icons';
import {
  Badge,
  Card,
  PageHeader,
  Section,
  StatPanel,
  StatusBadge,
  TableWrap,
} from '@/components/ui';
import {
  bottleneckStage,
  dataIssues,
  finishedGoods,
  finalPayments,
  handleStock,
  labourByProcess,
  labourByWorker,
  loadSnapshot,
  materialStock,
  mealDeductions,
  readiness,
  stockRows,
  totalOpenIssues,
  ustapleStock,
  wipTotals,
} from '@/lib/core';
import { currentMonth, monthOf, recentMonths, today, weekStart } from '@/lib/dates';
import { getSession } from '@/lib/auth';
import { SharePanel } from '@/components/SharePanel';
import { createShareLink, revokeShareLink } from '@/lib/actions/sharing';
import { listShareLinks } from '@/lib/sharing';
import { dateLong, money, qty, ugx } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const snap = await loadSnapshot();
  const month = currentMonth();
  const user = await getSession();
  const shareLinks = user?.role === 'ADMIN' ? await listShareLinks() : [];

  const stock = stockRows(snap);
  const materials = materialStock(snap);
  const handles = handleStock(snap);
  const ustaples = ustapleStock(snap);
  const fg = finishedGoods(snap);
  const wip = wipTotals(snap);
  const issues = dataIssues(snap).filter((i) => i.count > 0);
  const ready = readiness(snap);
  const payments = finalPayments(snap, month);
  const meals = mealDeductions(snap, month);
  const labour = labourByWorker(snap, month);

  const opsThisMonth = snap.operations.filter((o) => monthOf(o.date) === month);
  const acceptedMonth = opsThisMonth.reduce((a, o) => a + o.acceptedQty, 0);
  const rejectedMonth = opsThisMonth.reduce((a, o) => a + o.rejectedQty, 0);
  const labourCostMonth = opsThisMonth.reduce((a, o) => a + o.directLabourCost, 0);
  const acceptedToday = snap.operations
    .filter((o) => o.date === today())
    .reduce((a, o) => a + o.acceptedQty, 0);
  const ws = weekStart(today(), snap.weekStartsOn);
  const acceptedWeek = snap.operations
    .filter((o) => o.date >= ws && o.date <= today())
    .reduce((a, o) => a + o.acceptedQty, 0);

  const dispatchesMonth = snap.dispatches.filter((d) => monthOf(d.date) === month);
  const dispatchUnits = dispatchesMonth.reduce((a, d) => a + d.qty, 0);
  const dispatchValue = dispatchesMonth.reduce((a, d) => a + d.qty * (d.unitPrice ?? 0), 0);

  const purchasesMonth = snap.purchases.filter((p) => monthOf(p.date) === month);
  const purchaseSpend = purchasesMonth.reduce((a, p) => a + p.totalCost, 0);

  const lowStock = stock.filter((r) => r.status === 'LOW').length;
  const negativeStock = stock.filter((r) => r.status === 'NEGATIVE').length;
  const negativeWip = wip.filter((w) => w.value < 0).length;

  const mealNet = meals.reduce((a, m) => a + m.netMealDeduction, 0);
  const companyMeal = meals.reduce((a, m) => a + m.companyContribution, 0);
  const paymentsDue = payments.reduce((a, p) => a + p.finalPayment, 0);
  const balancesOwed = payments.reduce((a, p) => a + p.balanceOwed, 0);

  const topWorker = [...labour].sort((a, b) => b.acceptedThisMonth - a.acceptedThisMonth)[0];
  const topProcess = [...labourByProcess(snap)].sort((a, b) => b.accepted - a.accepted)[0];
  const topWorkerByCost = [...labour].sort((a, b) => b.costThisMonth - a.costThisMonth)[0];
  const producedMonth = snap.movements
    .filter((m) => m.movementType === 'Produced' && monthOf(m.date) === month)
    .reduce((a, m) => a + m.qty, 0);

  const stockValue = stock.reduce((a, r) => a + r.valueOnHand, 0);
  const fgValue = fg.reduce((a, f) => a + f.valueOnHand, 0);
  const workerDeductionsMonth = meals.reduce((a, m) => a + m.netMealDeduction, 0);

  /**
   * The last few things anyone recorded, across every log. Gives the dashboard
   * a sense of "what has been happening" that no single figure conveys.
   */
  const activity = [
    ...snap.purchases.map((p) => ({
      date: p.date,
      code: p.code,
      kind: 'Purchase',
      detail: `${snap.itemById.get(p.itemId)?.code ?? '—'} · ${qty(p.qty)} · ${money(p.totalCost)}`,
      href: '/purchases',
    })),
    ...snap.movements.map((m) => ({
      date: m.date,
      code: m.code,
      kind: m.movementType,
      detail: `${snap.itemById.get(m.itemId)?.code ?? '—'} · ${qty(m.qty)}`,
      href: '/inventory',
    })),
    ...snap.operations.map((o) => ({
      date: o.date,
      code: o.code,
      kind: 'Operation',
      detail: `${snap.processById.get(o.processId)?.code ?? '—'} · ${qty(o.acceptedQty)} accepted`,
      href: '/production',
    })),
    ...snap.dispatches.map((d) => ({
      date: d.date,
      code: d.code,
      kind: 'Dispatch',
      detail: `${d.destinationName} · ${qty(d.qty)}`,
      href: '/dispatch',
    })),
    ...snap.meals.map((m) => ({
      date: m.date,
      code: m.code,
      kind: 'Meal',
      detail: `${snap.workerById.get(m.workerId)?.name ?? '—'} · ${qty(m.plateCount)} plates`,
      href: '/meals',
    })),
  ]
    .sort((a, b) => (a.date === b.date ? b.code.localeCompare(a.code) : a.date < b.date ? 1 : -1))
    .slice(0, 10);

  const months = recentMonths(6).reverse();
  const spendByMonth = months.map((m) => ({
    label: m.slice(5),
    value: snap.purchases.filter((p) => monthOf(p.date) === m).reduce((a, p) => a + p.totalCost, 0),
    tooltip: ugx(
      snap.purchases.filter((p) => monthOf(p.date) === m).reduce((a, p) => a + p.totalCost, 0),
    ),
  }));

  const keyStock = [...materials, ...handles, ...ustaples].map((r) => ({
    label: `${r.code} ${r.name}`,
    value: r.balance,
    display: qty(r.balance),
    sub: r.reorderLevel !== null ? `Reorder level ${qty(r.reorderLevel)}` : undefined,
    tone:
      r.status === 'NEGATIVE'
        ? ('danger' as const)
        : r.status === 'LOW'
          ? ('warn' as const)
          : ('brand' as const),
  }));

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Live monitoring across production, inventory, labour and meals. Nothing on this page is typed — every figure is derived from recorded entries."
        badge={<Badge tone="info">{month}</Badge>}
        actions={
          <Link href="/reports" className="btn-secondary btn-sm">
            <Icon name="print" size={14} />
            Reports
          </Link>
        }
      />

      {(issues.length > 0 || ready.some((r) => !r.ready)) && (
        <div className="mb-6 grid gap-3 lg:grid-cols-2">
          {issues.length > 0 && (
            <Card className="border border-danger/40 bg-danger/5">
              <div className="mb-2 flex items-center gap-2">
                <Icon name="alert" size={16} className="text-danger" />
                <h2 className="text-sm font-semibold text-ink">
                  {totalOpenIssues(snap)} open data {totalOpenIssues(snap) === 1 ? 'issue' : 'issues'}
                </h2>
              </div>
              <ul className="space-y-1 text-sm">
                {issues.slice(0, 5).map((i) => (
                  <li key={i.check} className="flex items-baseline justify-between gap-3">
                    <span className="text-muted">{i.check}</span>
                    <span className="font-semibold tnum text-danger">{i.count}</span>
                  </li>
                ))}
              </ul>
              <Link href="/system/data-issues" className="btn-ghost btn-sm mt-3 px-0">
                Review all checks <Icon name="chevron" size={13} />
              </Link>
            </Card>
          )}

          {ready.some((r) => !r.ready) && (
            <Card className="border border-danger/40 bg-danger/5">
              <div className="mb-2 flex items-center gap-2">
                <Icon name="alert" size={16} className="text-danger" />
                <h2 className="text-sm font-semibold text-ink">Setup needs attention</h2>
              </div>
              <ul className="space-y-1 text-sm">
                {ready
                  .filter((r) => !r.ready)
                  .map((r) => (
                    <li key={r.check} className="flex items-baseline justify-between gap-3">
                      <span className="text-muted">{r.check}</span>
                      <span className="font-semibold tnum text-danger">{r.count}</span>
                    </li>
                  ))}
              </ul>
              <Link href="/masters/rates" className="btn-ghost btn-sm mt-3 px-0">
                Open Piece Rates <Icon name="chevron" size={13} />
              </Link>
            </Card>
          )}
        </div>
      )}

      <Section title="Top KPIs">
        <StatPanel
          cols={3}
          items={[
            {
              label: 'Open data issues',
              value: totalOpenIssues(snap),
              tone: totalOpenIssues(snap) > 0 ? 'warn' : 'ok',
              href: '/system/data-issues',
            },
            {
              label: 'Direct labour cost (month)',
              value: money(labourCostMonth),
              href: '/labour',
            },
            {
              label: 'Accepted units (month)',
              value: qty(acceptedMonth),
              href: '/production',
            },
            {
              label: 'Rejected units (month)',
              value: qty(rejectedMonth),
              href: '/production',
            },
            {
              label: 'Finished goods in stock',
              value: qty(fg.reduce((a, f) => a + f.inStock, 0)),
              href: '/stock/finished',
            },
            {
              label: 'Dispatches (month)',
              value: qty(dispatchUnits),
              hint: ugx(dispatchValue),
              href: '/dispatch',
            },
          ]}
        />
      </Section>

      <Section title="Alerts & money">
        <StatPanel
          cols={3}
          items={[
            {
              label: 'Low-stock items',
              value: lowStock,
              tone: lowStock > 0 ? 'warn' : 'ok',
            },
            {
              label: 'Negative stock items',
              value: negativeStock,
              tone: negativeStock > 0 ? 'danger' : 'ok',
            },
            {
              label: 'Negative WIP stages',
              value: negativeWip,
              tone: negativeWip > 0 ? 'danger' : 'ok',
            },
            {
              label: 'Worker meal deductions, net',
              value: money(mealNet),
              href: '/meals/deductions',
            },
            {
              label: 'Company meal contribution',
              value: money(companyMeal),
              href: '/meals/deductions',
            },
            {
              label: 'Final worker payments due',
              value: money(paymentsDue),
              href: '/payments',
            },
          ]}
        />
      </Section>


      <Section title="Money this month" description="Every figure below is UGX, for the current month unless stated.">
        <StatPanel
          cols={3}
          items={[
            {
              label: 'Purchase spend',
              value: money(purchaseSpend),
              hint: `${purchasesMonth.length} ${purchasesMonth.length === 1 ? 'entry' : 'entries'}`,
              href: '/purchases',
            },
            {
              label: 'Sales dispatched',
              value: money(dispatchValue),
              hint: `${qty(dispatchUnits)} units`,
              href: '/dispatch',
            },
            {
              label: 'Direct labour earned',
              value: money(labourCostMonth),
              hint: `${qty(acceptedMonth)} accepted units`,
              href: '/labour',
            },
            {
              label: 'Company meal cost',
              value: money(companyMeal),
              href: '/meals/deductions',
            },
            {
              label: 'Recovered from workers',
              value: money(workerDeductionsMonth),
              href: '/meals/deductions',
            },
            {
              label: 'Stock value on hand',
              value: money(stockValue + fgValue),
              hint: 'At standard cost, all time',
              href: '/reports/inventory-valuation',
            },
          ]}
        />
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Production snapshot">
          <Card>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
              <Field label="Accepted today" value={qty(acceptedToday)} />
              <Field label="Accepted this week" value={qty(acceptedWeek)} />
              <Field label="Accepted this month" value={qty(acceptedMonth)} />
              <Field label="Rejected this month" value={qty(rejectedMonth)} />
              <Field
                label="Rejection rate"
                value={
                  acceptedMonth + rejectedMonth > 0
                    ? `${((rejectedMonth / (acceptedMonth + rejectedMonth)) * 100).toFixed(1)}%`
                    : '—'
                }
              />
              <Field label="Operations logged" value={opsThisMonth.length} />
              <Field label="Produced into stock (month)" value={qty(producedMonth)} />
              <Field label="Bottleneck stage" value={bottleneckStage(snap)} />
              <Field
                label="Top process by output (all time)"
                value={topProcess?.accepted ? topProcess.name : '—'}
              />
            </dl>
          </Card>
        </Section>

        <Section title="Direct labour snapshot">
          <Card>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
              <Field label="Direct labour cost (MTD)" value={money(labourCostMonth)} />
              <Field label="Top worker by output" value={topWorker?.acceptedThisMonth ? topWorker.name : '—'} />
              <Field
                label="Top worker by direct labour cost (month)"
                value={topWorkerByCost?.costThisMonth ? topWorkerByCost.name : '—'}
              />
              <Field label="Rejected units (this month)" value={qty(rejectedMonth)} />
              <Field label="Final payments due" value={money(paymentsDue)} />
              <Field label="Balances owed by workers" value={money(balancesOwed)} tone={balancesOwed > 0 ? 'warn' : undefined} />
            </dl>
          </Card>
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="WIP snapshot" description="Units in line at each stage.">
          <Card>
            <BarList
              data={wip.map((w) => ({
                label: w.label,
                value: w.value,
                display: qty(w.value),
              }))}
              emptyMessage="No production operations recorded yet."
            />
          </Card>
        </Section>

        <Section title="Stock alerts" description="Key balances against reorder level.">
          <Card>
            <BarList data={keyStock} />
          </Card>
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Purchase spend by month">
          <Card>
            <ColumnChart data={spendByMonth} />
          </Card>
        </Section>

        <Section title="Finished goods">
          <TableWrap>
            <table className="data">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="num">Produced</th>
                  <th className="num">Dispatched</th>
                  <th className="num">In stock</th>
                  <th className="num">Value on hand</th>
                </tr>
              </thead>
              <tbody>
                {fg.map((f) => (
                  <tr key={f.code}>
                    <td>
                      <div className="font-medium text-ink">{f.code}</div>
                      <div className="text-xs text-muted">{f.name}</div>
                    </td>
                    <td className="num">{qty(f.produced)}</td>
                    <td className="num">{qty(f.dispatched)}</td>
                    <td className="num font-semibold">{qty(f.inStock)}</td>
                    <td className="num">{money(f.valueOnHand)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td className="num">{qty(fg.reduce((a, f) => a + f.produced, 0))}</td>
                  <td className="num">{qty(fg.reduce((a, f) => a + f.dispatched, 0))}</td>
                  <td className="num">{qty(fg.reduce((a, f) => a + f.inStock, 0))}</td>
                  <td className="num">{money(fg.reduce((a, f) => a + f.valueOnHand, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </TableWrap>
        </Section>
      </div>


      <Section
        title="Recent activity"
        description="The last ten entries recorded, across every log."
        actions={
          <Link href="/system/audit" className="btn-ghost btn-sm">
            Audit log <Icon name="chevron" size={13} />
          </Link>
        }
      >
        <TableWrap>
          <table className="data">
            <thead>
              <tr>
                <th>Date</th>
                <th>Entry</th>
                <th>Type</th>
                <th>Detail</th>
                <th className="no-print" />
              </tr>
            </thead>
            <tbody>
              {activity.map((a) => (
                <tr key={`${a.kind}-${a.code}`}>
                  <td className="whitespace-nowrap text-muted">{dateLong(a.date)}</td>
                  <td className="whitespace-nowrap font-mono text-xs">{a.code}</td>
                  <td>
                    <Badge tone="neutral">{a.kind}</Badge>
                  </td>
                  <td className="max-w-[22rem] truncate text-muted">{a.detail}</td>
                  <td className="no-print">
                    <Link href={a.href} className="btn-ghost btn-sm">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
              {activity.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-muted">
                    Nothing has been recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </TableWrap>
      </Section>

      <Section title="Setup readiness">
        <TableWrap>
          <table className="data">
            <thead>
              <tr>
                <th>Check</th>
                <th className="num">Count</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {ready.map((r) => (
                <tr key={r.check}>
                  <td>{r.check}</td>
                  <td className="num">{r.count}</td>
                  <td>
                    <StatusBadge status={r.ready ? 'READY' : 'FIX'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Section>

      {user?.role === 'ADMIN' && (
        <Section title="Sharing">
          <SharePanel create={createShareLink} revoke={revokeShareLink} links={shareLinks} />
        </Section>
      )}
    </>
  );
}

function Field({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: 'warn' | 'danger';
}) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd
        className={`mt-0.5 text-lg font-semibold tnum ${
          tone === 'warn' ? 'text-warn' : tone === 'danger' ? 'text-danger' : 'text-ink'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
