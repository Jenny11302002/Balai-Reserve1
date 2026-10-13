/**
 * Quick Firestore Seed - Essential Data Only
 */
'use strict';

require('dotenv').config();
process.env.USE_FIRESTORE = 'true';

const bcrypt = require('bcryptjs');
const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = {
  projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
  clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function quickSeed() {
  console.log('🔥 Quick seeding Firestore...\n');

  try {
    // 1. Roles
    console.log('Creating roles...');
    await db.collection('roles').doc('1').set({
      id: 1,
      name: 'admin',
      label: 'Administrator',
      description: 'Full system access',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    
    await db.collection('roles').doc('2').set({
      id: 2,
      name: 'staff',
      label: 'Staff',
      description: 'Staff member',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    
    await db.collection('roles').doc('3').set({
      id: 3,
      name: 'customer',
      label: 'Customer',
      description: 'Customer account',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    
    await db.collection('_counters').doc('roles').set({ value: 3 });
    console.log('✓ Roles created\n');

    // 2. Admin User
    console.log('Creating admin user...');
    const adminPassword = 'admin123';
    const adminHash = bcrypt.hashSync(adminPassword, 12);
    
    await db.collection('users').doc('1').set({
      id: 1,
      role_id: 1,
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
    });
    
    await db.collection('_counters').doc('users').set({ value: 1 });
    console.log('✓ Admin user created\n');

    // 3. Basic Settings
    console.log('Creating settings...');
    const settings = [
      { key: 'site_name', value: 'Balai-Reserve' },
      { key: 'contact_email', value: 'info@balaireserve.com' },
      { key: 'currency', value: 'PHP' },
    ];
    
    let id = 1;
    for (const setting of settings) {
      await db.collection('settings').doc(String(id)).set({
        id,
        ...setting,
        category: 'general',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      id++;
    }
    
    await db.collection('_counters').doc('settings').set({ value: id - 1 });
    console.log('✓ Settings created\n');

    console.log('═══════════════════════════════════════');
    console.log('✅ SEEDING COMPLETE!');
    console.log('═══════════════════════════════════════');
    console.log('\nLogin credentials:');
    console.log('  Email:    admin@balaireserve.com');
    console.log('  Password: admin123');
    console.log('\nGo to: https://balai-reserve1.vercel.app/auth/login\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

quickSeed();
