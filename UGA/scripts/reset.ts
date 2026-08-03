/**
 * Drop every table and rebuild an empty schema.
 *
 *   npm run db:reset      (then: npm run db:push && npm run db:seed)
 *
 * This destroys all data in the target database. It refuses to run against a
 * non-local host unless CONFIRM_RESET=yes is set.
 */

import './_env';
import { Pool } from 'pg';
import { databaseUrl, explainDbError, sslConfig } from '../src/db';

async function main() {
  const url = databaseUrl();
  const { hostname, pathname } = new URL(url);
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';

  if (!isLocal && process.env.CONFIRM_RESET !== 'yes') {
    console.error(
      `Refusing to reset a remote database (${hostname}${pathname}).\n` +
        'If you really mean it, set CONFIRM_RESET=yes and run again.',
    );
    process.exit(1);
  }

  const pool = new Pool({ connectionString: url, ssl: sslConfig(url), max: 1 });
  try {
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    console.log(`Schema dropped and recreated on ${hostname}${pathname}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(`\n${explainDbError(err)}\n`);
  process.exit(1);
});
