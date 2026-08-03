import { SettingsForm } from '@/components/SettingsForm';
import { Badge, Card, PageHeader, Section } from '@/components/ui';
import { saveSettings } from '@/lib/actions/masters';
import { requireAdmin } from '@/lib/auth';
import { loadSnapshot } from '@/lib/core';

export const dynamic = 'force-dynamic';

export default async function ReportHeaderPage() {
  await requireAdmin();
  const snap = await loadSnapshot();
  const rows = snap.reportHeader;
  const value = (key: string) => snap.brand(key) ?? '';

  return (
    <>
      <PageHeader
        title="Report Header Settings"
        subtitle="Branding printed at the top of every report and export."
        badge={<Badge tone="warn">Admin</Badge>}
      />

      <Section title="Preview">
        <Card>
          <div className="border-b border-line pb-4 text-center">
            <div className="text-2xl font-bold tracking-tight text-ink">
              {value('Brand Name') || 'UGABRUSH'}
            </div>
            <div className="text-sm italic text-muted">{value('System Name')}</div>
            <div className="mt-2 text-xs text-muted">{value('Company / Legal Name')}</div>
            <div className="text-xs text-muted">
              {[value('Address'), value('P.O Box')].filter(Boolean).join(' · ')}
            </div>
            <div className="text-xs text-muted">
              {[value('Contact Phone'), value('Email'), value('Website')].filter(Boolean).join(' · ')}
            </div>
            {value('Tagline') && (
              <div className="mt-2 text-xs italic text-faint">{value('Tagline')}</div>
            )}
          </div>
        </Card>
      </Section>

      <Section title="All settings">
        <SettingsForm rows={rows} table="report" action={saveSettings} />
      </Section>
    </>
  );
}
