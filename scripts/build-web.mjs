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
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

/*
 * Fail early and legibly when the build toolchain is absent. It usually is
 * because NODE_ENV=production was set during `npm install`, which makes npm
 * skip devDependencies.
 *
 * This runs before Vite is imported, and Vite is loaded dynamically below for
 * exactly that reason: a static import is resolved before any code in this file
 * executes, so the check would never get to print and the operator would see
 * ERR_MODULE_NOT_FOUND instead of the one command that fixes it.
 */
const needed = ['typescript', 'vite']
const missing = needed.filter((name) => !fs.existsSync(path.join('node_modules', name)))
if (missing.length > 0) {
  console.error(`\n  Build tooling missing: ${missing.join(', ')}`)
  console.error('')
  console.error('  These live in devDependencies, and npm skips those when')
  console.error('  NODE_ENV=production — which cPanel sets for you when the')
  console.error('  application mode is Production. Install them explicitly:\n')
  console.error('      npm install --include=dev\n')
  process.exit(1)
}

/* Typecheck first, using the local binary rather than whatever is on PATH. */
const tsc = path.join('node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc')
const check = spawnSync(tsc, ['-b'], { stdio: 'inherit' })
if (check.status !== 0) process.exit(check.status ?? 1)

process.env.NODE_ENV = 'production'

const { build } = await import('vite')
await build({ mode: 'production' })
