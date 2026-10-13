# Balai-Reserve Deployment Instructions

## ✅ Current Deployment Status

Your app is **partially deployed** to Vercel with Firestore backend. 

### What Works:
- ✅ Homepage loads (empty data)
- ✅ Login page loads
- ✅ Registration page loads
- ✅ Basic app infrastructure

### What's Empty/Incomplete:
- ⚠️ Firestore database is empty (no data)
- ⚠️ Most routes will crash if you try to use them (need async/await fixes)

---

## 🎯 Quick Start: Seed Your Database

**Step 1: Run the seeding script locally**

```bash
node src/database/seed-firestore.js
```

This will populate your Firestore database with:
- ✅ Roles (admin, staff, customer)
- ✅ Admin user account
- ✅ System settings
- ✅ Room types

**Step 2: Test Login**

1. Go to your deployed app: https://balai-reserve1.vercel.app
2. Click "Sign In"
3. Use these credentials:
   - **Email:** `admin@balaireserve.com`
   - **Password:** `admin123`

**Step 3: Test What Works**

Try these pages:
- ✅ Homepage (`/`)
- ✅ Login (`/auth/login`)
- ✅ Register (`/auth/register`)

---

## ⚠️ Known Issues & Limitations

### Routes That Will Crash:

All authenticated admin routes need async/await fixes:
- ❌ Dashboard (`/dashboard`)
- ❌ Rooms management (`/rooms`)
- ❌ Venues management (`/venues`)
- ❌ Cottages management (`/cottages`)
- ❌ Reservations (`/reservations`)
- ❌ All other admin modules

**Why?** These routes have synchronous database calls that don't work with Firestore.

---

## 🔧 Fixing Remaining Routes

### Option 1: Fix Manually as Needed (Safest)

When you encounter a crash:

1. Check the Vercel logs for the error
2. Find the file and line number
3. Convert synchronous calls to async:

**Before:**
```javascript
router.get('/example', (req, res) => {
  const data = db.prepare("SELECT * FROM table").get();
  res.render('view', { data });
});
```

**After:**
```javascript
router.get('/example', async (req, res) => {
  const data = await db.prepare("SELECT * FROM table").get();
  res.render('view', { data });
});
```

### Option 2: Use the Automated Script (Faster, needs review)

```bash
node scripts/fix-async-routes.js
```

This will automatically convert most routes. **Review changes before committing!**

---

## 📊 What's Been Fixed So Far

### Core Files (100% Complete):
- ✅ `app.js` - Homepage route, middleware
- ✅ `src/modules/auth/routes/index.js` - All auth routes
- ✅ `src/middleware/auth.js` - Audit logging
- ✅ `src/utils/reservationAvailability.js` - Reconcile function
- ✅ `src/utils/notifications.js` - All notification functions

### Remaining Files (Need Fixes):
See `FIRESTORE_MIGRATION_STATUS.md` for complete list.

---

## 🌐 Environment Variables

Make sure these are set in Vercel:

```env
USE_FIRESTORE=true
FIREBASE_ADMIN_PROJECT_ID=balai-b3b67
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-fbsvc@balai-b3b67.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
SESSION_SECRET=your-secret-key
NODE_ENV=production
```

---

## 🎨 Custom Domain Setup

Your custom domain `balaireserve.online` is configured in Vercel.

**DNS Settings:**
- A record: `76.76.21.21`
- CNAME www: `cname.vercel-dns.com`

---

## 📝 Next Steps

### Immediate (To Get Basic Functionality):
1. ✅ Run seed script (done if you followed Quick Start)
2. ✅ Test login with admin account
3. ⚠️ Fix dashboard route (if you need admin access)
4. ⚠️ Fix portal routes (for customer features)

### Medium Priority (For Full Features):
1. Fix all admin module routes
2. Add more seed data (rooms, venues, cottages)
3. Test reservation flow end-to-end
4. Configure payment QR codes

### Long Term (Enhancements):
1. Set up email notifications (SMTP)
2. Add more admin users
3. Import existing data if migrating
4. Performance optimization

---

## 🆘 Troubleshooting

### "TypeError: X is not iterable"
**Cause:** Firestore returned `undefined` instead of an array  
**Fix:** Add `|| []` after `.all()` calls or `await` the query

### "db.prepare(...).get() is not a function"
**Cause:** Missing `await` keyword  
**Fix:** Add `await` before `db.prepare()`

### "Cannot read property of undefined"
**Cause:** `.get()` returned `undefined`  
**Fix:** Use optional chaining `?.` or add null checks

### Page shows 500 error
**Cause:** Route has synchronous database call  
**Fix:** Make route async and await all database operations

---

## 📚 Helpful Commands

```bash
# Seed database
node src/database/seed-firestore.js

# Auto-fix routes (use with caution)
node scripts/fix-async-routes.js

# Push to GitHub (triggers Vercel deployment)
git add .
git commit -m "fix: Your changes"
git push origin main

# Check deployment status
# Visit: https://vercel.com/dashboard
```

---

## 🔗 Important Links

- **Production URL:** https://balai-reserve1.vercel.app
- **Custom Domain:** https://balaireserve.online
- **Vercel Dashboard:** https://vercel.com/dashboard
- **GitHub Repo:** https://github.com/Jenny11302002/Balai-Reserve1

---

## 📧 Support

If you encounter issues:
1. Check Vercel deployment logs
2. Review `FIRESTORE_MIGRATION_STATUS.md`
3. Check error messages in browser console
4. Look for similar fixes in already-completed files

---

**Last Updated:** October 13, 2026  
**Deployment Status:** Partial (auth works, most routes need fixes)  
**Database:** Firestore (Cloud)  
**Hosting:** Vercel (Serverless)
