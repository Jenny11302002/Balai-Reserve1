-- ============================================================
-- Balai-Reserve Database Schema - PostgreSQL Version
-- ============================================================

-- ─── ROLES ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(255) NOT NULL UNIQUE,
  label      VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ─── USERS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id             SERIAL PRIMARY KEY,
  role_id        INTEGER NOT NULL REFERENCES roles(id),
  first_name     VARCHAR(255) NOT NULL,
  last_name      VARCHAR(255) NOT NULL,
  email          VARCHAR(255) NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL DEFAULT '',
  phone          VARCHAR(50),
  avatar         TEXT,
  is_active      INTEGER NOT NULL DEFAULT 1,
  auth_provider  VARCHAR(50) NOT NULL DEFAULT 'local',
  firebase_uid   TEXT,
  email_verified INTEGER NOT NULL DEFAULT 0,
  last_login     TIMESTAMP,
  created_at     TIMESTAMP DEFAULT NOW(),
  updated_at     TIMESTAMP DEFAULT NOW()
);

-- ─── CUSTOMERS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id                   SERIAL PRIMARY KEY,
  user_id              INTEGER REFERENCES users(id) ON DELETE SET NULL,
  customer_code        VARCHAR(50) UNIQUE,
  first_name           VARCHAR(255) NOT NULL,
  last_name            VARCHAR(255) NOT NULL,
  email                VARCHAR(255),
  phone                VARCHAR(50),
  address              TEXT,
  preferred_contact    VARCHAR(20) DEFAULT 'email',
  customer_type        VARCHAR(20) DEFAULT 'regular',
  status               VARCHAR(20) DEFAULT 'active',
  notes                TEXT,
  created_at           TIMESTAMP DEFAULT NOW(),
  updated_at           TIMESTAMP DEFAULT NOW()
);

