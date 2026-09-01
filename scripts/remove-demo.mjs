/**
 * Remove the seeded demo account and everything it owns.
 *
 * Run once when going live:  node scripts/remove-demo.mjs
 *
 * Safe to run repeatedly. It writes a timestamped backup first, and the seeder
 * will not recreate the account because the database is no longer empty — set
 * MADOVA_SEED_DEMO=false as well if you want belt and braces.
 */
import fs from 'node:fs'
import path from 'node:path'

const DEMO_EMAIL = 'demo@madova.io'
const dataDir = process.env.MADOVA_DATA_DIR ?? path.join(process.cwd(), 'data')
const dbPath = path.join(dataDir, 'madova.json')

if (!fs.existsSync(dbPath)) {
  console.error(`No database at ${dbPath}. Set MADOVA_DATA_DIR if it lives elsewhere.`)
  process.exit(1)
}

const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'))
const demo = (db.users ?? []).find((u) => u.email?.toLowerCase() === DEMO_EMAIL)

if (!demo) {
  console.log(`No ${DEMO_EMAIL} account found — nothing to do.`)
  process.exit(0)
}

const backup = `${dbPath}.${new Date().toISOString().replace(/[:.]/g, '-')}.bak`
fs.copyFileSync(dbPath, backup)

const before = {
  users: db.users.length,
  phones: (db.phones ?? []).length,
  orders: (db.orders ?? []).length,
  threads: (db.threads ?? []).length,
}

db.users = db.users.filter((u) => u.id !== demo.id)
db.phones = (db.phones ?? []).filter((p) => p.owner_id !== demo.id)
db.orders = (db.orders ?? []).filter((o) => o.user_id !== demo.id)
db.threads = (db.threads ?? []).filter((t) => t.user_id !== demo.id)

fs.writeFileSync(dbPath, JSON.stringify(db, null, 2))

console.log(`Removed ${DEMO_EMAIL}`)
console.log(`  users   ${before.users} → ${db.users.length}`)
console.log(`  devices ${before.phones} → ${db.phones.length}`)
console.log(`  orders  ${before.orders} → ${db.orders.length}`)
console.log(`  threads ${before.threads} → ${db.threads.length}`)
console.log(`\nBackup: ${backup}`)
if (db.users.length === 0) {
  console.log('\nNote: no accounts remain, so the seeder would refill this database on the')
  console.log('next restart. Register your own account first, or set MADOVA_SEED_DEMO=false.')
}
