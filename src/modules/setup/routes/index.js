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
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    res.write('<html><body><h1>Database Setup</h1><pre>');
    
    // Create schema
    res.write('Creating schema...\n');
    const schemaPath = path.join(__dirname, '..', '..', '..', 'database', 'schema-postgres.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(schema);
    res.write('✅ Schema created\n\n');

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

    await pool.end();

    res.write('\n✅ DATABASE SETUP COMPLETE!\n\n');
    res.write('Admin Login:\n');
    res.write('  Email: admin@balaireserve.com\n');
    res.write('  Password: admin123\n\n');
    res.write('⚠️  DELETE THIS SETUP ENDPOINT NOW!\n');
    res.write('</pre></body></html>');
    res.end();

  } catch (error) {
    res.write(`\n\n❌ ERROR: ${error.message}\n`);
    res.write(`\nStack: ${error.stack}\n`);
    res.write('</pre></body></html>');
    res.end();
  }
});

module.exports = router;
