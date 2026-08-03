import { SettingsForm } from '@/components/SettingsForm';
import { Badge, Callout, PageHeader, Section, Stat, StatGrid } from '@/components/ui';
import { saveSettings } from '@/lib/actions/masters';
import { requireAdmin } from '@/lib/auth';
import { loadSnapshot } from '@/lib/core';
import { currentMonth } from '@/lib/dates';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  await requireAdmin();
  const snap = await loadSnapshot();

  const toConfirm = snap.settings.filter((x) => String(x.value ?? '').includes('TO CONFIRM'));
  const blocksRate = (snap.setting('Allow operation without piece rate') ?? 'No').toLowerCase() === 'no';
  const enforceSkills =
    (snap.setting('Enforce Worker Process Assignment?') ?? 'No').toLowerCase() === 'yes';

  return (
    <>
      <PageHeader
        title="System Settings"
        subtitle="Parameters that change how the system behaves. Every change is written to the Audit Log."
        badge={<Badge tone="warn">Admin</Badge>}
      />

      <StatGrid cols={4}>
        <Stat label="Current month" value={currentMonth()} />
        <Stat label="Currency" value={snap.setting('Currency') ?? 'UGX'} />
        <Stat
          label="Entry without piece rate"
          value={blocksRate ? 'Blocked' : 'Allowed'}
          tone={blocksRate ? 'warn' : 'neutral'}
        />
        <Stat
          label="Still TO CONFIRM"
          value={toConfirm.length}
          tone={toConfirm.length ? 'warn' : 'ok'}
        />
      </StatGrid>

      <Section className="mt-6">
        <SettingsForm rows={snap.settings} table="app" action={saveSettings} />
      </Section>

      <div className="grid gap-3 lg:grid-cols-2">
        <Callout tone={blocksRate ? 'warn' : 'info'} title="Allow operation without piece rate">
          Currently <strong>{blocksRate ? 'No' : 'Yes'}</strong>. When set to No, an operation whose
          process × product has no rate is refused. This is deliberate — it stops unpaid work being
          logged — but it also means blank rates silently halt production recording.
        </Callout>
        <Callout tone="info" title="Enforce Worker Process Assignment">
          Currently <strong>{enforceSkills ? 'Yes' : 'No'}</strong>. When Yes, production can only be
          recorded for a worker who is assigned to that process under Master Data → Worker Skills.
        </Callout>
      </div>
    </>
  );
}
