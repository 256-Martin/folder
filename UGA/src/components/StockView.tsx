import { Badge, Callout, PageHeader, Section, Stat, StatGrid, StatusBadge, TableWrap } from './ui';
import { BarList } from './charts';
import { money, qty } from '@/lib/format';
import type { StockRow } from '@/lib/core';

/** Shared renderer for the four stock summary pages. */
export function StockView({
  title,
  subtitle,
  rows,
  note,
}: {
  title: string;
  subtitle: string;
  rows: StockRow[];
  note?: string;
}) {
  const low = rows.filter((r) => r.status === 'LOW').length;
  const negative = rows.filter((r) => r.status === 'NEGATIVE').length;
  const value = rows.reduce((a, r) => a + r.valueOnHand, 0);

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        badge={<Badge tone="info">View only</Badge>}
      />

      <StatGrid cols={4}>
        <Stat label="Items tracked" value={rows.length} />
        <Stat label="Low stock" value={low} tone={low > 0 ? 'warn' : 'ok'} />
        <Stat label="Negative stock" value={negative} tone={negative > 0 ? 'danger' : 'ok'} />
        <Stat label="Value on hand" value={money(value)} hint="At standard cost" />
      </StatGrid>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Section title="Balances" className="lg:col-span-3">
          <TableWrap>
            <table className="data">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Category</th>
                  <th>UoM</th>
                  <th className="num">Received</th>
                  <th className="num">Produced</th>
                  <th className="num">Issued</th>
                  <th className="num">Dispatched</th>
                  <th className="num">Balance</th>
                  <th className="num">Reorder</th>
                  <th>Status</th>
                  <th className="num">Issued this month</th>
                  <th className="num">Standard cost</th>
                  <th className="num">Value on hand</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.code}>
                    <td>
                      <div className="font-medium text-ink">{r.code}</div>
                      <div className="text-xs text-muted">{r.name}</div>
                    </td>
                    <td className="text-muted">{r.category}</td>
                    <td className="text-muted">{r.uom}</td>
                    <td className="num">{qty(r.received)}</td>
                    <td className="num">{qty(r.produced)}</td>
                    <td className="num">{qty(r.issued)}</td>
                    <td className="num">{qty(r.dispatched)}</td>
                    <td className="num font-semibold">{qty(r.balance)}</td>
                    <td className="num text-muted">{r.reorderLevel !== null ? qty(r.reorderLevel) : '—'}</td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="num text-muted">{qty(r.issuedThisMonth)}</td>
                    <td className="num text-muted">
                      {r.standardCost !== null ? money(r.standardCost, { decimals: 2 }) : '—'}
                    </td>
                    <td className="num font-medium">{money(r.valueOnHand)}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={13} className="py-10 text-center text-muted">
                      No items in this category.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </TableWrap>
        </Section>

        <Section title="Balance vs reorder level" className="lg:col-span-2">
          <div className="card card-pad">
            <BarList
              data={rows.map((r) => ({
                label: r.code,
                value: r.balance,
                display: qty(r.balance),
                sub: r.reorderLevel !== null ? `Reorder at ${qty(r.reorderLevel)}` : undefined,
                tone:
                  r.status === 'NEGATIVE' ? 'danger' : r.status === 'LOW' ? 'warn' : 'brand',
              }))}
            />
          </div>
        </Section>
      </div>

      {note && (
        <Callout tone="info" title="How this is calculated">
          {note}
        </Callout>
      )}
    </>
  );
}
