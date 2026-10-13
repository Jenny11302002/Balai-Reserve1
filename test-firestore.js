require('dotenv').config();
const admin = require('firebase-admin');

const serviceAccount = {
  projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
  clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
};

console.log('Initializing Firebase...');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
console.log('Firebase initialized, testing write...');

db.collection('_test').doc('test').set({ test: 'value', timestamp: new Date().toISOString() })
  .then(() => {
    console.log('✅ Write successful!');
    return db.collection('_test').doc('test').get();
  })
  .then((doc) => {
    console.log('✅ Read successful:', doc.data());
    console.log('\n🎉 Firestore connection works!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });

setTimeout(() => {
  console.error('❌ Timeout - Could not connect to Firestore');
  process.exit(1);
}, 30000);
