/** Builders for the dropdowns, sourced from masters and the Lists tab. */

import type { Option } from '@/components/RecordForm';
import type { Snapshot } from './core';

export function itemOptions(
  snap: Snapshot,
  filter?: (category: string, code: string) => boolean,
): Option[] {
  return snap.items
    .filter((i) => i.active && (!filter || filter(i.category, i.code)))
    .map((i) => ({
      value: String(i.id),
      label: `${i.code} ${i.name}`,
      group: i.category,
    }));
}

export function supplierOptions(snap: Snapshot, type?: string): Option[] {
  return snap.suppliers
    .filter((x) => x.active && (!type || x.supplierType === type))
    .map((x) => ({ value: String(x.id), label: x.name, group: x.supplierType }));
}

export function workerOptions(snap: Snapshot): Option[] {
  return snap.workers
    .filter((w) => w.active)
    .map((w) => ({ value: String(w.id), label: `${w.code} ${w.name}` }));
}

export function processOptions(snap: Snapshot): Option[] {
  return [...snap.processes]
    .filter((p) => p.active)
    .sort((a, b) => a.sequenceNo - b.sequenceNo)
    .map((p) => ({ value: String(p.id), label: `${p.code} ${p.name}` }));
}

export function listOptions(snap: Snapshot, category: string): Option[] {
  return snap.listOptions
    .filter((o) => o.category === category && o.active)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((o) => ({ value: o.value, label: o.value }));
}

export function batchOptions(snap: Snapshot, itemId?: number): Option[] {
  return snap.batches
    .filter((b) => !itemId || b.itemId === itemId)
    .map((b) => ({
      value: b.batchNo,
      label: b.batchNo,
      group: snap.itemById.get(b.itemId)?.code ?? undefined,
    }));
}

export function monthOptions(snap: Snapshot): Option[] {
  const months = new Set<string>();
  for (const p of snap.purchases) months.add(p.date.slice(0, 7));
  for (const m of snap.movements) months.add(m.date.slice(0, 7));
  for (const o of snap.operations) months.add(o.date.slice(0, 7));
  for (const m of snap.meals) months.add(m.date.slice(0, 7));
  for (const d of snap.dispatches) months.add(d.date.slice(0, 7));
  months.add(snap.month);
  return [...months]
    .sort()
    .reverse()
    .map((m) => ({ value: m, label: m }));
}

export function yesNoOptions(): Option[] {
  return [
    { value: 'Yes', label: 'Yes' },
    { value: 'No', label: 'No' },
  ];
}
