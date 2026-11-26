/** Supabase charge pg_safeupdate : un UPDATE ou un DELETE sans WHERE est refusé, même dans une fonction. PGlite ne le fait pas, d'où ce contrôle. */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dir = new URL('../supabase/', import.meta.url);
const files = readdirSync(dir).filter(f => f.endsWith('.sql'));

describe('pg_safeupdate', () => {
  it.each(files)('%s : chaque UPDATE et DELETE a un WHERE', f => {
    const sql = readFileSync(new URL(f, dir), 'utf8').replace(/--.*$/gm, '');
    const bad = [...sql.matchAll(/\b(update\s+(?:only\s+)?[\w.]+(?:\s+(?!set\b)\w+)?\s+set\b|delete\s+from\b)[^;]*;/gi)]
      .map(m => m[0])
      .filter(s => !/\bwhere\b/i.test(s))
      .map(s => s.replace(/\s+/g, ' ').slice(0, 90));
    expect(bad).toEqual([]);
  });
});
