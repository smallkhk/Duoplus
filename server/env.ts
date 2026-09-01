/**
 * Load `.env` from the working directory into process.env.
 *
 * Imported first in server/index.ts so it runs before any module reads
 * configuration. Written by hand rather than pulling in a dependency: the
 * server bundles to a single dependency-free file, and this is twenty lines.
 *
 * Real environment variables always win, so a host that sets them itself
 * (cPanel's Node.js app UI, systemd, Docker) is never overridden by a stale
 * file left in the directory.
 */
import fs from 'node:fs'
import path from 'node:path'

const ENV_PATH = process.env.MADOVA_ENV_FILE ?? path.join(process.cwd(), '.env')

function parse(contents: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const eq = line.indexOf('=')
    if (eq === -1) continue

    const key = line.slice(0, eq).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue

    let value = line.slice(eq + 1).trim()
    /* Strip one layer of matching quotes, so values may contain '#' or spaces. */
    const quoted = (value.startsWith('"') && value.endsWith('"')) ||
                   (value.startsWith("'") && value.endsWith("'"))
    if (quoted && value.length >= 2) value = value.slice(1, -1)
    else value = value.split(' #')[0].trim()

    out[key] = value
  }
  return out
}

export function loadEnvFile(): { loaded: boolean; path: string; count: number } {
  let contents: string
  try {
    contents = fs.readFileSync(ENV_PATH, 'utf8')
  } catch {
    return { loaded: false, path: ENV_PATH, count: 0 }
  }

  const parsed = parse(contents)
  let count = 0
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined) {
      process.env[key] = value
      count++
    }
  }
  return { loaded: true, path: ENV_PATH, count }
}

export const envFile = loadEnvFile()
