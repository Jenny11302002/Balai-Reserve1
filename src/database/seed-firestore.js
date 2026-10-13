/**
 * Firestore Seeding Script
 * Populates initial data required for the application to function
 * Run with: node src/database/seed-firestore.js
 */
'use strict';

require('dotenv').config();

const bcrypt = require('bcryptjs');

// Force Firestore mode
process.env.USE_FIRESTORE = 'true';

const db = require('../config/database');

async function seedFirestore() {
  console.log('🔥 Starting Firestore seeding...\n');

  try {
    // ══════════════════════════════════════════════════════════════
    // 1. ROLES
    // ══════════════════════════════════════════════════════════════
    console.log('📋 Seeding roles...');
    
    const roles = [
      { id: 1, name: 'admin', label: 'Administrator', description: 'Full system access' },
      { id: 2, name: 'staff', label: 'Staff', description: 'Staff member with limited access' },
      { id: 3, name: 'customer', label: 'Customer', description: 'Customer account' },
    ];

    for (const role of roles) {
      await db.getFirestore().collection('roles').doc(String(role.id)).set({
        ...role,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      console.log(`  ✓ Created role: ${role.label}`);
    }

    // Set counter for roles
    await db.getFirestore().collection('_counters').doc('roles').set({ value: 3 });

    // ══════════════════════════════════════════════════════════════
    // 2. ADMIN USER
    // ══════════════════════════════════════════════════════════════
    console.log('\n👤 Creating admin user...');
    
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const adminHash = bcrypt.hashSync(adminPassword, 12);

    const adminUser = {
      id: 1,
      role_id: 1, // admin role
      first_name: 'Admin',
      last_name: 'User',
      email: 'admin@balaireserve.com',
      password_hash: adminHash,
      phone: '',
      is_active: 1,
      auth_provider: 'local',
      email_verified: 1,
      avatar: '',
      last_login: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await db.getFirestore().collection('users').doc('1').set(adminUser);
    console.log(`  ✓ Admin user created: ${adminUser.email}`);
    console.log(`  ✓ Password: ${adminPassword}`);

    // Set counter for users
    await db.getFirestore().collection('_counters').doc('users').set({ value: 1 });

    // ══════════════════════════════════════════════════════════════
    // 3. SETTINGS
    // ══════════════════════════════════════════════════════════════
    console.log('\n⚙️  Seeding settings...');

    const settings = [
      { key: 'site_name', value: 'Balai-Reserve', category: 'general' },
      { key: 'site_tagline', value: 'Your Home Away From Home', category: 'general' },
      { key: 'contact_email', value: 'info@balaireserve.com', category: 'contact' },
      { key: 'contact_phone', value: '+63 912 345 6789', category: 'contact' },
      { key: 'contact_address', value: 'Philippines', category: 'contact' },
      { key: 'currency', value: 'PHP', category: 'general' },
      { key: 'timezone', value: 'Asia/Manila', category: 'general' },
      { key: 'date_format', value: 'Y-m-d', category: 'general' },
      { key: 'time_format', value: 'H:i', category: 'general' },
      { key: 'check_in_time', value: '14:00', category: 'reservations' },
      { key: 'check_out_time', value: '12:00', category: 'reservations' },
      { key: 'cancellation_policy', value: 'Free cancellation up to 24 hours before check-in', category: 'reservations' },
      { key: 'payment_methods', value: 'GCash,Maya,Cash', category: 'payment' },
      { key: 'gcash_number', value: '09123456789', category: 'payment' },
      { key: 'gcash_name', value: 'Balai Reserve', category: 'payment' },
      { key: 'gcash_qr_path', value: '', category: 'payment' },
      { key: 'maya_number', value: '09123456789', category: 'payment' },
      { key: 'maya_name', value: 'Balai Reserve', category: 'payment' },
      { key: 'maya_qr_path', value: '', category: 'payment' },
      { key: 'smtp_host', value: '', category: 'email' },
      { key: 'smtp_port', value: '587', category: 'email' },
      { key: 'smtp_username', value: '', category: 'email' },
      { key: 'smtp_password', value: '', category: 'email' },
      { key: 'smtp_from_email', value: 'noreply@balaireserve.com', category: 'email' },
      { key: 'smtp_from_name', value: 'Balai-Reserve', category: 'email' },
    ];

    let settingId = 1;
    for (const setting of settings) {
      await db.getFirestore().collection('settings').doc(String(settingId)).set({
        id: settingId,
        ...setting,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      settingId++;
    }
    console.log(`  ✓ Created ${settings.length} settings`);

    // Set counter for settings
    await db.getFirestore().collection('_counters').doc('settings').set({ value: settingId - 1 });

    // ══════════════════════════════════════════════════════════════
    // 4. ROOM TYPES
    // ══════════════════════════════════════════════════════════════
    console.log('\n🛏️  Seeding room types...');

    const roomTypes = [
      { id: 1, name: 'Standard Room', description: 'Comfortable standard room', base_price: 1500, max_occupancy: 2 },
      { id: 2, name: 'Deluxe Room', description: 'Spacious deluxe room', base_price: 2500, max_occupancy: 3 },
      { id: 3, name: 'Suite', description: 'Luxury suite with amenities', base_price: 4000, max_occupancy: 4 },
      { id: 4, name: 'Family Room', description: 'Large room for families', base_price: 3500, max_occupancy: 6 },
    ];

    for (const type of roomTypes) {
      await db.getFirestore().collection('room_types').doc(String(type.id)).set({
        ...type,
        is_active: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      console.log(`  ✓ Created room type: ${type.name}`);
    }

    // Set counter for room_types
    await db.getFirestore().collection('_counters').doc('room_types').set({ value: 4 });

    // ══════════════════════════════════════════════════════════════
    // SUMMARY
    // ══════════════════════════════════════════════════════════════
    console.log('\n✅ Firestore seeding completed successfully!\n');
    console.log('═══════════════════════════════════════');
    console.log('Admin Credentials:');
    console.log(`  Email:    ${adminUser.email}`);
    console.log(`  Password: ${adminPassword}`);
    console.log('═══════════════════════════════════════\n');
    console.log('Next steps:');
    console.log('1. Go to your deployed app');
    console.log('2. Click "Sign In"');
    console.log('3. Use the admin credentials above');
    console.log('4. Start adding rooms, venues, and cottages!\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error seeding Firestore:', error);
    process.exit(1);
  }
}

// Run the seeding
seedFirestore();
