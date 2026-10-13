/**
 * Setup PostgreSQL Database
 * Creates schema and seeds initial data
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function setupDatabase() {
  console.log('🐘 Setting up PostgreSQL database...\n');

  try {
    // Read and execute schema
    const schemaPath = path.join(__dirname, '..', 'src', 'database', 'schema-postgres.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('Creating schema...');
    await pool.query(schema);
    console.log('✅ Schema created\n');

    // Seed initial data
    console.log('Seeding initial data...\n');

    // 1. Roles
    console.log('- Creating roles...');
    await pool.query(`
      INSERT INTO roles (name, label) VALUES
        ('admin', 'Administrator'),
        ('staff', 'Staff'),
        ('customer', 'Customer')
      ON CONFLICT (name) DO NOTHING
    `);

    // 2. Admin user
    console.log('- Creating admin user...');
    const bcrypt = require('bcryptjs');
    const adminHash = bcrypt.hashSync('admin123', 10);
    
    await pool.query(`
      INSERT INTO users (role_id, first_name, last_name, email, password_hash, is_active)
      VALUES (1, 'Admin', 'User', 'admin@balaireserve.com', $1, 1)
      ON CONFLICT (email) DO NOTHING
    `, [adminHash]);

    // 3. Settings
    console.log('- Creating settings...');
    await pool.query(`
      INSERT INTO settings (key, value, label, group_name) VALUES
        ('site_name', 'Balai-Reserve', 'Site Name', 'general'),
        ('check_in_time', '2:00 PM', 'Check-in Time', 'booking'),
        ('check_out_time', '12:00 PM', 'Check-out Time', 'booking'),
        ('downpayment_percent', '50', 'Downpayment Percentage', 'payment'),
        ('cancellation_policy', 'Cancellation must be made 48 hours before check-in for full refund.', 'Cancellation Policy', 'booking')
      ON CONFLICT (key) DO NOTHING
    `);

    console.log('\n✅ Database setup complete!');
    console.log('\n📝 Admin credentials:');
    console.log('   Email: admin@balaireserve.com');
    console.log('   Password: admin123\n');

  } catch (error) {
    console.error('❌ Error setting up database:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

setupDatabase().catch(console.error);
