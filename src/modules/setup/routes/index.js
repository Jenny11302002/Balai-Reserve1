/**
 * Setup/Seeding Routes - ONE-TIME USE ONLY
 * DELETE THIS FILE AFTER SEEDING!
 */
'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../../../config/database');

const router = express.Router();

// ONE-TIME SEED ENDPOINT
router.get('/seed-database-now', async (req, res) => {
  try {
    // Check if already seeded
    const existingRoles = (await db.prepare('SELECT COUNT(*) as c FROM roles').get())?.c || 0;
    
    if (existingRoles > 0) {
      return res.send(`
        <h1>❌ Database Already Seeded</h1>
        <p>Roles already exist. Database has been seeded.</p>
        <p><a href="/auth/login">Go to Login</a></p>
      `);
    }

    // Seed Roles
    const firestore = db.getFirestore();
    
    await firestore.collection('roles').doc('1').set({
      id: 1, name: 'admin', label: 'Administrator',
      description: 'Full access',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    
    await firestore.collection('roles').doc('2').set({
      id: 2, name: 'staff', label: 'Staff',
      description: 'Staff member',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    
    await firestore.collection('roles').doc('3').set({
      id: 3, name: 'customer', label: 'Customer',
      description: 'Customer account',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    
    await firestore.collection('_counters').doc('roles').set({ value: 3 });

    // Seed Admin User
    const adminHash = bcrypt.hashSync('admin123', 12);
    await firestore.collection('users').doc('1').set({
      id: 1, role_id: 1,
      first_name: 'Admin', last_name: 'User',
      email: 'admin@balaireserve.com',
      password_hash: adminHash,
      phone: '', is_active: 1,
      auth_provider: 'local',
      email_verified: 1,
      avatar: '',
      last_login: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    
    await firestore.collection('_counters').doc('users').set({ value: 1 });

    // Seed Basic Settings
    await firestore.collection('settings').doc('1').set({
      id: 1, key: 'site_name', value: 'Balai-Reserve',
      category: 'general',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    
    await firestore.collection('_counters').doc('settings').set({ value: 1 });

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Database Seeded Successfully</title>
        <style>
          body { font-family: Arial; max-width: 600px; margin: 50px auto; padding: 20px; }
          h1 { color: #4CAF50; }
          .credentials { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .button { 
            display: inline-block; 
            background: #4CAF50; 
            color: white; 
            padding: 10px 20px; 
            text-decoration: none; 
            border-radius: 5px; 
            margin: 10px 0;
          }
          .warning { background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107; }
        </style>
      </head>
      <body>
        <h1>✅ Database Seeded Successfully!</h1>
        
        <div class="credentials">
          <h3>Admin Login Credentials:</h3>
          <p><strong>Email:</strong> admin@balaireserve.com</p>
          <p><strong>Password:</strong> admin123</p>
        </div>

        <p>Your Firestore database has been populated with:</p>
        <ul>
          <li>✅ 3 User Roles (admin, staff, customer)</li>
          <li>✅ 1 Admin User Account</li>
          <li>✅ Basic System Settings</li>
        </ul>

        <a href="/auth/login" class="button">Go to Login Page</a>

        <div class="warning">
          <strong>⚠️ IMPORTANT SECURITY:</strong>
          <p>Delete the file <code>src/modules/setup/routes/index.js</code> immediately!</p>
          <p>This seeding endpoint should not be accessible in production.</p>
        </div>
      </body>
      </html>
    `);

  } catch (error) {
    res.status(500).send(`
      <h1>❌ Seeding Failed</h1>
      <p>Error: ${error.message}</p>
      <pre>${error.stack}</pre>
    `);
  }
});

module.exports = router;
