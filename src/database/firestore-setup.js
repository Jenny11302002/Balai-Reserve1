/**
 * Firestore Setup Script
 * Creates initial roles and admin user for fresh Firestore database
 * Run this AFTER deploying to Vercel with Firestore enabled
 */
'use strict';

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { db } = require('../config/firestore');

async function setupFirestore() {
  console.log('🔥 Setting up Firestore database...\n');

  try {
    // Check if roles already exist
    const rolesSnapshot = await db.collection('roles').get();
    
    if (!rolesSnapshot.empty) {
      console.log('⚠️  Database already initialized. Skipping setup.');
      return;
    }

    // Step 1: Create Roles
    console.log('📝 Creating roles...');
    const roles = [
      { id: 1, name: 'admin', label: 'Administrator', created_at: new Date().toISOString() },
      { id: 2, name: 'staff', label: 'Staff', created_at: new Date().toISOString() },
      { id: 3, name: 'customer', label: 'Customer', created_at: new Date().toISOString() }
    ];

    for (const role of roles) {
      await db.collection('roles').doc(String(role.id)).set(role);
      console.log(`   ✅ Created role: ${role.label}`);
    }

    // Update counter
    await db.collection('_counters').doc('roles').set({ value: 3 });

    // Step 2: Create Admin User
    console.log('\n👤 Creating admin user...');
    const passwordHash = await bcrypt.hash('admin123', 10);
    
    const adminUser = {
      id: 1,
      role_id: 1,
      first_name: 'Admin',
      last_name: 'User',
      email: 'admin@balai-reserve.com',
      password_hash: passwordHash,
      phone: '',
      avatar: '',
      is_active: 1,
      auth_provider: 'local',
      firebase_uid: '',
      email_verified: 1,
      last_login: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    await db.collection('users').doc('1').set(adminUser);
    console.log('   ✅ Admin user created');
    console.log('      Email: admin@balai-reserve.com');
    console.log('      Password: admin123');
    console.log('      ⚠️  CHANGE THIS PASSWORD AFTER FIRST LOGIN!');

    // Update counter
    await db.collection('_counters').doc('users').set({ value: 1 });

    // Step 3: Create basic settings
    console.log('\n⚙️  Creating system settings...');
    const settings = [
      { id: 1, key: 'site_name', value: 'Balai Reserve', label: 'Site Name', group_name: 'general', updated_at: new Date().toISOString() },
      { id: 2, key: 'currency', value: 'PHP', label: 'Currency', group_name: 'general', updated_at: new Date().toISOString() },
      { id: 3, key: 'timezone', value: 'Asia/Manila', label: 'Timezone', group_name: 'general', updated_at: new Date().toISOString() },
      { id: 4, key: 'booking_advance_days', value: '90', label: 'Booking Advance Days', group_name: 'booking', updated_at: new Date().toISOString() },
      { id: 5, key: 'downpayment_percentage', value: '30', label: 'Downpayment Percentage', group_name: 'payment', updated_at: new Date().toISOString() }
    ];

    for (const setting of settings) {
      await db.collection('settings').doc(String(setting.id)).set(setting);
      console.log(`   ✅ ${setting.label}: ${setting.value}`);
    }

    // Update counter
    await db.collection('_counters').doc('settings').set({ value: 5 });

    console.log('\n' + '='.repeat(60));
    console.log('✅ Firestore setup complete!\n');
    console.log('🎉 You can now log in with:');
    console.log('   Email: admin@balai-reserve.com');
    console.log('   Password: admin123');
    console.log('\n⚠️  IMPORTANT: Change the admin password immediately!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Setup failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  setupFirestore()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('💥 Setup failed:', error);
      process.exit(1);
    });
}

module.exports = { setupFirestore };
