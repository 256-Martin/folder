import Link from 'next/link';
import { Badge, Callout, Card, PageHeader, Section, TableWrap } from '@/components/ui';
import { NAV } from '@/components/nav-config';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const STEPS = [
  {
    step: '1. Admin sets up masters',
    role: 'ADMIN',
    detail: 'Items, suppliers, workers, processes, piece rates and meal settings.',
    href: '/masters/items',
  },
  {
    step: '2. Team records daily work',
    role: 'TEAM',
    detail: 'Purchases, material issues, production operations, meals and dispatches.',
    href: '/production',
  },
  {
    step: '3. Everyone watches the views',
    role: 'ALL',
    detail: 'Dashboard, WIP, stock summaries, direct labour and meals — all live, all read-only.',
    href: '/',
  },
  {
    step: '4. Fix mistakes properly',
    role: 'ADMIN',
    detail: 'Void the entry with a reason. It is never deleted, and it can be restored.',
    href: '/system/voids',
  },
  {
    step: '5. Month-end',
    role: 'ADMIN',
    detail: 'Payment statements, valuation, financial summary and accounting CSV exports.',
    href: '/reports',
  },
];

const TERMS = [
  ['Inventory Ledger', 'The one list of every stock movement. All balances are derived from it — stock is never typed.'],
  ['Batch Register', 'One row per purchased lot, e.g. HAIR-010626-01. Gives full traceability from supplier to output.'],
  ['WIP', 'Work in progress: how many pieces sit at each stage. A stage is what entered it, less what moved on.'],
  ['Piece rate', 'Workers are paid per accepted unit. Rejected work is not paid. Rates are effective-dated.'],
  ['Meal qualification', 'Eating days earned from production. They are capped weekly and expire at week end.'],
  ['Meal deduction', 'Worker top-up on qualified plates, or the full plate cost on unqualified ones, less cash paid.'],
  ['Final worker payment', 'Gross direct labour, less meal and approved other deductions.'],
  ['Data Issues', 'Automatic checks across the system. Every count should read zero.'],
  ['Audit Log', 'Every entry, setup change, correction and void — with who did it.'],
  ['Void Register', 'Voided entries with a full snapshot, restorable at any time.'],
];

export default async function HelpPage() {
  const user = await getSession();

  return (
    <>
      <PageHeader
        title="Help & System Guide"
        subtitle="Ugabrush Manufacturing Inventory, WIP & Direct Labour System — how it fits together."
        badge={<Badge tone="brand">v2.0</Badge>}
      />

      <Section title="Start here">
        <TableWrap>
          <table className="data">
            <thead>
              <tr>
                <th>Step</th>
                <th>Who</th>
                <th>What</th>
                <th className="no-print" />
              </tr>
            </thead>
            <tbody>
              {STEPS.map((s) => (
                <tr key={s.step}>
                  <td className="font-medium">{s.step}</td>
                  <td>
                    <Badge tone={s.role === 'ADMIN' ? 'warn' : s.role === 'TEAM' ? 'ok' : 'info'}>
                      {s.role}
                    </Badge>
                  </td>
                  <td className="text-muted">{s.detail}</td>
                  <td className="no-print">
                    <Link href={s.href} className="btn-ghost btn-sm">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Section>

      <Section title="Key terms">
        <div className="grid gap-3 md:grid-cols-2">
          {TERMS.map(([term, definition]) => (
            <Card key={term}>
              <div className="text-sm font-semibold text-ink">{term}</div>
              <p className="mt-1 text-sm text-muted">{definition}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Page map" description="Every tab of the original workbook has a home here.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {NAV.map((group) => (
            <Card key={group.label}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
                {group.label}
              </h3>
              <ul className="space-y-1.5">
                {group.items.map((item) => (
                  <li key={item.href} className="text-sm">
                    <Link href={item.href} className="text-ink hover:text-brand">
                      {item.label}
                    </Link>
                    {item.sheet && (
                      <div className="text-2xs text-faint">was: {item.sheet}</div>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Roles">
        <div className="grid gap-3 md:grid-cols-3">
          <Card>
            <Badge tone="warn">ADMIN</Badge>
            <p className="mt-2 text-sm text-muted">
              Everything: master data, settings, corrections, voids, the audit log and all reports.
            </p>
          </Card>
          <Card>
            <Badge tone="ok">TEAM</Badge>
            <p className="mt-2 text-sm text-muted">
              Records daily work and reads every view. Cannot change masters or void entries.
            </p>
          </Card>
          <Card>
            <Badge tone="info">VIEW</Badge>
            <p className="mt-2 text-sm text-muted">
              Read-only across dashboards, summaries and reports. No entry forms are shown.
            </p>
          </Card>
        </div>
        {user && (
          <p className="mt-3 text-sm text-muted">
            You are signed in as <strong className="text-ink">{user.name}</strong> with the{' '}
            <strong className="text-ink">{user.role}</strong> role.
          </p>
        )}
      </Section>

      <Callout tone="info" title="Where the numbers come from">
        Nothing on a summary page is typed. Stock is the signed sum of ledger movements; WIP is the
        gap between consecutive processes; direct labour is accepted quantity times the rate in force
        on the day; meal qualification is recalculated from production every time you look at it.
        Fix the entry and every figure downstream corrects itself.
      </Callout>
    </>
  );
}
