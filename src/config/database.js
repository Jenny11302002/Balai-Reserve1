/**
 * SQLite database connection singleton.
 */
'use strict';

require('dotenv').config();

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.resolve(process.env.DB_PATH || './src/database/balai_reserve.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const userColumns = db.pragma('table_info(users)');
if (userColumns.length && !userColumns.some(column => column.name === 'google_sub')) {
  db.exec('ALTER TABLE users ADD COLUMN google_sub TEXT');
}
if (userColumns.length) {
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub)');
}

module.exports = db;
