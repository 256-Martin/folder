import { SettingsForm } from '@/components/SettingsForm';
import { Badge, Callout, PageHeader, Section, Stat, StatGrid } from '@/components/ui';
import { saveSettings } from '@/lib/actions/masters';
import { requireAdmin } from '@/lib/auth';
import { loadSnapshot } from '@/lib/core';
import { money } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function MealCostSettingsPage() {
  await requireAdmin();
  const snap = await loadSnapshot();

  const plateCost = snap.mealNumber('Plate cost (UGX)', 2500);
  const companyTopUp = snap.mealNumber('Company top-up per qualified plate (UGX)', 1500);
  const workerCap = snap.mealNumber('Default Worker Contribution cap per qualified plate (UGX)', 1000);

  return (
    <>
      <PageHeader
        title="Meal Cost Settings"
        subtitle="Plate prices, contributions and weekly rules. Values are snapshotted onto each meal when it is recorded, so changing them never rewrites past meals."
        badge={<Badge tone="warn">Admin</Badge>}
      />

      <StatGrid cols={4}>
        <Stat label="Plate cost" value={money(plateCost)} hint="UGX, full price" />
        <Stat label="Company top-up" value={money(companyTopUp)} hint="Per qualified plate" />
        <Stat label="Worker cap" value={money(workerCap)} hint="Per qualified plate" />
        <Stat
          label="Working days per week"
          value={snap.mealSetting('Working days per week') ?? '—'}
        />
      </StatGrid>

      <Section className="mt-6">
        <SettingsForm rows={snap.mealCost} table="meal" action={saveSettings} />
      </Section>

      <Callout tone="info" title="How a plate is priced">
        A <strong>qualified</strong> plate costs the worker the lower of (plate cost − company
        contribution) and the cap — {money(Math.min(plateCost - companyTopUp, workerCap))} UGX at the
        current settings. An <strong>unqualified</strong> plate is charged at the full plate cost of{' '}
        {money(plateCost)} UGX unless the company sponsors it. Cash paid on the day reduces the
        balance carried into payroll.
      </Callout>
    </>
  );
}
