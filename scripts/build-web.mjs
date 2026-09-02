/**
 * Build the front end with the production React runtime, always.
 *
 * Vite picks up an ambient NODE_ENV, and some hosts export one: cPanel's Node.js
 * app sets NODE_ENV=development when its "Application mode" is Development,
 * which silently bundles React's development build — roughly double the
 * JavaScript, with dev-only warnings and slower rendering shipped to customers.
 *
 * `vite build --mode production` does not override it, so set it here. A
 * production asset build should never depend on the shell it was launched from.
 */
import { build } from 'vite'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

/*
 * Fail early and legibly when the build toolchain is absent. It usually is
 * because NODE_ENV=production was set during `npm install`, which makes npm
 * skip devDependencies — the raw symptom is "tsc: command not found", which
 * points at the wrong thing.
 */
const needed = ['typescript', 'vite']
const missing = needed.filter((name) => !fs.existsSync(path.join('node_modules', name)))
if (missing.length > 0) {
  console.error(`\n  Build tooling missing: ${missing.join(', ')}`)
  console.error('  These are devDependencies. Install them with:\n')
  console.error('      npm install --include=dev\n')
  process.exit(1)
}

/* Typecheck first, using the local binary rather than whatever is on PATH. */
const tsc = path.join('node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc')
const check = spawnSync(tsc, ['-b'], { stdio: 'inherit' })
if (check.status !== 0) process.exit(check.status ?? 1)

process.env.NODE_ENV = 'production'

await build({ mode: 'production' })
