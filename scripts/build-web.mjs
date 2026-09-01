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

process.env.NODE_ENV = 'production'

await build({ mode: 'production' })
