#!/usr/bin/env node
/**
 * Build script for the PPC Poker Tools monorepo.
 * Builds every app, then combines outputs into dist/:
 *   dist/           ← hub (index.html + logo)
 *   dist/editor/    ← range-editor build
 *   dist/trainer/   ← poker-trainer build
 *   dist/equity/    ← equity-calc build
 *   dist/tournoi/   ← hu-tournament build
 *   dist/initiation/ ← initiation build (cours pour débutants)
 *   dist/club/       ← club-manager build (championnats, tournois, horloge)
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
run('npm install', resolve(ROOT, 'equity-calc'));
run('npm install', resolve(ROOT, 'hu-tournament'));
run('npm install', resolve(ROOT, 'initiation'));
run('npm install', resolve(ROOT, 'club-manager'));

// 3. Build apps
run('npm run build', resolve(ROOT, 'range-editor'));
run('npm run build', resolve(ROOT, 'poker-trainer'));
run('npm run build', resolve(ROOT, 'equity-calc'));
run('npm run build', resolve(ROOT, 'hu-tournament'));
run('npm run build', resolve(ROOT, 'initiation'));
run('npm run build', resolve(ROOT, 'club-manager'));

// 4. Combine outputs
cpSync(resolve(ROOT, 'range-editor',    'dist'), resolve(ROOT, 'dist', 'editor'),   { recursive: true });
cpSync(resolve(ROOT, 'poker-trainer',   'dist'), resolve(ROOT, 'dist', 'trainer'),  { recursive: true });
cpSync(resolve(ROOT, 'equity-calc',     'dist'), resolve(ROOT, 'dist', 'equity'),   { recursive: true });
cpSync(resolve(ROOT, 'hu-tournament',   'dist'), resolve(ROOT, 'dist', 'tournoi'),  { recursive: true });
cpSync(resolve(ROOT, 'initiation',      'dist'), resolve(ROOT, 'dist', 'initiation'), { recursive: true });
cpSync(resolve(ROOT, 'club-manager',    'dist'), resolve(ROOT, 'dist', 'club'),       { recursive: true });
cpSync(resolve(ROOT, 'hub'), resolve(ROOT, 'dist'), { recursive: true });

console.log('\n✅ Build complete → dist/');