-- ─── ROOM TYPES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS room_types (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  base_price  DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- ─── ROOMS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rooms (
  id           SERIAL PRIMARY KEY,
  room_type_id INTEGER NOT NULL REFERENCES room_types(id),
  room_number  VARCHAR(50) NOT NULL UNIQUE,
  name         VARCHAR(255) NOT NULL,
  description  TEXT,
  capacity     INTEGER NOT NULL DEFAULT 2,
  price        DECIMAL(10,2) NOT NULL,
  amenities    TEXT,
  images       TEXT,
  floor        VARCHAR(50),
  status       VARCHAR(20) NOT NULL DEFAULT 'available',
  is_active    INTEGER NOT NULL DEFAULT 1,
  created_at   TIMESTAMP DEFAULT NOW(),
  updated_at   TIMESTAMP DEFAULT NOW()
);

-- ─── VENUES ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS venues (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(255) NOT NULL,
  venue_type   VARCHAR(50) NOT NULL,
  capacity     INTEGER NOT NULL DEFAULT 50,
  description  TEXT,
  location     VARCHAR(255),
  price        DECIMAL(10,2) NOT NULL DEFAULT 0,
  price_note   TEXT,
  amenities    TEXT,
  images       TEXT,
  status       VARCHAR(20) NOT NULL DEFAULT 'available',
  is_active    INTEGER NOT NULL DEFAULT 1,
  created_at   TIMESTAMP DEFAULT NOW(),
  updated_at   TIMESTAMP DEFAULT NOW()
);

-- ─── COTTAGES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cottages (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  capacity    INTEGER NOT NULL DEFAULT 10,
  price       DECIMAL(10,2) NOT NULL DEFAULT 0,
  amenities   TEXT,
  images      TEXT,
  status      VARCHAR(20) NOT NULL DEFAULT 'available',
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

-- ─── EVENT PACKAGES ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_packages (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  event_type  VARCHAR(50),
  price       DECIMAL(10,2) NOT NULL DEFAULT 0,
  inclusions  TEXT,
  capacity    INTEGER,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

-- ─── RESERVATIONS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reservations (
  id                 SERIAL PRIMARY KEY,
  booking_ref        VARCHAR(50) NOT NULL UNIQUE,
  customer_id        INTEGER NOT NULL REFERENCES customers(id),
  reservation_type   VARCHAR(20) NOT NULL,
  check_in_date      DATE,
  check_out_date     DATE,
  event_date         DATE,
  start_time         TIME,
  end_time           TIME,
  num_guests         INTEGER NOT NULL DEFAULT 1,
  special_requests   TEXT,
  total_amount       DECIMAL(10,2) NOT NULL DEFAULT 0,
  downpayment_req    DECIMAL(10,2) NOT NULL DEFAULT 0,
  status             VARCHAR(50) NOT NULL DEFAULT 'pending',
  payment_status     VARCHAR(50) NOT NULL DEFAULT 'unpaid',
  payment_method     VARCHAR(50) DEFAULT 'cash',
  assigned_staff_id  INTEGER REFERENCES users(id),
  notes              TEXT,
  source             VARCHAR(20) DEFAULT 'walk_in',
  created_at         TIMESTAMP DEFAULT NOW(),
  updated_at         TIMESTAMP DEFAULT NOW()
);

-- ─── RESERVATION ITEMS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reservation_items (
  id              SERIAL PRIMARY KEY,
  reservation_id  INTEGER NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  item_type       VARCHAR(50) NOT NULL,
  item_id         INTEGER NOT NULL,
  item_name       VARCHAR(255),
  quantity        INTEGER NOT NULL DEFAULT 1,
  unit_price      DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_price     DECIMAL(10,2) NOT NULL DEFAULT 0,
  notes           TEXT,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- ─── EVENTS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id               SERIAL PRIMARY KEY,
  reservation_id   INTEGER REFERENCES reservations(id),
  customer_id      INTEGER NOT NULL REFERENCES customers(id),
  event_package_id INTEGER REFERENCES event_packages(id),
  venue_id         INTEGER REFERENCES venues(id),
  event_name       VARCHAR(255) NOT NULL,
  event_type       VARCHAR(50) NOT NULL,
  event_date       DATE NOT NULL,
  start_time       TIME NOT NULL,
  end_time         TIME NOT NULL,
  num_attendees    INTEGER NOT NULL DEFAULT 1,
  special_requests TEXT,
  equipment_needs  TEXT,
  status           VARCHAR(20) NOT NULL DEFAULT 'pending',
  total_cost       DECIMAL(10,2) NOT NULL DEFAULT 0,
  payment_status   VARCHAR(20) NOT NULL DEFAULT 'unpaid',
  notes            TEXT,
  created_at       TIMESTAMP DEFAULT NOW(),
  updated_at       TIMESTAMP DEFAULT NOW()
);

-- ─── PAYMENTS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id               SERIAL PRIMARY KEY,
  reservation_id   INTEGER NOT NULL REFERENCES reservations(id),
  reference_number VARCHAR(100) UNIQUE,
  amount           DECIMAL(10,2) NOT NULL DEFAULT 0,
  payment_method   VARCHAR(50) NOT NULL DEFAULT 'cash',
  payment_date     TIMESTAMP NOT NULL,
  payment_type     VARCHAR(50) NOT NULL DEFAULT 'downpayment',
  status           VARCHAR(20) NOT NULL DEFAULT 'received',
  received_by      INTEGER REFERENCES users(id),
  proof_image      TEXT,
  submitted_by     VARCHAR(20) DEFAULT 'staff',
  verified_by      INTEGER REFERENCES users(id),
  verified_at      TIMESTAMP,
  notes            TEXT,
  created_at       TIMESTAMP DEFAULT NOW()
);

-- ─── REFUND REQUESTS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refund_requests (
  id             SERIAL PRIMARY KEY,
  reservation_id INTEGER NOT NULL REFERENCES reservations(id),
  customer_id    INTEGER REFERENCES customers(id),
  amount         DECIMAL(10,2) NOT NULL DEFAULT 0,
  reason         TEXT,
  gcash_number   VARCHAR(50),
  status         VARCHAR(20) NOT NULL DEFAULT 'pending',
  admin_note     TEXT,
  payout_method  VARCHAR(50),
  payout_ref     VARCHAR(100),
  payout_proof   TEXT,
  payout_date    DATE,
  reviewed_by    INTEGER REFERENCES users(id),
  reviewed_at    TIMESTAMP,
  created_at     TIMESTAMP DEFAULT NOW()
);

-- Additional tables following the same pattern...
-- (Guests, Check-ins, Check-outs, QR Codes, Feedback, Inquiries, etc.)

-- ─── SETTINGS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  id         SERIAL PRIMARY KEY,
  key        VARCHAR(255) NOT NULL UNIQUE,
  value      TEXT,
  label      VARCHAR(255),
  group_name VARCHAR(50) DEFAULT 'general',
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ─── NOTIFICATIONS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER REFERENCES users(id),
  customer_id  INTEGER REFERENCES customers(id),
  type         VARCHAR(50) NOT NULL,
  title        VARCHAR(255) NOT NULL,
  message      TEXT NOT NULL,
  link         TEXT,
  is_read      INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMP DEFAULT NOW()
);

-- ─── INDEXES ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_reservations_customer ON reservations(customer_id);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
CREATE INDEX IF NOT EXISTS idx_reservations_dates ON reservations(check_in_date, check_out_date);
CREATE INDEX IF NOT EXISTS idx_reservations_ref ON reservations(booking_ref);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_payments_reservation ON payments(reservation_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
