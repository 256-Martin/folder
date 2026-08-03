/**
 * Database connection — traditional PostgreSQL over TCP (node-postgres).
 *
 * One driver for every environment: a local PostgreSQL server in development,
 * and Neon / Supabase / Railway / your own VPS in production. The only thing
 * that changes is DATABASE_URL.
 *
 * The pool is created lazily on first query and cached on globalThis, so
 * importing this module is free and Next.js hot reload does not leak pools.
 */

import { Pool, type PoolConfig } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

export type Database = NodePgDatabase<typeof schema>;

/* -------------------------------------------------------------------------- */

export function databaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set.\n\n' +
        'Point it at a PostgreSQL server, for example:\n' +
        '  DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ugabrush\n\n' +
        'See README.md for how to install PostgreSQL or start one with Docker.',
    );
  }
  return url;
}

/**
 * TLS policy.
 *   - localhost / 127.0.0.1  -> off, unless sslmode says otherwise
 *   - anything else          -> on, with certificate verification
 *
 * Set DATABASE_SSL=no-verify only if your provider uses a self-signed
 * certificate; it disables verification and should not be used casually.
 */
export function sslConfig(url: string): PoolConfig['ssl'] {
  const override = process.env.DATABASE_SSL?.trim().toLowerCase();
  if (override === 'off' || override === 'disable') return undefined;
  if (override === 'no-verify') return { rejectUnauthorized: false };

  let host = '';
  let sslmode = '';
  try {
    const parsed = new URL(url);
    host = parsed.hostname;
    sslmode = parsed.searchParams.get('sslmode') ?? '';
  } catch {
    /* fall through to the conservative default below */
  }

  if (sslmode === 'disable') return undefined;

  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  if (isLocal && sslmode !== 'require') return undefined;

  return { rejectUnauthorized: true };
}

export function createPool(): Pool {
  const url = databaseUrl();

  const pool = new Pool({
    connectionString: url,
    ssl: sslConfig(url),
    // Serverless invocations are short-lived and share Neon's pooler, so a
    // small pool avoids exhausting connections. A long-running server can hold
    // more.
    max: Number(process.env.DATABASE_POOL_MAX ?? (process.env.VERCEL ? 1 : 10)),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
    application_name: 'ugabrush',
  });

  // An idle client dropped by the server must never take the process down.
  pool.on('error', (err) => {
    console.error('[db] idle client error:', err.message);
  });

  return pool;
}

/* -------------------------------------------------------------------------- */

declare global {
  // eslint-disable-next-line no-var
  var __ugabrushPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __ugabrushDb: Database | undefined;
}

function connect(): Database {
  if (globalThis.__ugabrushDb) return globalThis.__ugabrushDb;

  const pool = globalThis.__ugabrushPool ?? createPool();
  globalThis.__ugabrushPool = pool;

  const instance = drizzle(pool, { schema });
  globalThis.__ugabrushDb = instance;
  return instance;
}

/**
 * Lazy handle. Property access opens the pool, so importing this module — during
 * `next build`, for instance — never touches the database.
 */
export const db: Database = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    const real = connect() as unknown as Record<string | symbol, unknown>;
    const value = Reflect.get(real, prop, receiver);
    return typeof value === 'function' ? value.bind(real) : value;
  },
  has(_target, prop) {
    return Reflect.has(connect() as object, prop);
  },
});

/**
 * Turn a driver failure into something actionable. node-postgres reports these
 * as terse codes; the CLI scripts print this instead.
 */
export function explainDbError(err: unknown): string {
  const e = err as { code?: string; message?: string; cause?: { code?: string } };
  const code = e?.code ?? e?.cause?.code;
  const url = process.env.DATABASE_URL?.trim() ?? '';
  let where = 'the configured server';
  try {
    const p = new URL(url);
    where = `${p.hostname}:${p.port || 5432}${p.pathname}`;
  } catch {
    /* keep the generic label */
  }

  switch (code) {
    case 'ECONNREFUSED':
      return (
        `Cannot reach PostgreSQL at ${where} — nothing is listening there.\n\n` +
        'Start a server first:\n' +
        '  • Installed locally?  Check the "postgresql-x64-<version>" Windows service is running.\n' +
        '  • Using Docker?       docker compose up -d\n' +
        '  • Not installed yet?  See "Install PostgreSQL" in README.md.'
      );
    case 'ENOTFOUND':
      return `Host not found for ${where}. Check the hostname in DATABASE_URL.`;
    case 'ETIMEDOUT':
      return `Timed out connecting to ${where}. Check the host, port and any firewall.`;
    case '28P01':
      return `Password authentication failed for ${where}. Check the user and password in DATABASE_URL.`;
    case '3D000':
      return (
        `The database in ${where} does not exist yet.\n\n` +
        'Create it once with:\n' +
        '  psql -U postgres -c "CREATE DATABASE ugabrush;"'
      );
    case '28000':
      return `The role in DATABASE_URL is not permitted to connect to ${where}.`;
    default:
      return e?.message ?? String(err);
  }
}

/** Close the pool. Used by CLI scripts so they exit cleanly. */
export async function closeDb(): Promise<void> {
  if (globalThis.__ugabrushPool) {
    await globalThis.__ugabrushPool.end();
    globalThis.__ugabrushPool = undefined;
    globalThis.__ugabrushDb = undefined;
  }
}

export { schema };
