import Link from 'next/link';
import { db } from '@/db';
import * as s from '@/db/schema';
import { Icon } from '@/components/icons';
import { MappingForm } from '@/components/MappingForm';
import { Badge, Callout, PageHeader, Section, Stat, StatGrid } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AccountingSettingsPage() {
  await requireAdmin();
  const rows = await db.select().from(s.accountingMapping);
  const sorted = [...rows].sort((a, b) => a.sortOrder - b.sortOrder);
  const incomplete = sorted.filter((r) => !r.debitAccount || !r.creditAccount).length;

  return (
    <>
      <PageHeader
        title="Accounting Export Settings"
        subtitle="Maps each system event to a debit and credit account. These mappings drive every accounting CSV export."
        badge={<Badge tone="warn">Admin</Badge>}
        actions={
          <Link href="/reports" className="btn-secondary btn-sm">
            <Icon name="download" size={14} />
            Go to exports
          </Link>
        }
      />

      <StatGrid cols={3}>
        <Stat label="Mapping keys" value={sorted.length} />
        <Stat label="Fully mapped" value={sorted.length - incomplete} tone="ok" />
        <Stat label="Incomplete" value={incomplete} tone={incomplete ? 'warn' : 'ok'} />
      </StatGrid>

      <Section className="mt-6">
        <MappingForm rows={sorted} />
      </Section>

      <Callout tone="info" title="How exports use these">
        Each exported line carries the debit and credit account for its mapping key, so the CSV can
        be imported straight into your ledger. Mapping keys themselves are fixed — they are the
        events the system knows how to emit — but the account names are yours to set.
      </Callout>
    </>
  );
}
