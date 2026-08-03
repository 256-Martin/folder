import Link from 'next/link';
import { Icon } from '@/components/icons';
import { Select } from '@/components/Select';
import { Badge, Card, PageHeader, Section, Stat, StatGrid } from '@/components/ui';
import { getSession } from '@/lib/auth';
import { loadSnapshot } from '@/lib/core';
import { currentMonth } from '@/lib/dates';
import { EXPORTS } from '@/lib/exports';
import { REPORTS, REPORT_GROUPS } from '@/lib/reports';
import { monthOptions } from '@/lib/options';

export const dynamic = 'force-dynamic';

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const user = await getSession();
  const snap = await loadSnapshot();
  const month = params.month ?? currentMonth();
  const months = monthOptions(snap);

  return (
    <>
      <PageHeader
        title="Reports & Print Centre"
        subtitle="Print-ready reports and accounting CSV exports. Every generation is written to the Report Log."
        badge={<Badge tone="brand">{REPORTS.length} reports</Badge>}
      />

      <StatGrid cols={3}>
        <Stat label="Reports available" value={REPORTS.length} />
        <Stat label="Accounting exports" value={EXPORTS.length} />
        <Stat label="Reporting period" value={month} />
      </StatGrid>

      <Section title="Period" className="mt-6">
        <form method="get" className="card flex flex-wrap items-end gap-3 p-3 no-print">
          <div className="min-w-[10rem]">
            <label className="label" htmlFor="month">
              Month
            </label>
            <Select id="month" name="month" defaultValue={month} options={months} includeEmpty={false} />
          </div>
          <button type="submit" className="btn-secondary btn-sm">
            Apply period
          </button>
        </form>
      </Section>

      {REPORT_GROUPS.map((group) => {
        const items = REPORTS.filter((r) => r.group === group);
        if (!items.length) return null;
        return (
          <Section key={group} title={group}>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {items.map((r) => (
                <Link
                  key={r.slug}
                  href={`/reports/${r.slug}?month=${month}`}
                  className="card card-pad group border border-transparent transition hover:border-brand/40 hover:shadow-pop"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-ink">{r.title}</h3>
                    <Icon name="chevron" size={14} className="mt-0.5 shrink-0 text-faint transition group-hover:text-brand" />
                  </div>
                  <p className="mt-1 text-xs text-muted">{r.description}</p>
                  {r.monthly && (
                    <div className="mt-2">
                      <Badge tone="info">Period: {month}</Badge>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </Section>
        );
      })}

      <Section
        title="Accounting exports"
        description="CSV files carrying the debit and credit accounts from Accounting Export Settings."
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {EXPORTS.map((e) => (
            <Card key={e.key}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-ink">{e.title}</h3>
                  <p className="mt-1 text-xs text-muted">{e.description}</p>
                  <p className="mt-2 font-mono text-2xs text-faint">{e.mappingKeys.join(' · ')}</p>
                </div>
                {user?.role !== 'VIEW' && (
                  <a
                    href={`/api/export/${e.key}?month=${month}`}
                    className="btn-secondary btn-sm shrink-0"
                    download
                  >
                    <Icon name="download" size={14} />
                    CSV
                  </a>
                )}
              </div>
            </Card>
          ))}
        </div>
      </Section>
    </>
  );
}
