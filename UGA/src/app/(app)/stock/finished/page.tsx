import { BarList } from '@/components/charts';
import { Badge, Card, PageHeader, Section, Stat, StatGrid, TableWrap } from '@/components/ui';
import { finishedGoods, loadSnapshot } from '@/lib/core';
import { money, qty } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function FinishedGoodsPage() {
  const snap = await loadSnapshot();
  const rows = finishedGoods(snap);

  const produced = rows.reduce((a, r) => a + r.produced, 0);
  const dispatched = rows.reduce((a, r) => a + r.dispatched, 0);
  const inStock = rows.reduce((a, r) => a + r.inStock, 0);
  const value = rows.reduce((a, r) => a + r.valueOnHand, 0);

  return (
    <>
      <PageHeader
        title="Finished Goods Stock"
        subtitle="Finished brushes produced at PACK, dispatched, and remaining on hand. Valued at the standard cost held in the Item Master."
        badge={<Badge tone="info">View only</Badge>}
      />

      <StatGrid cols={4}>
        <Stat label="Produced" value={qty(produced)} />
        <Stat label="Dispatched" value={qty(dispatched)} />
        <Stat label="In stock" value={qty(inStock)} tone={inStock < 0 ? 'danger' : 'neutral'} />
        <Stat label="Value on hand" value={money(value)} hint="UGX at standard cost" />
      </StatGrid>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Section title="By product" className="lg:col-span-3">
          <TableWrap>
            <table className="data">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="num">Produced</th>
                  <th className="num">Dispatched</th>
                  <th className="num">In stock</th>
                  <th className="num">Rejected at QC</th>
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
                    <td className="num">{qty(r.produced)}</td>
                    <td className="num">{qty(r.dispatched)}</td>
                    <td className={`num font-semibold ${r.inStock < 0 ? 'text-danger' : ''}`}>
                      {qty(r.inStock)}
                    </td>
                    <td className="num text-muted">{qty(r.rejected)}</td>
                    <td className="num">{money(r.valueOnHand)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td className="num">{qty(produced)}</td>
                  <td className="num">{qty(dispatched)}</td>
                  <td className="num">{qty(inStock)}</td>
                  <td className="num">{qty(rows.reduce((a, r) => a + r.rejected, 0))}</td>
                  <td className="num">{money(value)}</td>
                </tr>
              </tfoot>
            </table>
          </TableWrap>
        </Section>

        <Section title="Stock on hand" className="lg:col-span-2">
          <Card>
            <BarList
              data={rows.map((r) => ({
                label: `${r.code} ${r.name}`,
                value: r.inStock,
                display: qty(r.inStock),
                sub: `${qty(r.produced)} produced · ${qty(r.dispatched)} dispatched`,
              }))}
            />
          </Card>
        </Section>
      </div>
    </>
  );
}
