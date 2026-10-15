#!/usr/bin/env node
/**
 * Build script for the PPC Poker Tools monorepo.
 * Builds range-editor, poker-trainer and postflop-trainer, then combines outputs into dist/:
 *   dist/           ← hub (index.html + logo)
 *   dist/editor/    ← range-editor build
 *   dist/trainer/   ← poker-trainer build
 *   dist/postflop/  ← postflop-trainer build
 *   dist/equity/    ← equity-calc build
 *   dist/tournoi/   ← hu-tournament build
 */

import { execSync }                  from 'child_process';
import { cpSync, mkdirSync, rmSync } from 'fs';
import { resolve, dirname }          from 'path';
import { fileURLToPath }             from 'url';

const ROOT = dirname(fileURLToPath(import.meta.url));

function run(cmd, cwd = ROOT) {
  console.log(`\n▶ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd });
}

// 1. Clean
rmSync(resolve(ROOT, 'dist'), { recursive: true, force: true });
mkdirSync(resolve(ROOT, 'dist'), { recursive: true });

// 2. Install deps (CI environments)
run('npm install', resolve(ROOT, 'range-editor'));
run('npm install', resolve(ROOT, 'poker-trainer'));
run('npm install', resolve(ROOT, 'postflop-trainer'));
run('npm install', resolve(ROOT, 'equity-calc'));
run('npm install', resolve(ROOT, 'hu-tournament'));

// 3. Build apps
run('npm run build', resolve(ROOT, 'range-editor'));
run('npm run build', resolve(ROOT, 'poker-trainer'));
run('npm run build', resolve(ROOT, 'postflop-trainer'));
run('npm run build', resolve(ROOT, 'equity-calc'));
run('npm run build', resolve(ROOT, 'hu-tournament'));

// 4. Combine outputs
cpSync(resolve(ROOT, 'range-editor',    'dist'), resolve(ROOT, 'dist', 'editor'),   { recursive: true });
cpSync(resolve(ROOT, 'poker-trainer',   'dist'), resolve(ROOT, 'dist', 'trainer'),  { recursive: true });
cpSync(resolve(ROOT, 'postflop-trainer','dist'), resolve(ROOT, 'dist', 'postflop'), { recursive: true });
cpSync(resolve(ROOT, 'equity-calc',     'dist'), resolve(ROOT, 'dist', 'equity'),   { recursive: true });
cpSync(resolve(ROOT, 'hu-tournament',   'dist'), resolve(ROOT, 'dist', 'tournoi'),  { recursive: true });
cpSync(resolve(ROOT, 'hub'), resolve(ROOT, 'dist'), { recursive: true });

console.log('\n✅ Build complete → dist/');
