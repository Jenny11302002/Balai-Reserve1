/**
 * Database connection singleton
 * Automatically switches between SQLite (local) and Firestore (production/Vercel)
 */
'use strict';

require('dotenv').config();

// Determine if we're in a serverless environment (Vercel) or have Firebase configured
const USE_FIRESTORE = process.env.USE_FIRESTORE === 'true' || 
                      process.env.VERCEL === '1' ||
                      (process.env.FIREBASE_ADMIN_PROJECT_ID && 
                       process.env.FIREBASE_ADMIN_CLIENT_EMAIL && 
                       process.env.FIREBASE_ADMIN_PRIVATE_KEY);

if (USE_FIRESTORE) {
  console.log('🔥 Using Firestore database');
  module.exports = require('./database-firestore');
} else {
  console.log('💾 Using SQLite database');
  
  const Database = require('better-sqlite3');
  const path     = require('path');
  const fs       = require('fs');

  const DB_PATH = process.env.DB_PATH || './src/database/balai_reserve.db';
  const dbDir   = path.dirname(path.resolve(DB_PATH));

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = new Database(path.resolve(DB_PATH));

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  module.exports = db;
}
