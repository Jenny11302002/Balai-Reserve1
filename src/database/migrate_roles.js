/**
 * Migration: collapse 5 roles into 3 (admin, staff, customer)
 *
 * Merges reservation_staff + marketing_staff + inventory_staff → single "staff" role.
 * Reassigns every affected user, then removes the obsolete role rows.
 * Safe to run multiple times (idempotent).
 *
 * Run: node src/database/migrate_roles.js
 */
'use strict';

require('dotenv').config();
const Database = require('better-sqlite3');
const path     = require('path');

const DB_PATH = process.env.DB_PATH || './src/database/balai_reserve.db';
const db      = new Database(path.resolve(DB_PATH));
db.pragma('foreign_keys = ON');

const OLD_STAFF = ['reservation_staff', 'marketing_staff', 'inventory_staff'];

console.log('[Migrate Roles] Starting…');

const run = db.transaction(() => {
  // 1. Ensure the unified "staff" role exists
  db.prepare(`INSERT OR IGNORE INTO roles (name, label) VALUES ('staff', 'Staff')`).run();
  const staffRole = db.prepare(`SELECT id FROM roles WHERE name = 'staff'`).get();
  if (!staffRole) throw new Error('Failed to create staff role.');

  // 2. Ensure admin label is normalised (optional cosmetic)
  db.prepare(`UPDATE roles SET label='Administrator' WHERE name='admin'`).run();
  db.prepare(`UPDATE roles SET label='Customer / Guest' WHERE name='customer'`).run();

  // 3. Reassign every user on an old staff role → staff
  for (const oldName of OLD_STAFF) {
    const oldRole = db.prepare(`SELECT id FROM roles WHERE name = ?`).get(oldName);
    if (!oldRole) continue;

    const affected = db.prepare(`UPDATE users SET role_id = ?, updated_at = datetime('now') WHERE role_id = ?`)
      .run(staffRole.id, oldRole.id);
    if (affected.changes > 0) {
      console.log(`[Migrate Roles]  reassigned ${affected.changes} user(s) from ${oldName} → staff`);
    }

    // 4. Delete the obsolete role row (only after users are reassigned)
    db.prepare(`DELETE FROM roles WHERE id = ?`).run(oldRole.id);
    console.log(`[Migrate Roles]  removed role: ${oldName}`);
  }

  // 5. Safety net — any user whose role_id no longer resolves gets moved to staff
  const orphans = db.prepare(`
    UPDATE users SET role_id = ?
    WHERE role_id NOT IN (SELECT id FROM roles)
  `).run(staffRole.id);
  if (orphans.changes > 0) {
    console.log(`[Migrate Roles]  reassigned ${orphans.changes} orphaned user(s) → staff`);
  }
});

run();

// Report the final state
console.log('\n[Migrate Roles] Final roles:');
db.prepare(`SELECT r.id, r.name, r.label, COUNT(u.id) AS users
            FROM roles r LEFT JOIN users u ON u.role_id = r.id
            GROUP BY r.id ORDER BY r.id`).all()
  .forEach(r => console.log(`   #${r.id}  ${r.name}  (${r.label})  — ${r.users} user(s)`));

db.close();
console.log('\n[Migrate Roles] Done.');
