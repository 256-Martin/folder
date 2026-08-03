import { Callout } from '@/components/ui';
import { StockView } from '@/components/StockView';
import { loadSnapshot, ustapleStock } from '@/lib/core';
import { qty } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function UstapleStockPage() {
  const snap = await loadSnapshot();
  const rows = ustapleStock(snap);

  const perBrush = Number(snap.setting('U-staples per brush'));
  const balance = rows[0]?.balance ?? 0;
  const supported = Number.isFinite(perBrush) && perBrush > 0 ? balance / perBrush : null;

  return (
    <>
      <StockView
        title="U-Staple Stock Summary"
        subtitle="U-staple wire, produced at USMAKE from old car tires and issued to tufting."
        rows={rows}
      />

      <Callout tone={supported === null ? 'warn' : 'info'} title="Brushes supported (estimate)">
        {supported === null ? (
          <>
            Set <strong>U-staples per brush</strong> under Settings to estimate how many brushes the
            current balance can support. It is still marked TO CONFIRM.
          </>
        ) : (
          <>
            At {qty(perBrush)} staples per brush, the current balance of {qty(balance)} supports
            approximately <strong>{qty(Math.floor(supported))}</strong> brushes.
          </>
        )}
      </Callout>
    </>
  );
}
