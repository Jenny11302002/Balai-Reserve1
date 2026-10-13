/**
 * Firestore Database Configuration
 * Replaces SQLite with Firebase Firestore for Vercel deployment
 */
'use strict';

require('dotenv').config();
const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_ADMIN_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Missing Firebase credentials. Required:\n' +
      '  - FIREBASE_ADMIN_PROJECT_ID\n' +
      '  - FIREBASE_ADMIN_CLIENT_EMAIL\n' +
      '  - FIREBASE_ADMIN_PRIVATE_KEY\n' +
      'Please set these in your .env file or environment variables.'
    );
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey
    })
  });
}

const db = admin.firestore();

// Configure Firestore settings
db.settings({
  ignoreUndefinedProperties: true,
  timestampsInSnapshots: true
});

module.exports = { db, admin, FieldValue: admin.firestore.FieldValue };
