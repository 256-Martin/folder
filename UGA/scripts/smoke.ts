/**
 * End-to-end smoke test.
 *
 * Signs a session cookie, then requests every page and export as an authenticated
 * admin, checking each returns 200 and contains no Next.js error markers.
 *
 *   npx tsx scripts/smoke.ts [baseUrl]
 */

import './_env';
import { SignJWT } from 'jose';

const BASE = process.argv[2] ?? 'http://localhost:3000';

const PAGES = [
  '/login',
  '/',
  '/purchases',
  '/inventory',
  '/batches',
  '/production',
  '/dispatch',
  '/meals',
  '/deductions',
  '/expenses',
  '/wip',
  '/stock/materials',
  '/stock/handles',
  '/stock/ustaples',
  '/stock/finished',
  '/labour',
  '/productivity',
  '/meals/qualification',
  '/meals/deductions',
  '/payments',
  '/scorecard',
  '/masters/items',
  '/masters/suppliers',
  '/masters/workers',
  '/masters/processes',
  '/masters/skills',
  '/masters/rates',
  '/settings',
  '/settings/meal-cost',
  '/settings/meal-rules',
  '/settings/lists',
  '/settings/accounting',
  '/settings/report-header',
  '/system/data-issues',
  '/system/audit',
  '/system/reports-log',
  '/system/voids',
  '/system/batch-renames',
  '/help',
  '/reports',
  // every report
  '/reports/wip',
  '/reports/production-operations',
  '/reports/production-potential',
  '/reports/material-stock',
  '/reports/handle-stock',
  '/reports/ustaple-stock',
  '/reports/finished-goods',
  '/reports/inventory-valuation',
  '/reports/batch-traceability',
  '/reports/direct-labour',
  '/reports/labour-by-process',
  '/reports/worker-productivity',
  '/reports/payment-statements',
  '/reports/meal-qualification',
  '/reports/meal-deductions',
  '/reports/purchases',
  '/reports/supplier-scorecard',
  '/reports/sales-dispatch',
  '/reports/financial-summary',
];

const EXPORTS = [
  '/api/export/purchases',
  '/api/export/direct-labour',
  '/api/export/meals',
  '/api/export/deductions',
  '/api/export/sales',
  '/api/export/inventory-adjustments',
  '/api/export/worker-payments',
  '/api/export/provider-payments',
  '/api/export/inventory-valuation',
];

async function session(): Promise<string> {
  const raw = process.env.AUTH_SECRET ?? 'development-only-fallback-secret-key-000000';
  const secret = new TextEncoder().encode(raw);
  const token = await new SignJWT({
    id: 1,
    email: 'muenoch@gmail.com',
    name: 'Enoch',
    role: 'ADMIN',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret);
  return `ugabrush_session=${token}`;
}

async function main() {
  const cookie = await session();
  let pass = 0;
  let fail = 0;
  const failures: string[] = [];

  console.log(`\nSmoke test against ${BASE}\n${'='.repeat(74)}`);

  for (const path of PAGES) {
    try {
      const res = await fetch(`${BASE}${path}`, { headers: { cookie }, redirect: 'manual' });

      // /login redirects to the dashboard when a valid session is presented.
      if (path === '/login' && (res.status === 307 || res.status === 302)) {
        pass++;
        console.log(`  ${res.status}  ${path}  (redirects when signed in)`);
        continue;
      }

      const body = res.status === 200 ? await res.text() : '';
      // A rendered page always ships the app shell; the dev error overlay does not.
      const rendered = body.includes('<main') || body.includes('UGABRUSH');

      if (res.status === 200 && rendered) {
        pass++;
        console.log(`  200  ${path}`);
      } else {
        fail++;
        failures.push(`${path} -> ${res.status}${res.status === 200 ? ' (did not render)' : ''}`);
        console.log(`  ${res.status}  ${path}   <-- FAIL`);
      }
    } catch (err) {
      fail++;
      failures.push(`${path} -> ${(err as Error).message}`);
      console.log(`  ERR  ${path}   ${(err as Error).message}`);
    }
  }

  console.log(`\nExports\n${'-'.repeat(74)}`);
  for (const path of EXPORTS) {
    try {
      const res = await fetch(`${BASE}${path}?month=2026-07`, {
        headers: { cookie },
        redirect: 'manual',
      });
      const text = res.status === 200 ? await res.text() : '';
      const rows = text ? text.trim().split(/\r?\n/).length - 1 : 0;
      if (res.status === 200 && text.includes('Reference ID')) {
        pass++;
        console.log(`  200  ${path.padEnd(42)} ${rows} data rows`);
      } else {
        fail++;
        failures.push(`${path} -> ${res.status}`);
        console.log(`  ${res.status}  ${path}   <-- FAIL`);
      }
    } catch (err) {
      fail++;
      failures.push(`${path} -> ${(err as Error).message}`);
      console.log(`  ERR  ${path}`);
    }
  }

  console.log(`\n${'='.repeat(74)}`);
  console.log(`${pass} passed, ${fail} failed`);
  if (failures.length) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  - ${f}`);
  }
  console.log('');
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
