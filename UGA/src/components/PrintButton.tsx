'use client';

import { Icon } from './icons';

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn-primary btn-sm">
      <Icon name="print" size={14} />
      Print / PDF
    </button>
  );
}
