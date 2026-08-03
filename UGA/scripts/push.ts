/**
 * Create or update the database schema.
 *
 * Applies the SQL migrations in ./drizzle to the PostgreSQL server named by
 * DATABASE_URL.
 *
 *   npm run db:push
 */

import './_env';
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { databaseUrl, explainDbError, sslConfig } from '../src/db';

async function main() {
  const dir = path.join(process.cwd(), 'drizzle');
  if (!fs.existsSync(dir)) {
    console.error('No ./drizzle folder found. Generate migrations first:\n  npm run db:generate');
    process.exit(1);
  }

  const url = databaseUrl();
  const pool = new Pool({ connectionString: url, ssl: sslConfig(url), max: 1 });

  try {
    await migrate(drizzle(pool), { migrationsFolder: dir });
    const { hostname, pathname } = new URL(url);
    console.log(`Schema applied to ${hostname}${pathname}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(`\n${explainDbError(err)}\n`);
  process.exit(1);
});
