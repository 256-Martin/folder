import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Icon } from '@/components/icons';
import { PrintButton } from '@/components/PrintButton';
import { Badge, TableWrap } from '@/components/ui';
import { recordReport } from '@/lib/audit';
import { getSession } from '@/lib/auth';
import { loadSnapshot } from '@/lib/core';
import { currentMonth } from '@/lib/dates';
import { dateLong, money, percent, qty } from '@/lib/format';
import { reportBySlug } from '@/lib/reports';

export const dynamic = 'force-dynamic';

function render(value: unknown, format?: string): string {
  if (value === null || value === undefined || value === '') return '—';
  switch (format) {
    case 'money':
      return money(Number(value));
    case 'qty':
      return qty(Number(value));
    case 'percent':
      return typeof value === 'number' ? percent(value) : '—';
    default:
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return dateLong(value);
      return String(value);
  }
}

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ month?: string; preparedBy?: string }>;
}) {
  const { slug } = await params;
  const search = await searchParams;
  const report = reportBySlug(slug);
  if (!report) notFound();

  const user = await getSession();
  const snap = await loadSnapshot();
  const month = search.month ?? currentMonth();
  const rows = report.build(snap, month);
  const totals = report.totals?.(rows) ?? null;

  const preparedBy = search.preparedBy || user?.name || snap.brand('Default Prepared By') || '';

  if (user) {
    await recordReport({
      user,
      reportType: report.title,
      period: report.monthly ? month : null,
      filters: `prepared by ${preparedBy}`,
      output: 'Print View',
    });
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 no-print">
        <Link href={`/reports?month=${month}`} className="btn-ghost btn-sm px-0">
          <Icon name="chevron" size={14} className="rotate-180" />
          All reports
        </Link>
        <div className="flex items-center gap-2">
          {report.monthly && (
            <form method="get" className="flex items-end gap-2">
              <input type="hidden" name="preparedBy" value={search.preparedBy ?? ''} />
              <input
                name="month"
                type="month"
                defaultValue={month}
                className="input !py-1.5 !text-xs"
                aria-label="Reporting month"
              />
              <button type="submit" className="btn-secondary btn-sm">
                Apply
              </button>
            </form>
          )}
          <PrintButton />
        </div>
      </div>

      {/* Printed header, from Report Header Settings */}
      <header className="mb-6 border-b border-line pb-4 text-center">
        <div className="text-2xl font-bold tracking-tight text-ink">
          {snap.brand('Brand Name') ?? 'UGABRUSH'}
        </div>
        <div className="text-sm italic text-muted">{snap.brand('System Name')}</div>
        <div className="mt-1 text-xs text-muted">{snap.brand('Company / Legal Name')}</div>
        <div className="text-xs text-muted">
          {[snap.brand('Address'), snap.brand('P.O Box')].filter(Boolean).join(' · ')}
        </div>
        <div className="text-xs text-muted">
          {[snap.brand('Contact Phone'), snap.brand('Email'), snap.brand('Website')]
            .filter(Boolean)
            .join(' · ')}
        </div>

        <h1 className="mt-4 text-lg font-semibold text-ink">{report.title}</h1>
        <p className="mx-auto mt-1 max-w-2xl text-xs text-muted">{report.description}</p>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-xs text-muted">
          <span>
            <strong className="text-ink">Period:</strong>{' '}
            {report.monthly ? month : 'Current state'}
          </span>
          <span>
            <strong className="text-ink">Prepared by:</strong> {preparedBy || '—'}
          </span>
          <span>
            <strong className="text-ink">Generated:</strong>{' '}
            {new Date().toLocaleString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="card card-pad text-center text-sm text-muted">
          No data for this report in {report.monthly ? month : 'the current state'}.
        </div>
      ) : (
        <TableWrap>
          <table className="data">
            <thead>
              <tr>
                {report.columns.map((c) => (
                  <th key={c.key} className={c.align === 'right' ? 'num' : undefined}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  {report.columns.map((c) => (
                    <td key={c.key} className={c.align === 'right' ? 'num' : undefined}>
                      {render(r[c.key], c.format)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {totals && (
              <tfoot>
                <tr>
                  {report.columns.map((c, i) => (
                    <td key={c.key} className={c.align === 'right' ? 'num' : undefined}>
                      {i === 0 ? 'Total' : c.key in totals ? render(totals[c.key], c.format) : ''}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </TableWrap>
      )}

      <footer className="mt-6 border-t border-line pt-3 text-center text-2xs text-faint">
        {snap.brand('Footer Text') ?? 'Ugabrush Manufacturing System'} · v2.0 ·{' '}
        {rows.length} {rows.length === 1 ? 'row' : 'rows'}
        {snap.brand('Tagline') ? ` · ${snap.brand('Tagline')}` : ''}
      </footer>

      <div className="mt-4 no-print">
        <Badge tone="info">This generation has been written to the Report Log</Badge>
      </div>
    </>
  );
}
