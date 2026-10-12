/**
 * Balai-Reserve — FRESH START (production reset)
 * ----------------------------------------------
 * Wipes ALL transactional & demo data from the LIVE database while
 * keeping the essential setup:
 *
 *   KEPT:  roles, admin + staff users, room types, rooms, venues,
 *          cottages, event packages, inventory items/categories,
 *          equipment, and system settings.
 *
 *   REMOVED: every reservation, payment, guest, event, check-in/out,
 *            QR code, feedback, CRM activity, sales call, marketing
 *            email, support ticket, inquiry, notification, follow-up,
 *            inventory transaction, equipment assignment, AI insight,
 *            audit log, ALL customer accounts, and every session.
 *            Uploaded payment-proof files and generated QR images are
 *            also deleted from disk.
 *
 * After running, rooms/venues/cottages are reset to "available" and
 * inventory reserved/damaged counts are zeroed.
 *
 * Run: node src/database/fresh-start.js   (or: npm run fresh-start)
 *
 * ⚠️  This is DESTRUCTIVE and irreversible. Back up the DB first if unsure.
 */
'use strict';

require('dotenv').config();
const Database = require('better-sqlite3');
const fs   = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || './src/database/balai_reserve.db';
const db      = new Database(path.resolve(DB_PATH));
db.pragma('foreign_keys = OFF');   // disable FK checks while we truncate

console.log('[Fresh Start] Beginning production reset...');

// Tables whose rows are ALL transactional / demo → clear completely
const CLEAR_TABLES = [
  'reservation_items',
  'reservation_status_history',
  'payments',
  'check_ins',
  'check_outs',
  'qr_codes',
  'guests',
  'events',
  'feedback',
  'crm_activities',
  'sales_calls',
  'marketing_emails',
  'support_tickets',
  'inquiries',
  'notifications',
  'follow_ups',
  'inventory_transactions',
  'equipment_assignments',
  'ai_insights',
  'audit_logs',
  'reservations',
  'customers',
  'sessions',
];

const run = db.transaction(() => {
  // 1. Clear all transactional / demo tables
  for (const table of CLEAR_TABLES) {
    try {
      const info = db.prepare(`DELETE FROM ${table}`).run();
      console.log(`[Fresh Start]  cleared ${table} (${info.changes} row(s))`);
    } catch (e) {
      // Table may not exist in some deployments — non-fatal
      console.log(`[Fresh Start]  skipped ${table} (${e.message})`);
    }
  }

  // 2. Remove all CUSTOMER user accounts (keep admin + staff)
  const delUsers = db.prepare(`
    DELETE FROM users
    WHERE role_id IN (SELECT id FROM roles WHERE name = 'customer')
  `).run();
  console.log(`[Fresh Start]  removed ${delUsers.changes} customer user account(s)`);

  // 3. Reset accommodation availability
  db.prepare(`UPDATE rooms    SET status = 'available' WHERE is_active = 1`).run();
  db.prepare(`UPDATE venues   SET status = 'available' WHERE is_active = 1`).run();
  db.prepare(`UPDATE cottages SET status = 'available' WHERE is_active = 1`).run();
  console.log('[Fresh Start]  reset rooms/venues/cottages to "available"');

  // 4. Zero out inventory reserved/damaged, make everything available
  try {
    db.prepare(`UPDATE inventory_items SET available_qty = total_qty, reserved_qty = 0, damaged_qty = 0`).run();
    console.log('[Fresh Start]  reset inventory counts (all available, 0 reserved/damaged)');
  } catch { /* column set may vary */ }

  // 5. Reset equipment availability
  try {
    db.prepare(`UPDATE equipment SET available_qty = quantity`).run();
    console.log('[Fresh Start]  reset equipment availability');
  } catch { /* non-critical */ }

  // 6. Reset AUTOINCREMENT counters for the cleared tables so IDs start fresh
  const placeholders = CLEAR_TABLES.map(() => '?').join(',');
  try {
    db.prepare(`DELETE FROM sqlite_sequence WHERE name IN (${placeholders})`).run(...CLEAR_TABLES);
    console.log('[Fresh Start]  reset ID counters for cleared tables');
  } catch { /* sqlite_sequence may not track all */ }
});

run();

// 7. Delete uploaded payment-proof files and generated QR images from disk
function emptyDir(dirRel, label) {
  const dir = path.join(process.cwd(), dirRel);
  if (!fs.existsSync(dir)) return;
  let count = 0;
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    try {
      if (fs.statSync(full).isFile()) { fs.unlinkSync(full); count++; }
    } catch { /* ignore */ }
  }
  console.log(`[Fresh Start]  deleted ${count} file(s) from ${label}`);
}
emptyDir('uploads/payment_proofs', 'payment proofs');
emptyDir('public/qrcodes',         'QR codes');

db.pragma('foreign_keys = ON');

// Report final state
console.log('\n[Fresh Start] Remaining users:');
db.prepare(`
  SELECT u.first_name || ' ' || u.last_name AS name, u.email, r.name AS role
  FROM users u JOIN roles r ON r.id = u.role_id ORDER BY r.name, u.id
`).all().forEach(u => console.log(`   [${u.role}] ${u.name} — ${u.email}`));

const counts = {
  rooms:    db.prepare('SELECT COUNT(*) c FROM rooms WHERE is_active=1').get().c,
  venues:   db.prepare('SELECT COUNT(*) c FROM venues WHERE is_active=1').get().c,
  cottages: db.prepare('SELECT COUNT(*) c FROM cottages WHERE is_active=1').get().c,
  packages: db.prepare('SELECT COUNT(*) c FROM event_packages WHERE is_active=1').get().c,
  reservations: db.prepare('SELECT COUNT(*) c FROM reservations').get().c,
  customers:    db.prepare('SELECT COUNT(*) c FROM customers').get().c,
};
console.log('\n[Fresh Start] Data snapshot:');
console.log(`   active rooms=${counts.rooms}, venues=${counts.venues}, cottages=${counts.cottages}, packages=${counts.packages}`);
console.log(`   reservations=${counts.reservations}, customers=${counts.customers}  (should both be 0)`);

db.close();
console.log('\n[Fresh Start] Done. The database is clean and ready for deployment.');
