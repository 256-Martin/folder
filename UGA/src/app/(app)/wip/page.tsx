import { BarList } from '@/components/charts';
import { Badge, Callout, Card, PageHeader, Section, Stat, StatGrid, TableWrap } from '@/components/ui';
import { WIP_STAGES } from '@/lib/constants';
import { bottleneckStage, loadSnapshot, wipHandles, wipProducts, wipTotals } from '@/lib/core';
import { qty } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function WipPage() {
  const snap = await loadSnapshot();

  const handles = wipHandles(snap);
  const products = wipProducts(snap);
  const totals = wipTotals(snap);

  const handleStageKeys = WIP_STAGES.filter((s) => s.domain === 'handle').map((s) => s.key);
  const crossover = WIP_STAGES.find((s) => s.domain === 'crossover')!;
  const productStageKeys = WIP_STAGES.filter((s) => s.domain === 'product').map((s) => s.key);

  const inLine = totals.filter((t) => t.key !== 'packed').reduce((a, t) => a + t.value, 0);
  const negatives = totals.filter((t) => t.value < 0).length;

  const stageValue = (stages: { key: string; value: number }[], key: string) =>
    stages.find((s) => s.key === key)?.value ?? 0;

  return (
    <>
      <PageHeader
        title="WIP Summary"
        subtitle="Units sitting at each stage of the routing. WIP at a stage is accepted output of that process, less accepted output of the next one."
        badge={<Badge tone="info">View only</Badge>}
      />

      <StatGrid cols={4}>
        <Stat label="Total units in line" value={qty(inLine)} />
        <Stat label="Bottleneck stage" value={bottleneckStage(snap)} />
        <Stat
          label="Ready for sale"
          value={qty(totals.find((t) => t.key === 'packed')?.value ?? 0)}
          tone={(totals.find((t) => t.key === 'packed')?.value ?? 0) < 0 ? 'danger' : 'neutral'}
        />
        <Stat label="Negative stages" value={negatives} tone={negatives > 0 ? 'danger' : 'ok'} />
      </StatGrid>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Section title="Handle stages" description="By handle code." className="lg:col-span-3">
          <TableWrap>
            <table className="data">
              <thead>
                <tr>
                  <th>Handle</th>
                  {handleStageKeys.map((k) => (
                    <th key={k} className="num">
                      {WIP_STAGES.find((s) => s.key === k)?.label}
                    </th>
                  ))}
                  <th className="num">{crossover.label}</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {handles.map((h) => (
                  <tr key={h.handleCode}>
                    <td>
                      <div className="font-medium text-ink">{h.handleCode}</div>
                      <div className="text-xs text-muted">{h.handleName}</div>
                    </td>
                    {handleStageKeys.map((k) => (
                      <td key={k} className="num">
                        {qty(stageValue(h.stages, k))}
                      </td>
                    ))}
                    <td className="num">{qty(stageValue(h.stages, 'hsand'))}</td>
                    <td className="num font-semibold">{qty(h.totalInLine)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>

          <div className="mt-4">
            <Callout tone="info" title="Reported once per handle">
              BR-L and BR-CUSTOM are both built on HDL-L. Handle-stage WIP is reported per handle
              code so a large handle is counted once, not once per product that uses it.
            </Callout>
          </div>
        </Section>

        <Section title="Units by stage" className="lg:col-span-2">
          <Card>
            <BarList
              data={totals.map((t) => ({ label: t.label, value: t.value, display: qty(t.value) }))}
              emptyMessage="No production operations recorded yet."
            />
          </Card>
        </Section>
      </div>

      <Section title="Brush stages" description="By product.">
        <TableWrap>
          <table className="data">
            <thead>
              <tr>
                <th>Product</th>
                <th>Handle</th>
                {productStageKeys.map((k) => (
                  <th key={k} className="num">
                    {WIP_STAGES.find((s) => s.key === k)?.label}
                  </th>
                ))}
                <th className="num">Total in line</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.productCode}>
                  <td>
                    <div className="font-medium text-ink">{p.productCode}</div>
                    <div className="text-xs text-muted">{p.productName}</div>
                  </td>
                  <td className="text-muted">{p.handleCode}</td>
                  {productStageKeys.map((k) => {
                    const v = stageValue(p.stages, k);
                    return (
                      <td key={k} className={`num ${v < 0 ? 'font-semibold text-danger' : ''}`}>
                        {qty(v)}
                      </td>
                    );
                  })}
                  <td className="num font-semibold">{qty(p.totalInLine)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Section>

      <Callout tone="warn" title="Reading a negative stage">
        A negative figure means more units left a stage than entered it. The usual cause is stock
        movements recorded without the matching production operation — for example goods dispatched
        while no PACK operation was ever logged.
      </Callout>
    </>
  );
}
