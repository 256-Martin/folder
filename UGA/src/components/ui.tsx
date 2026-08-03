import clsx from 'clsx';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon } from '@/components/icons';

/* ------------------------------------------------------------------ page --- */

export function PageHeader({
  title,
  subtitle,
  badge,
  actions,
}: {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h1>
          {badge}
        </div>
        {subtitle && <p className="mt-1 max-w-3xl text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 no-print">{actions}</div>}
    </header>
  );
}

export function Section({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={clsx('mb-6 min-w-0', className)}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            {title && (
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</h2>
            )}
            {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 no-print">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Card({
  children,
  className,
  pad = true,
}: {
  children: ReactNode;
  className?: string;
  pad?: boolean;
}) {
  return <div className={clsx('card min-w-0', pad && 'card-pad', className)}>{children}</div>;
}

/* ------------------------------------------------------------------ stat --- */

export type Tone = 'neutral' | 'ok' | 'warn' | 'danger' | 'info' | 'brand';

const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-ink',
  ok: 'text-ok',
  warn: 'text-warn',
  danger: 'text-danger',
  info: 'text-info',
  brand: 'text-brand',
};

export function Stat({
  label,
  value,
  hint,
  tone = 'neutral',
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  href?: string;
}) {
  const body = (
    <>
      <div className="text-xs font-medium text-muted">{label}</div>
      <div
        className={clsx(
          // break-words so an unusually long figure wraps inside its column
          // rather than spilling over the neighbouring one.
          'mt-1.5 break-words text-2xl font-semibold tnum tracking-tight',
          TONE_TEXT[tone],
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-faint">{hint}</div>}
    </>
  );

  if (href) {
    return (
      <Link href={href} className="card card-pad block border border-transparent transition hover:border-brand/40 hover:shadow-pop">
        {body}
      </Link>
    );
  }
  return <div className="card card-pad">{body}</div>;
}

export type StatItem = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  href?: string;
};

/**
 * Dividers between the cells of a StatPanel. The grid reflows from 1 column to
 * 2 to `cols`, so each cell needs its border recomputed at every breakpoint: a
 * cell carries a top border when it is not on the first row, and a left border
 * when it is not in the first column. Every class is written out in full so
 * Tailwind's scanner can see it.
 */
function panelDividers(i: number, cols: 2 | 3 | 4) {
  const sm = [i >= 2 ? 'sm:border-t' : 'sm:border-t-0', i % 2 !== 0 ? 'sm:border-l' : 'sm:border-l-0'];
  const lg =
    cols === 2
      ? [i >= 2 ? 'lg:border-t' : 'lg:border-t-0', i % 2 !== 0 ? 'lg:border-l' : 'lg:border-l-0']
      : cols === 3
        ? [i >= 3 ? 'lg:border-t' : 'lg:border-t-0', i % 3 !== 0 ? 'lg:border-l' : 'lg:border-l-0']
        : [i >= 4 ? 'lg:border-t' : 'lg:border-t-0', i % 4 !== 0 ? 'lg:border-l' : 'lg:border-l-0'];
  return clsx('border-line', i === 0 ? '' : 'border-t', sm, lg);
}

/**
 * The same figures as a row of `Stat` cards, but gathered into a single card and
 * separated by rules instead of gaps. Cells with an `href` stay clickable.
 */
export function StatPanel({ items, cols = 4 }: { items: StatItem[]; cols?: 2 | 3 | 4 }) {
  return (
    <div className="card overflow-hidden">
      <div
        className={clsx(
          'grid grid-cols-1 sm:grid-cols-2 [&>*]:min-w-0',
          cols === 2 && 'lg:grid-cols-2',
          cols === 3 && 'lg:grid-cols-3',
          cols === 4 && 'lg:grid-cols-4',
        )}
      >
        {items.map((item, i) => {
          const body = (
            <>
              <div className="text-xs font-medium text-muted">{item.label}</div>
              <div
                className={clsx(
                  'mt-1.5 break-words text-2xl font-semibold tnum tracking-tight',
                  TONE_TEXT[item.tone ?? 'neutral'],
                )}
              >
                {item.value}
              </div>
              {item.hint && <div className="mt-1 text-xs text-faint">{item.hint}</div>}
            </>
          );

          const dividers = panelDividers(i, cols);

          return item.href ? (
            <Link
              key={item.label}
              href={item.href}
              className={clsx(
                'group relative card-pad transition hover:bg-raised focus-visible:bg-raised',
                dividers,
              )}
            >
              {body}
              <Icon
                name="chevron"
                size={13}
                className="absolute right-3 top-3 text-faint opacity-0 transition group-hover:opacity-100"
              />
            </Link>
          ) : (
            <div key={item.label} className={clsx('card-pad', dividers)}>
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function StatGrid({ children, cols = 4 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  return (
    <div
      className={clsx(
        // Grid items default to min-width:auto, so a long unbreakable figure
        // widens its column and pushes the page sideways. min-w-0 lets the
        // column shrink and the content truncate instead.
        'grid gap-3 [&>*]:min-w-0',
        cols === 2 && 'grid-cols-1 sm:grid-cols-2',
        cols === 3 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
        cols === 4 && 'grid-cols-2 lg:grid-cols-4',
      )}
    >
      {children}
    </div>
  );
}

/* ----------------------------------------------------------------- badge --- */

const BADGE_TONE: Record<Tone, string> = {
  neutral: 'bg-raised text-muted border border-line',
  ok: 'bg-ok/10 text-ok',
  warn: 'bg-warn/10 text-warn',
  danger: 'bg-danger/10 text-danger',
  info: 'bg-info/10 text-info',
  brand: 'bg-brand/10 text-brand',
};

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return <span className={clsx('chip', BADGE_TONE[tone], className)}>{children}</span>;
}

/** The per-row Data Check cell: plain OK, or an amber badge naming the problem. */
export function DataCheck({ value }: { value: string }) {
  return value === 'OK' ? (
    <span className="text-ok">OK</span>
  ) : (
    <Badge tone="warn">{value}</Badge>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, Tone> = {
    OK: 'ok',
    LOW: 'warn',
    NEGATIVE: 'danger',
    'Not yet used': 'neutral',
    PAYABLE: 'ok',
    'BALANCE OWED': 'warn',
    Paid: 'ok',
    'Partly Paid': 'warn',
    Unpaid: 'danger',
    Approved: 'ok',
    Pending: 'warn',
    Rejected: 'danger',
    Voided: 'danger',
    Restored: 'info',
    SET: 'ok',
    'TO CONFIRM': 'warn',
    READY: 'ok',
    FIX: 'danger',
    Yes: 'ok',
    No: 'neutral',
    '—': 'neutral',
  };
  return <Badge tone={map[status] ?? 'neutral'}>{status}</Badge>;
}

/* ----------------------------------------------------------------- table --- */

export function TableWrap({ children }: { children: ReactNode }) {
  // min-w-0 matters on the scroll container itself: without it, a grid or flex
  // ancestor sizes this box to the table's full width, so overflow-x never
  // triggers and the page grows instead of the table scrolling.
  return <div className="table-wrap min-w-0">{children}</div>;
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-2 text-sm font-semibold text-ink">{title}</div>
      {message && <p className="max-w-md text-sm text-muted">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ misc --- */

export function Callout({
  tone = 'info',
  title,
  children,
}: {
  tone?: Tone;
  title?: string;
  children: ReactNode;
}) {
  const border: Record<Tone, string> = {
    neutral: 'border-line',
    ok: 'border-ok/40 bg-ok/5',
    warn: 'border-warn/40 bg-warn/5',
    danger: 'border-danger/40 bg-danger/5',
    info: 'border-info/40 bg-info/5',
    brand: 'border-brand/40 bg-brand/5',
  };
  return (
    <div className={clsx('rounded-card border px-4 py-3 text-sm', border[tone])}>
      {title && <div className="mb-0.5 font-semibold text-ink">{title}</div>}
      <div className="text-muted">{children}</div>
    </div>
  );
}

export function KeyValue({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="divide-y divide-line">
      {rows.map((r) => (
        <div key={r.label} className="flex items-baseline justify-between gap-4 py-2">
          <dt className="text-sm text-muted">{r.label}</dt>
          <dd className="text-sm font-medium tnum text-ink text-right">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Horizontal bar used in stock and WIP panels. */
export function Meter({
  value,
  max,
  tone = 'brand',
}: {
  value: number;
  max: number;
  tone?: Tone;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const bar: Record<Tone, string> = {
    neutral: 'bg-faint',
    ok: 'bg-ok',
    warn: 'bg-warn',
    danger: 'bg-danger',
    info: 'bg-info',
    brand: 'bg-brand',
  };
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
      <div className={clsx('h-full rounded-full transition-all', bar[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}
