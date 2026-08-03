/** Display formatting. The system is single-currency (UGX). */

export const CURRENCY = 'UGX';

export function money(v: number | null | undefined, opts?: { decimals?: number }): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  const decimals = opts?.decimals ?? 0;
  return v.toLocaleString('en-UG', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function ugx(v: number | null | undefined, opts?: { decimals?: number }): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return `${CURRENCY} ${money(v, opts)}`;
}

/** Quantities: show decimals only when the value actually has them. */
export function qty(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  const rounded = Math.round(v * 1000) / 1000;
  return Number.isInteger(rounded)
    ? rounded.toLocaleString('en-UG')
    : rounded.toLocaleString('en-UG', { maximumFractionDigits: 3 });
}

export function percent(v: number | null | undefined, decimals = 1): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return `${(v * 100).toFixed(decimals)}%`;
}

export function dateLong(v: string | Date | null | undefined): string {
  if (!v) return '—';
  const d = typeof v === 'string' ? new Date(`${v.slice(0, 10)}T00:00:00Z`) : v;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function dateShort(v: string | Date | null | undefined): string {
  if (!v) return '—';
  const d = typeof v === 'string' ? new Date(`${v.slice(0, 10)}T00:00:00Z`) : v;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  });
}

export function dateTime(v: string | Date | null | undefined): string {
  if (!v) return '—';
  const d = typeof v === 'string' ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function titleCase(v: string): string {
  return v.replace(/\w\S*/g, (t) => t[0].toUpperCase() + t.slice(1).toLowerCase());
}
