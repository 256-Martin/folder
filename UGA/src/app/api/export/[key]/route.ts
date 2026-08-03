import { NextResponse } from 'next/server';
import { db } from '@/db';
import * as s from '@/db/schema';
import { recordAudit, recordReport } from '@/lib/audit';
import { requireWrite } from '@/lib/auth';
import { loadSnapshot } from '@/lib/core';
import { currentMonth } from '@/lib/dates';
import { exportByKey, toCsv, type AccountLookup } from '@/lib/exports';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  context: { params: Promise<{ key: string }> },
) {
  const { key } = await context.params;
  const def = exportByKey(key);
  if (!def) return NextResponse.json({ error: 'Unknown export' }, { status: 404 });

  const user = await requireWrite();
  const url = new URL(request.url);
  const month = url.searchParams.get('month') ?? currentMonth();

  const [snap, mappings] = await Promise.all([
    loadSnapshot(),
    db.select().from(s.accountingMapping),
  ]);

  const accounts: AccountLookup = (mappingKey) => {
    const row = mappings.find((m) => m.mappingKey === mappingKey);
    return { debit: row?.debitAccount ?? '', credit: row?.creditAccount ?? '' };
  };

  const lines = def.build(snap, month, accounts);
  const csv = toCsv(lines);
  const filename = `ugabrush-${def.key}-${month}.csv`;

  await recordReport({
    user,
    action: 'EXPORT',
    reportType: `${def.title} CSV`,
    period: month,
    filters: def.mappingKeys.join(', '),
    output: filename,
  });
  await recordAudit({
    user,
    action: 'EXPORT',
    entity: 'Accounting Export',
    refId: filename,
    details: { rows: lines.length, month, mappingKeys: def.mappingKeys },
  });

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
