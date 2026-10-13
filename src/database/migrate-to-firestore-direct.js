/**
 * Direct Migration Script: SQLite to Firestore
 * Bypasses the adapter layer and migrates directly
 */
'use strict';

require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');
const { db } = require('../config/firestore');

const DB_PATH = process.env.DB_PATH || './src/database/balai_reserve.db';
const sqliteDb = new Database(path.resolve(DB_PATH));

const TABLES = [
  'roles',
  'users',
  'customers',
  'room_types',
  'rooms',
  'venues',
  'cottages',
  'event_packages',
  'reservations',
  'reservation_items',
  'events',
  'payments',
  'refund_requests',
  'guests',
  'check_ins',
  'check_outs',
  'qr_codes',
  'feedback',
  'inquiries',
  'crm_activities',
  'sales_calls',
  'marketing_emails',
  'support_tickets',
  'inventory_categories',
  'inventory_items',
  'inventory_transactions',
  'equipment',
  'equipment_assignments',
  'notifications',
  'follow_ups',
  'audit_logs',
  'ai_insights',
  'settings',
  'reservation_status_history'
];

async function migrateTable(tableName) {
  console.log(`\n📦 Migrating table: ${tableName}`);
  
  try {
    // Get all rows from SQLite
    const rows = sqliteDb.prepare(`SELECT * FROM ${tableName}`).all();
    
    if (rows.length === 0) {
      console.log(`   ⚠️  No data in ${tableName}`);
      return { success: true, count: 0 };
    }
    
    console.log(`   📊 Found ${rows.length} rows`);
    
    // Batch write to Firestore (max 500 per batch)
    const batchSize = 500;
    let totalMigrated = 0;
    
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = db.batch();
      const chunk = rows.slice(i, i + batchSize);
      
      for (const row of chunk) {
        const docRef = db.collection(tableName).doc(String(row.id));
        batch.set(docRef, row);
      }
      
      await batch.commit();
      totalMigrated += chunk.length;
      console.log(`   ✅ Migrated ${totalMigrated}/${rows.length} rows`);
    }
    
    // Update counter
    const maxId = rows.length > 0 ? Math.max(...rows.map(r => r.id || 0)) : 0;
    await db.collection('_counters').doc(tableName).set({ value: maxId });
    
    return { success: true, count: totalMigrated };
    
  } catch (error) {
    console.error(`   ❌ Error migrating ${tableName}:`, error.message);
    return { success: false, error: error.message };
  }
}

async function runMigration() {
  console.log('🚀 Starting SQLite to Firestore Migration\n');
  console.log('=' .repeat(60));
  
  const results = {
    successful: [],
    failed: [],
    totalRecords: 0
  };
  
  for (const table of TABLES) {
    const result = await migrateTable(table);
    
    if (result.success) {
      results.successful.push({ table, count: result.count });
      results.totalRecords += result.count;
    } else {
      results.failed.push({ table, error: result.error });
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 MIGRATION SUMMARY\n');
  console.log(`✅ Successful: ${results.successful.length} tables`);
  console.log(`❌ Failed: ${results.failed.length} tables`);
  console.log(`📝 Total Records Migrated: ${results.totalRecords}`);
  
  if (results.successful.length > 0) {
    console.log('\n✅ Successfully migrated tables:');
    results.successful.forEach(({ table, count }) => {
      console.log(`   - ${table}: ${count} records`);
    });
  }
  
  if (results.failed.length > 0) {
    console.log('\n❌ Failed tables:');
    results.failed.forEach(({ table, error }) => {
      console.log(`   - ${table}: ${error}`);
    });
  }
  
  console.log('\n🎉 Migration complete!');
  sqliteDb.close();
}

// Run if called directly
if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('💥 Migration failed:', error);
      sqliteDb.close();
      process.exit(1);
    });
}

module.exports = { migrateTable, runMigration };
