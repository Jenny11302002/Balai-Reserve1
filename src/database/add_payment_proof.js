/**
 * Migration: Add proof_image and submitted_by columns to payments table.
 * Run once: node src/database/add_payment_proof.js
 */
'use strict';
require('dotenv').config();
const db = require('../config/database');

const migrations = [
  {
    sql: 'ALTER TABLE payments ADD COLUMN proof_image TEXT DEFAULT NULL',
    name: 'proof_image',
  },
  {
    sql: "ALTER TABLE payments ADD COLUMN submitted_by TEXT DEFAULT 'staff'",
    name: 'submitted_by',
  },
  {
    // Track whether payment needs staff verification
    sql: "ALTER TABLE payments ADD COLUMN verified_by INTEGER DEFAULT NULL REFERENCES users(id)",
    name: 'verified_by',
  },
  {
    sql: "ALTER TABLE payments ADD COLUMN verified_at TEXT DEFAULT NULL",
    name: 'verified_at',
  },
];

for (const m of migrations) {
  try {
    db.exec(m.sql);
    console.log(`[Migration] Added column: ${m.name}`);
  } catch (e) {
    if (e.message.includes('duplicate column')) {
      console.log(`[Migration] Column already exists: ${m.name}`);
    } else {
      console.error(`[Migration] Error adding ${m.name}:`, e.message);
    }
  }
}

db.close();
console.log('[Migration] Done.');
