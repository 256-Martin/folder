/**
 * Minimal .env loader so CLI scripts see the same variables as Next.js.
 * Import this first, before anything that reads process.env.
 *
 * Precedence (first file to define a key wins): .env.local, .env
 */

import fs from 'node:fs';
import path from 'node:path';

function load(file: string) {
  const full = path.join(process.cwd(), file);
  if (!fs.existsSync(full)) return;

  for (const raw of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) process.env[key] = value;
  }
}

load('.env.local');
load('.env');
