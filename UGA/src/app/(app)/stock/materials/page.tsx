import { StockView } from '@/components/StockView';
import { loadSnapshot, materialStock } from '@/lib/core';

export const dynamic = 'force-dynamic';

export default async function MaterialStockPage() {
  const snap = await loadSnapshot();

  return (
    <StockView
      title="Material Stock Summary"
      subtitle="Raw materials and consumables — a live view of the Inventory Ledger. Every item in the Item Master appears here automatically."
      rows={materialStock(snap)}
      note="Balance is the signed sum of every ledger movement for the item. Status is NEGATIVE below zero, LOW at or under the reorder level in the Item Master, otherwise OK."
    />
  );
}
