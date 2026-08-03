'use client';

import clsx from 'clsx';
import { useState } from 'react';

/**
 * Single-series chart primitives.
 *
 * Every chart here plots one measure, so identity never rides on hue: the row
 * label carries it. Status hues (ok / warn / danger) are reserved and always
 * ship beside a text label, never alone.
 */

type BarDatum = {
  label: string;
  value: number;
  /** Optional secondary line under the label. */
  sub?: string;
  tone?: 'brand' | 'ok' | 'warn' | 'danger';
  /** Rendered instead of the raw number at the end of the row. */
  display?: string;
};

const FILL: Record<string, string> = {
  brand: 'bg-brand',
  ok: 'bg-ok',
  warn: 'bg-warn',
  danger: 'bg-danger',
};

export function BarList({
  data,
  emptyMessage = 'Nothing to show yet.',
  showNegative = true,
}: {
  data: BarDatum[];
  emptyMessage?: string;
  showNegative?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);

  if (!data.length) {
    return <p className="py-6 text-center text-sm text-muted">{emptyMessage}</p>;
  }

  const max = Math.max(...data.map((d) => Math.abs(d.value)), 1);

  return (
    <ul className="space-y-2.5">
      {data.map((d, i) => {
        const negative = d.value < 0;
        const pct = Math.min(100, (Math.abs(d.value) / max) * 100);
        const tone = d.tone ?? (negative && showNegative ? 'danger' : 'brand');

        return (
          <li
            key={`${d.label}-${i}`}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            className="group"
          >
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="truncate text-sm text-ink">{d.label}</span>
              <span
                className={clsx(
                  'shrink-0 text-sm font-semibold tnum',
                  negative ? 'text-danger' : 'text-ink',
                )}
              >
                {d.display ?? d.value.toLocaleString('en-UG')}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-line/70">
              <div
                className={clsx(
                  'h-full rounded-r-[4px] transition-all duration-300',
                  FILL[tone],
                  hover === i && 'opacity-90',
                )}
                style={{ width: `${Math.max(pct, d.value === 0 ? 0 : 2)}%` }}
              />
            </div>
            {d.sub && <div className="mt-1 text-2xs text-faint">{d.sub}</div>}
          </li>
        );
      })}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */

type ColumnDatum = { label: string; value: number; tooltip?: string };

export function ColumnChart({
  data,
  height = 150,
  emptyMessage = 'No data for this period.',
}: {
  data: ColumnDatum[];
  height?: number;
  emptyMessage?: string;
}) {
  // Formatting happens on the server and arrives as `tooltip`; a formatter
  // function cannot cross the server/client boundary.
  const valueFormatter = (v: number) => v.toLocaleString('en-UG');
  const [hover, setHover] = useState<number | null>(null);

  if (!data.length || data.every((d) => d.value === 0)) {
    return <p className="py-6 text-center text-sm text-muted">{emptyMessage}</p>;
  }

  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div>
      <div className="relative flex items-end gap-2" style={{ height }}>
        {data.map((d, i) => {
          const pct = (d.value / max) * 100;
          return (
            <div
              key={`${d.label}-${i}`}
              className="relative flex flex-1 flex-col justify-end"
              style={{ height: '100%' }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              {hover === i && (
                <div className="absolute -top-1 left-1/2 z-20 w-max -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs shadow-pop">
                  <div className="font-medium text-ink">{d.label}</div>
                  <div className="tnum text-muted">{d.tooltip ?? valueFormatter(d.value)}</div>
                </div>
              )}
              <div
                className={clsx(
                  'w-full rounded-t-[4px] bg-brand transition-all duration-300',
                  hover === i ? 'opacity-100' : 'opacity-85',
                )}
                style={{ height: `${Math.max(pct, d.value > 0 ? 2 : 0)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2 border-t border-line pt-2">
        {data.map((d, i) => (
          <div key={`${d.label}-label-${i}`} className="flex-1 text-center text-2xs text-faint">
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}
