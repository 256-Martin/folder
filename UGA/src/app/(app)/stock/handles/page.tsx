import { StockView } from '@/components/StockView';
import { handleStock, loadSnapshot } from '@/lib/core';

export const dynamic = 'force-dynamic';

export default async function HandleStockPage() {
  const snap = await loadSnapshot();

  return (
    <StockView
      title="Handle Stock Summary"
      subtitle="Wooden handles. Produced at CUT from timber, or purchased ready-made, then issued to tufting."
      rows={handleStock(snap)}
      note="Received counts purchased handles; Produced counts handles created by a CUT operation. Both feed the same balance."
    />
  );
}
