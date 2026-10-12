/**
 * Firebase Admin SDK — server-side token verification
 *
 * Two operating modes:
 *
 *  A) FULL (production / staging):
 *     FIREBASE_ADMIN_CLIENT_EMAIL + FIREBASE_ADMIN_PRIVATE_KEY set in .env.
 *     Uses service-account credentials. Supports revocation checks.
 *     Download: Firebase Console → Project Settings → Service Accounts → Generate new private key
 *
 *  B) DEV / no service account:
 *     Falls back to manual JWT verification using Google's public JWKS endpoint.
 *     Works without any service-account file. Revocation checks are skipped.
 *     Suitable for localhost development.
 */
'use strict';

const https   = require('https');
const crypto  = require('crypto');
const admin   = require('firebase-admin');

// ── Mode A: full credentials ───────────────────────────────────
const projectId   = process.env.FIREBASE_ADMIN_PROJECT_ID  || process.env.FIREBASE_PROJECT_ID || '';
const clientEmail = (process.env.FIREBASE_ADMIN_CLIENT_EMAIL || '').trim();
const rawKey      = (process.env.FIREBASE_ADMIN_PRIVATE_KEY  || '').trim();
const privateKey  = rawKey.replace(/\\n/g, '\n');

let USE_ADMIN_SDK = false;

if (clientEmail && privateKey) {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  }
  USE_ADMIN_SDK = true;
  console.log('[Firebase] Admin SDK initialised with service-account credentials.');
} else {
  console.warn(
    '[Firebase] No service-account credentials — using dev-mode JWT verification.\n' +
    '           Token verification works but revocation checks are disabled.\n' +
    '           For production: set FIREBASE_ADMIN_CLIENT_EMAIL + FIREBASE_ADMIN_PRIVATE_KEY in .env'
  );
}

// ── Mode B: manual JWT verification via Google public certs ────
// Google publishes its public signing certificates here.
// We cache them and use Node's built-in crypto to verify the RS256 signature.
const GOOGLE_CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken%40system.gserviceaccount.com';

let _certCache    = null;
let _certCacheExp = 0;

function fetchGoogleCerts() {
  return new Promise((resolve, reject) => {
    if (_certCache && Date.now() < _certCacheExp) {
      return resolve(_certCache);
    }
    https.get(GOOGLE_CERTS_URL, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          _certCache    = JSON.parse(data);
          // Cache for 1 hour
          _certCacheExp = Date.now() + 3600_000;
          resolve(_certCache);
        } catch (e) {
          reject(new Error('Failed to parse Google certs: ' + e.message));
        }
      });
    }).on('error', reject);
  });
}

function base64UrlDecode(str) {
  // Convert base64url to base64, then decode
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - b64.length % 4) % 4);
  return Buffer.from(padded, 'base64');
}

/**
 * Manually verify a Firebase ID token using Google's public certificates.
 * @param {string} idToken
 * @returns {Promise<object|null>} decoded payload or null
 */
async function verifyIdTokenManually(idToken) {
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) throw new Error('Invalid JWT format');

    const header  = JSON.parse(base64UrlDecode(parts[0]).toString('utf8'));
    const payload = JSON.parse(base64UrlDecode(parts[1]).toString('utf8'));

    // Basic claims validation
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now)       throw new Error('Token expired');
    if (payload.iat > now + 300) throw new Error('Token issued in the future');
    if (payload.aud !== projectId) throw new Error(`Invalid audience: ${payload.aud}`);
    if (payload.iss !== `https://securetoken.google.com/${projectId}`)
      throw new Error(`Invalid issuer: ${payload.iss}`);
    if (!payload.sub) throw new Error('Missing subject claim');

    // Fetch Google's public certs and verify the signature
    const certs = await fetchGoogleCerts();
    const cert  = certs[header.kid];
    if (!cert) throw new Error(`No cert found for kid: ${header.kid}`);

    const signingInput = `${parts[0]}.${parts[1]}`;
    const signature    = base64UrlDecode(parts[2]);

    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(signingInput);
    const valid = verify.verify(cert, signature);
    if (!valid) throw new Error('Invalid signature');

    // Return a payload compatible with what firebase-admin returns
    return {
      uid:            payload.sub,
      email:          payload.email         || '',
      email_verified: payload.email_verified || false,
      name:           payload.name          || '',
      picture:        payload.picture       || '',
      firebase:       payload.firebase      || {},
    };

  } catch (err) {
    console.error('[Firebase] Manual token verification failed:', err.message);
    return null;
  }
}

/**
 * Verify a Firebase ID token sent from the browser.
 * Uses Firebase Admin SDK if service-account is configured (Mode A),
 * otherwise falls back to manual JWT verification (Mode B).
 *
 * @param {string} idToken
 * @returns {Promise<object|null>}
 */
async function verifyIdToken(idToken) {
  if (USE_ADMIN_SDK) {
    try {
      return await admin.auth().verifyIdToken(idToken, /* checkRevoked */ true);
    } catch (err) {
      console.error('[Firebase] Admin SDK token verification failed:', err.code, err.message);
      return null;
    }
  }
  // Dev mode: manual verification
  return verifyIdTokenManually(idToken);
}

module.exports = { admin: USE_ADMIN_SDK ? admin : null, verifyIdToken };
