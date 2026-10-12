/**
 * Balai-Reserve Database Migration
 * Run: node src/database/migrate.js
 */
'use strict';

require('dotenv').config();
const Database = require('better-sqlite3');
const fs       = require('fs');
const path     = require('path');

const DB_PATH = process.env.DB_PATH || './src/database/balai_reserve.db';
const dbDir   = path.dirname(DB_PATH);

// Create database directory if needed
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

console.log(`[Migrate] Using database: ${path.resolve(DB_PATH)}`);

const db = new Database(DB_PATH);

// Enable WAL mode and foreign keys
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Read and execute schema
const schemaPath = path.join(__dirname, 'schema.sql');
const schema     = fs.readFileSync(schemaPath, 'utf8');

// Execute each statement individually (better-sqlite3 exec handles multi-statement)
try {
  db.exec(schema);
  console.log('[Migrate] Schema applied successfully.');
} catch (err) {
  console.error('[Migrate] Error applying schema:', err.message);
  process.exit(1);
}

db.close();
console.log('[Migrate] Done.');
