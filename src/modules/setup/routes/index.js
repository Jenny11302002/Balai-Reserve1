/**
 * ONE-TIME Database Setup Endpoint
 * Run this once to initialize Postgres with schema and seed data
 * DELETE THIS FILE after setup is complete
 */
'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();

// Use Postgres pool directly
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

router.get('/initialize-database-now', async (req, res) => {
  let pool;
  
  try {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.write('<html><body style="font-family: monospace; padding: 20px;"><h1>Database Setup</h1><pre>');
    res.write('Starting database initialization...\n\n');
    
    // Check environment
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable not found!');
    }
    res.write('✅ DATABASE_URL found\n\n');
    
    // Connect to database
    res.write('Connecting to database...\n');
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    
    // Test connection
    await pool.query('SELECT NOW()');
    res.write('✅ Connected to database\n\n');
    
    // Drop existing tables first to start fresh
    res.write('Dropping existing tables (if any)...\n');
    await pool.query(`
      DROP TABLE IF EXISTS reservation_status_history CASCADE;
      DROP TABLE IF EXISTS ai_insights CASCADE;
      DROP TABLE IF EXISTS audit_logs CASCADE;
      DROP TABLE IF EXISTS follow_ups CASCADE;
      DROP TABLE IF EXISTS notifications CASCADE;
      DROP TABLE IF EXISTS equipment_assignments CASCADE;
      DROP TABLE IF EXISTS equipment CASCADE;
      DROP TABLE IF EXISTS inventory_transactions CASCADE;
      DROP TABLE IF EXISTS inventory_items CASCADE;
      DROP TABLE IF EXISTS inventory_categories CASCADE;
      DROP TABLE IF EXISTS support_tickets CASCADE;
      DROP TABLE IF EXISTS marketing_emails CASCADE;
      DROP TABLE IF EXISTS sales_calls CASCADE;
      DROP TABLE IF EXISTS crm_activities CASCADE;
      DROP TABLE IF EXISTS inquiries CASCADE;
      DROP TABLE IF EXISTS feedback CASCADE;
      DROP TABLE IF EXISTS qr_codes CASCADE;
      DROP TABLE IF EXISTS check_outs CASCADE;
      DROP TABLE IF EXISTS check_ins CASCADE;
      DROP TABLE IF EXISTS guests CASCADE;
      DROP TABLE IF EXISTS refund_requests CASCADE;
      DROP TABLE IF EXISTS payments CASCADE;
      DROP TABLE IF EXISTS events CASCADE;
      DROP TABLE IF EXISTS reservation_items CASCADE;
      DROP TABLE IF EXISTS reservations CASCADE;
      DROP TABLE IF EXISTS event_packages CASCADE;
      DROP TABLE IF EXISTS cottages CASCADE;
      DROP TABLE IF EXISTS venues CASCADE;
      DROP TABLE IF EXISTS rooms CASCADE;
      DROP TABLE IF EXISTS room_types CASCADE;
      DROP TABLE IF EXISTS customers CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
      DROP TABLE IF EXISTS roles CASCADE;
      DROP TABLE IF EXISTS settings CASCADE;
    `);
    res.write('✅ Dropped old tables\n\n');
    
    // Create schema
    res.write('Reading schema file...\n');
    const schemaPath = path.join(__dirname, '..', '..', '..', 'database', 'schema-postgres.sql');
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found at: ${schemaPath}`);
    }
    const schema = fs.readFileSync(schemaPath, 'utf8');
    res.write(`✅ Schema file loaded (${schema.length} bytes)\n\n`);
    
    res.write('Creating tables...\n');
    // Split schema by CREATE statements and execute each separately
    const statements = schema
      .split(/;[\s\n]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    let created = 0;
    for (const statement of statements) {
      if (statement.toUpperCase().includes('CREATE TABLE')) {
        const match = statement.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/i);
        const tableName = match ? match[1] : 'unknown';
        await pool.query(statement);
        res.write(`  ✓ Created table: ${tableName}\n`);
        created++;
      } else if (statement.toUpperCase().includes('CREATE INDEX')) {
        await pool.query(statement);
      }
    }
    res.write(`✅ Created ${created} tables\n\n`);

    // Seed roles
    res.write('Seeding roles...\n');
    await pool.query(`
      INSERT INTO roles (name, label) VALUES
        ('admin', 'Administrator'),
        ('staff', 'Staff'),
        ('customer', 'Customer')
      ON CONFLICT (name) DO NOTHING
    `);
    res.write('✅ Roles created\n\n');

    // Seed admin user
    res.write('Creating admin user...\n');
    const adminHash = bcrypt.hashSync('admin123', 10);
    await pool.query(`
      INSERT INTO users (role_id, first_name, last_name, email, password_hash, is_active)
      VALUES (1, 'Admin', 'User', 'admin@balaireserve.com', $1, 1)
      ON CONFLICT (email) DO NOTHING
    `, [adminHash]);
    res.write('✅ Admin user created\n\n');

    // Seed settings
    res.write('Creating settings...\n');
    await pool.query(`
      INSERT INTO settings (key, value, label, group_name) VALUES
        ('site_name', 'Balai-Reserve', 'Site Name', 'general'),
        ('check_in_time', '2:00 PM', 'Check-in Time', 'booking'),
        ('check_out_time', '12:00 PM', 'Check-out Time', 'booking'),
        ('downpayment_percent', '50', 'Downpayment Percentage', 'payment'),
        ('cancellation_policy', 'Cancellation must be made 48 hours before check-in for full refund.', 'Cancellation Policy', 'booking'),
        ('gcash_number', '09123456789', 'GCash Number', 'payment'),
        ('gcash_name', 'Balai Miciano Resort', 'GCash Account Name', 'payment')
      ON CONFLICT (key) DO NOTHING
    `);
    res.write('✅ Settings created\n\n');

    res.write('\n✅ DATABASE SETUP COMPLETE!\n\n');
    res.write('Admin Login:\n');
    res.write('  Email: admin@balaireserve.com\n');
    res.write('  Password: admin123\n\n');
    res.write('⚠️  DELETE THIS SETUP ENDPOINT NOW!\n');
    res.write('</pre></body></html>');
    res.end();

  } catch (error) {
    console.error('Setup error:', error);
    
    try {
      res.write(`\n\n❌ ERROR: ${error.message}\n\n`);
      res.write(`Stack: ${error.stack}\n`);
      res.write('</pre></body></html>');
      res.end();
    } catch (writeError) {
      console.error('Failed to write error to response:', writeError);
    }
  } finally {
    if (pool) {
      try {
        await pool.end();
      } catch (err) {
        console.error('Error closing pool:', err);
      }
    }
  }
});

module.exports = router;
