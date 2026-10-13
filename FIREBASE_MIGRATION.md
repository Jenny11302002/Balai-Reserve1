# Firebase Migration Guide

This guide explains how to migrate from SQLite to Firebase Firestore for Vercel deployment.

## Why Firebase?

Vercel's serverless environment doesn't support:
- Persistent file systems (SQLite database files)
- Local file storage (uploads)

Firebase provides:
- ✅ Cloud database (Firestore)
- ✅ File storage (Firebase Storage for uploads)
- ✅ Works perfectly with serverless environments

## Setup Steps

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name (e.g., `balai-reserve`)
4. Follow the setup wizard

### 2. Generate Service Account Key

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Click **Service accounts** tab
3. Click **Generate new private key**
4. Save the downloaded JSON file securely

### 3. Configure Environment Variables

Add these to your `.env` file (local) and Vercel environment variables (production):

```env
USE_FIRESTORE=true
FIREBASE_ADMIN_PROJECT_ID=your-project-id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
Your-Private-Key-Here
-----END PRIVATE KEY-----
"
```

**Important:** In Vercel, set these as environment variables in your project settings.

### 4. Migrate Data from SQLite to Firestore

Run the migration script to copy your existing data:

```bash
# Install dependencies first
npm install

# Run migration
node src/database/migrate-to-firestore.js
```

This will:
- Read all data from your SQLite database
- Upload it to Firebase Firestore
- Preserve all IDs and relationships

### 5. Update Vercel Environment Variables

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add the Firebase variables (from step 3)
5. Redeploy your project

### 6. File Uploads (Future Step)

For file uploads (payment proofs, images), you'll need to:

1. Enable Firebase Storage in your project
2. Update upload handlers to use Firebase Storage instead of local filesystem
3. This can be done later - the app will work without it for now

## How It Works

The application automatically detects the environment:

- **Local Development:** Uses SQLite (when `USE_FIRESTORE=false`)
- **Production/Vercel:** Uses Firestore (when `USE_FIRESTORE=true` or on Vercel)

The `src/config/database.js` file handles this automatically.

## Firestore Collections

Your SQLite tables become Firestore collections:

```
SQLite Table          →  Firestore Collection
─────────────────────────────────────────────
roles                 →  roles
users                 →  users
customers             →  customers
reservations          →  reservations
payments              →  payments
rooms                 →  rooms
venues                →  venues
cottages              →  cottages
... (and all others)
```

## Testing

1. **Local with Firestore:**
   ```bash
   # Set in .env
   USE_FIRESTORE=true
   
   # Run locally
   npm start
   ```

2. **Local with SQLite:**
   ```bash
   # Set in .env
   USE_FIRESTORE=false
   
   # Run locally
   npm start
   ```

## Troubleshooting

### Error: "Missing Firebase credentials"

Make sure all three variables are set:
- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY`

### Error: "Permission denied"

Enable Firestore in Firebase Console:
1. Go to **Firestore Database**
2. Click **Create database**
3. Choose production mode or test mode

### Migration fails

- Check that your SQLite database exists
- Ensure you have internet connection
- Verify Firebase credentials are correct

## Cost Considerations

Firebase Free Tier includes:
- **Firestore:** 1GB storage, 50K reads/day, 20K writes/day
- **Authentication:** Unlimited
- **Storage:** 5GB, 1GB/day downloads

For a small to medium booking system, this should be sufficient. Monitor usage in Firebase Console.

## Rollback

To switch back to SQLite:

1. Set `USE_FIRESTORE=false` in your `.env`
2. Restart the application
3. Your local SQLite database remains unchanged

## Next Steps

After migration:
- [ ] Test all features work with Firestore
- [ ] Update file upload handlers for Firebase Storage
- [ ] Set up Firestore security rules
- [ ] Configure Firestore indexes for performance
- [ ] Set up backups

## Support

If you encounter issues:
1. Check Firebase Console for errors
2. Review Vercel deployment logs
3. Check Firestore security rules
4. Verify all environment variables are set correctly
