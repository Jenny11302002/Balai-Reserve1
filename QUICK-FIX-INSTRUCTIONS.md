# Quick Fix: Switch to Vercel Postgres

Ang problema: SQLite queries hindi compatible sa Firestore. Kailangan Vercel Postgres para gumana lahat ng SQL queries.

## Step 1: Create Vercel Postgres Database

1. Go to: https://vercel.com/dashboard
2. Click your project "balai-reserve1"
3. Click "Storage" tab
4. Click "Create Database"
5. Choose "Postgres"
6. Name: balai-reserve-db
7. Click "Create"

## Step 2: Get Connection String

After creating, you'll see environment variables:
- POSTGRES_URL
- POSTGRES_PRISMA_URL
- POSTGRES_URL_NON_POOLING

Copy POSTGRES_URL value.

## Step 3: Update .env file

Add to your .env:
```
DATABASE_URL=<paste POSTGRES_URL here>
USE_POSTGRES=true
```

## Step 4: Install pg package

Run:
```
npm install pg
```

## Step 5: I'll create the Postgres adapter

I'll create a new database adapter that uses Postgres instead of Firestore.

## Step 6: Import your data to Postgres

We'll run the migration script to copy all data from Firestore to Postgres.

---

**Alternative (kung ayaw mo ng Postgres):**

Run locally with SQLite and don't deploy to Vercel. Use a VPS instead (DigitalOcean, AWS EC2, etc.)

---

Ano gusto mo gawin? Type:
- "postgres" - gamitin Vercel Postgres (RECOMMENDED)
- "vps" - ituturo ko paano mag-deploy sa VPS with SQLite
- "fix firestore" - itutuloy ko yung Firestore pero matagal at complicated
