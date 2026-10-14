-- ============================================================
-- Balai-Reserve Database Schema
-- SQLite (better-sqlite3)
-- ============================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- ─── ROLES ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,           -- admin, staff, customer
  label      TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ─── USERS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  role_id        INTEGER NOT NULL REFERENCES roles(id),
  first_name     TEXT NOT NULL,
  last_name      TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL DEFAULT '',
  phone          TEXT,
  avatar         TEXT,
  google_sub     TEXT,
  is_active      INTEGER NOT NULL DEFAULT 1,
  last_login     TEXT,
  created_at     TEXT DEFAULT (datetime('now')),
  updated_at     TEXT DEFAULT (datetime('now'))
);

-- ─── CUSTOMERS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id              INTEGER REFERENCES users(id) ON DELETE SET NULL,
  customer_code        TEXT UNIQUE,
  first_name           TEXT NOT NULL,
  last_name            TEXT NOT NULL,
  email                TEXT,
  phone                TEXT,
  address              TEXT,
  preferred_contact    TEXT DEFAULT 'email',  -- email, phone, sms
  customer_type        TEXT DEFAULT 'regular', -- regular, vip, corporate
  status               TEXT DEFAULT 'active',  -- active, inactive, blacklisted
  notes                TEXT,
  created_at           TEXT DEFAULT (datetime('now')),
  updated_at           TEXT DEFAULT (datetime('now'))
);

-- ─── ROOM TYPES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS room_types (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,   -- Standard, Deluxe, Suite, Family, etc.
  description TEXT,
  base_price  REAL NOT NULL DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now'))
);

-- ─── ROOMS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rooms (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  room_type_id INTEGER NOT NULL REFERENCES room_types(id),
  room_number  TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  description  TEXT,
  capacity     INTEGER NOT NULL DEFAULT 2,
  price        REAL NOT NULL,
  amenities    TEXT,              -- JSON array string
  images       TEXT,              -- JSON array of image paths
  floor        TEXT,
  status       TEXT NOT NULL DEFAULT 'available',
               -- available | reserved | occupied | cleaning | maintenance | unavailable
  is_active    INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT DEFAULT (datetime('now')),
  updated_at   TEXT DEFAULT (datetime('now'))
);

-- ─── VENUES ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS venues (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  venue_type   TEXT NOT NULL,
               -- function_hall | outdoor | garden | pavilion | poolside | event_space
  capacity     INTEGER NOT NULL DEFAULT 50,
  description  TEXT,
  location     TEXT,
  price        REAL NOT NULL DEFAULT 0,
  price_note   TEXT,
  amenities    TEXT,              -- JSON array
  images       TEXT,              -- JSON array
  status       TEXT NOT NULL DEFAULT 'available',
  is_active    INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT DEFAULT (datetime('now')),
  updated_at   TEXT DEFAULT (datetime('now'))
);

-- ─── COTTAGES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cottages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  description TEXT,
  capacity    INTEGER NOT NULL DEFAULT 10,
  price       REAL NOT NULL DEFAULT 0,
  amenities   TEXT,
  images      TEXT,
  status      TEXT NOT NULL DEFAULT 'available',
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);

-- ─── EVENT PACKAGES ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_packages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  description TEXT,
  event_type  TEXT,   -- wedding | birthday | corporate | debut | party | meeting | other
  price       REAL NOT NULL DEFAULT 0,
  inclusions  TEXT,   -- JSON array of what is included
  capacity    INTEGER,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);

-- ─── RESERVATIONS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reservations (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_ref        TEXT NOT NULL UNIQUE,
  customer_id        INTEGER NOT NULL REFERENCES customers(id),
  reservation_type   TEXT NOT NULL,   -- room | venue | event | cottage
  check_in_date      TEXT,
  check_out_date     TEXT,
  event_date         TEXT,
  start_time         TEXT,
  end_time           TEXT,
  num_guests         INTEGER NOT NULL DEFAULT 1,
  special_requests   TEXT,
  total_amount       REAL NOT NULL DEFAULT 0,
  downpayment_req    REAL NOT NULL DEFAULT 0,
  status             TEXT NOT NULL DEFAULT 'pending',
               -- pending | awaiting_payment | confirmed | checked_in | completed | cancelled | rejected | no_show
  payment_status     TEXT NOT NULL DEFAULT 'unpaid',
               -- unpaid | partially_paid | fully_paid | refunded
  payment_method     TEXT DEFAULT 'cash',  -- cash | gcash | bank_transfer | credit_card | check
  assigned_staff_id  INTEGER REFERENCES users(id),
  notes              TEXT,
  source             TEXT DEFAULT 'walk_in',  -- walk_in | online | phone | staff
  created_at         TEXT DEFAULT (datetime('now')),
  updated_at         TEXT DEFAULT (datetime('now'))
);

-- ─── RESERVATION ITEMS ────────────────────────────────────────
-- Links a reservation to rooms/venues/cottages/events
CREATE TABLE IF NOT EXISTS reservation_items (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  reservation_id  INTEGER NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  item_type       TEXT NOT NULL,   -- room | venue | cottage | event_package | equipment
  item_id         INTEGER NOT NULL,
  item_name       TEXT,
  quantity        INTEGER NOT NULL DEFAULT 1,
  unit_price      REAL NOT NULL DEFAULT 0,
  total_price     REAL NOT NULL DEFAULT 0,
  notes           TEXT,
  created_at      TEXT DEFAULT (datetime('now'))
);

-- ─── EVENTS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  reservation_id   INTEGER REFERENCES reservations(id),
  customer_id      INTEGER NOT NULL REFERENCES customers(id),
  event_package_id INTEGER REFERENCES event_packages(id),
  venue_id         INTEGER REFERENCES venues(id),
  event_name       TEXT NOT NULL,
  event_type       TEXT NOT NULL,
  event_date       TEXT NOT NULL,
  start_time       TEXT NOT NULL,
  end_time         TEXT NOT NULL,
  num_attendees    INTEGER NOT NULL DEFAULT 1,
  special_requests TEXT,
  equipment_needs  TEXT,   -- JSON array
  status           TEXT NOT NULL DEFAULT 'pending',
  total_cost       REAL NOT NULL DEFAULT 0,
  payment_status   TEXT NOT NULL DEFAULT 'unpaid',
  notes            TEXT,
  created_at       TEXT DEFAULT (datetime('now')),
  updated_at       TEXT DEFAULT (datetime('now'))
);

-- ─── PAYMENTS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  reservation_id   INTEGER NOT NULL REFERENCES reservations(id),
  reference_number TEXT UNIQUE,
  amount           REAL NOT NULL DEFAULT 0,
  payment_method   TEXT NOT NULL DEFAULT 'cash',  -- cash | gcash | bank_transfer | credit_card | check
  payment_date     TEXT NOT NULL,
  payment_type     TEXT NOT NULL DEFAULT 'downpayment',  -- downpayment | full_payment | balance | refund
  status           TEXT NOT NULL DEFAULT 'received',    -- received | verified | refunded
  received_by      INTEGER REFERENCES users(id),
  proof_image      TEXT,                                 -- uploaded payment proof image path
  submitted_by     TEXT DEFAULT 'staff',                 -- staff | customer
  verified_by      INTEGER REFERENCES users(id),         -- staff who verified the payment
  verified_at      TEXT,                                 -- when the payment was verified
  notes            TEXT,
  created_at       TEXT DEFAULT (datetime('now'))
);

-- ─── REFUND REQUESTS ──────────────────────────────────────────
-- Customer-initiated refund requests that staff/admin review before approving.
CREATE TABLE IF NOT EXISTS refund_requests (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  reservation_id INTEGER NOT NULL REFERENCES reservations(id),
  customer_id    INTEGER REFERENCES customers(id),
  amount         REAL NOT NULL DEFAULT 0,        -- amount the customer paid / is requesting back
  reason         TEXT,                           -- customer's reason for the refund
  gcash_number   TEXT,                           -- guest's GCash number to receive the refund
  status         TEXT NOT NULL DEFAULT 'pending',-- pending | approved | rejected
  admin_note     TEXT,                           -- staff note on approval/rejection
  payout_method  TEXT,                           -- gcash | cash | bank (how the refund was paid out)
  payout_ref     TEXT,                           -- GCash/bank transaction reference of the payout
  payout_proof   TEXT,                           -- filename of the uploaded refund payout screenshot
  payout_date    TEXT,                           -- date the refund was paid out
  reviewed_by    INTEGER REFERENCES users(id),   -- staff who reviewed
  reviewed_at    TEXT,
  created_at     TEXT DEFAULT (datetime('now'))
);

-- ─── GUESTS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS guests (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  reservation_id      INTEGER NOT NULL REFERENCES reservations(id),
  customer_id         INTEGER REFERENCES customers(id),
  first_name          TEXT NOT NULL,
  last_name           TEXT NOT NULL,
  email               TEXT,
  phone               TEXT,
  address             TEXT,
  id_type             TEXT,    -- passport | drivers_license | national_id | other
  id_number           TEXT,
  num_guests          INTEGER NOT NULL DEFAULT 1,
  special_requests    TEXT,
  status              TEXT NOT NULL DEFAULT 'expected',  -- expected | checked_in | checked_out | no_show
  created_at          TEXT DEFAULT (datetime('now')),
  updated_at          TEXT DEFAULT (datetime('now'))
);

-- ─── CHECK-INS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS check_ins (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  reservation_id INTEGER NOT NULL REFERENCES reservations(id),
  guest_id       INTEGER REFERENCES guests(id),
  checked_in_at  TEXT NOT NULL DEFAULT (datetime('now')),
  checked_in_by  INTEGER REFERENCES users(id),
  method         TEXT DEFAULT 'manual',  -- manual | qr
  notes          TEXT
);

-- ─── CHECK-OUTS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS check_outs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  reservation_id  INTEGER NOT NULL REFERENCES reservations(id),
  guest_id        INTEGER REFERENCES guests(id),
  checked_out_at  TEXT NOT NULL DEFAULT (datetime('now')),
  checked_out_by  INTEGER REFERENCES users(id),
  notes           TEXT
);

-- ─── QR CODES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS qr_codes (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  reservation_id INTEGER NOT NULL REFERENCES reservations(id),
  token          TEXT NOT NULL UNIQUE,
  qr_path        TEXT,             -- file path to generated QR image
  used           INTEGER NOT NULL DEFAULT 0,
  used_at        TEXT,
  expires_at     TEXT,
  created_at     TEXT DEFAULT (datetime('now'))
);

-- ─── FEEDBACK & RATINGS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS feedback (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  reservation_id INTEGER NOT NULL REFERENCES reservations(id),
  customer_id    INTEGER NOT NULL REFERENCES customers(id),
  rating         INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  category       TEXT,   -- room | venue | service | event | overall
  comments       TEXT,
  suggestions    TEXT,
  is_public      INTEGER NOT NULL DEFAULT 1,
  admin_response TEXT,
  responded_by   INTEGER REFERENCES users(id),
  responded_at   TEXT,
  created_at     TEXT DEFAULT (datetime('now'))
);

-- ─── INQUIRIES ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inquiries (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id  INTEGER REFERENCES customers(id),
  name         TEXT,
  email        TEXT,
  phone        TEXT,
  subject      TEXT NOT NULL,
  message      TEXT NOT NULL,
  category     TEXT DEFAULT 'general',  -- general | room | venue | event | pricing | complaint | other
  source       TEXT DEFAULT 'website',  -- website | chatbot | email | phone | walk_in
  status       TEXT NOT NULL DEFAULT 'open',  -- open | in_progress | escalated | resolved | closed
  assigned_to  INTEGER REFERENCES users(id),
  resolution   TEXT,
  resolved_at  TEXT,
  created_at   TEXT DEFAULT (datetime('now')),
  updated_at   TEXT DEFAULT (datetime('now'))
);

-- ─── CRM ACTIVITIES ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_activities (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id   INTEGER NOT NULL REFERENCES customers(id),
  activity_type TEXT NOT NULL,  -- call | email | chat | support | follow_up | inquiry | complaint | feedback
  subject       TEXT,
  description   TEXT,
  staff_id      INTEGER REFERENCES users(id),
  status        TEXT DEFAULT 'completed',  -- scheduled | completed | cancelled
  scheduled_at  TEXT,
  completed_at  TEXT,
  follow_up_at  TEXT,
  outcome       TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
);

-- ─── SALES CALLS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales_calls (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id   INTEGER NOT NULL REFERENCES customers(id),
  staff_id      INTEGER NOT NULL REFERENCES users(id),
  call_date     TEXT NOT NULL,
  call_time     TEXT,
  purpose       TEXT NOT NULL,
  result        TEXT,
  notes         TEXT,
  follow_up_at  TEXT,
  status        TEXT NOT NULL DEFAULT 'completed',  -- scheduled | completed | no_answer | cancelled
  created_at    TEXT DEFAULT (datetime('now'))
);

-- ─── MARKETING EMAILS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS marketing_emails (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id   INTEGER REFERENCES customers(id),
  campaign      TEXT,
  recipient     TEXT NOT NULL,
  subject       TEXT NOT NULL,
  body          TEXT,
  sent_at       TEXT,
  status        TEXT NOT NULL DEFAULT 'draft',  -- draft | sent | failed | bounced
  follow_up_at  TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
);

-- ─── SUPPORT TICKETS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_tickets (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_number   TEXT NOT NULL UNIQUE,
  customer_id     INTEGER REFERENCES customers(id),
  inquiry_id      INTEGER REFERENCES inquiries(id),
  subject         TEXT NOT NULL,
  description     TEXT NOT NULL,
  category        TEXT DEFAULT 'general',
  priority        TEXT NOT NULL DEFAULT 'normal',  -- low | normal | high | urgent
  assigned_to     INTEGER REFERENCES users(id),
  status          TEXT NOT NULL DEFAULT 'open',    -- open | in_progress | resolved | closed
  resolution      TEXT,
  resolved_at     TEXT,
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

-- ─── INVENTORY CATEGORIES ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);

-- ─── INVENTORY ITEMS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_items (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id     INTEGER NOT NULL REFERENCES inventory_categories(id),
  item_code       TEXT UNIQUE,
  name            TEXT NOT NULL,
  description     TEXT,
  unit            TEXT DEFAULT 'pcs',
  total_qty       INTEGER NOT NULL DEFAULT 0,
  available_qty   INTEGER NOT NULL DEFAULT 0,
  reserved_qty    INTEGER NOT NULL DEFAULT 0,
  damaged_qty     INTEGER NOT NULL DEFAULT 0,
  reorder_level   INTEGER NOT NULL DEFAULT 5,
  location        TEXT,
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

-- ─── INVENTORY TRANSACTIONS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id        INTEGER NOT NULL REFERENCES inventory_items(id),
  transaction_type TEXT NOT NULL,  -- reserved | released | damaged | repaired | added | removed | lost
  quantity       INTEGER NOT NULL DEFAULT 1,
  reference_id   INTEGER,          -- reservation_id or event_id
  reference_type TEXT,             -- reservation | event
  performed_by   INTEGER REFERENCES users(id),
  notes          TEXT,
  created_at     TEXT DEFAULT (datetime('now'))
);

-- ─── EQUIPMENT ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS equipment (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id       INTEGER REFERENCES inventory_categories(id),
  equipment_code    TEXT UNIQUE,
  name              TEXT NOT NULL,
  description       TEXT,
  quantity          INTEGER NOT NULL DEFAULT 1,
  condition         TEXT NOT NULL DEFAULT 'good',
                    -- excellent | good | needs_maintenance | damaged | lost
  available_qty     INTEGER NOT NULL DEFAULT 1,
  maintenance_notes TEXT,
  is_active         INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT DEFAULT (datetime('now')),
  updated_at        TEXT DEFAULT (datetime('now'))
);

-- ─── EQUIPMENT ASSIGNMENTS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS equipment_assignments (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  equipment_id    INTEGER NOT NULL REFERENCES equipment(id),
  reservation_id  INTEGER REFERENCES reservations(id),
  event_id        INTEGER REFERENCES events(id),
  quantity        INTEGER NOT NULL DEFAULT 1,
  assigned_by     INTEGER REFERENCES users(id),
  date_assigned   TEXT NOT NULL DEFAULT (datetime('now')),
  expected_return TEXT,
  actual_return   TEXT,
  condition_out   TEXT DEFAULT 'good',
  condition_in    TEXT,
  status          TEXT NOT NULL DEFAULT 'assigned',  -- assigned | returned | damaged | lost
  notes           TEXT,
  created_at      TEXT DEFAULT (datetime('now'))
);

-- ─── NOTIFICATIONS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER REFERENCES users(id),
  customer_id  INTEGER REFERENCES customers(id),
  type         TEXT NOT NULL,    -- reservation | payment | event | inventory | system | inquiry
  title        TEXT NOT NULL,
  message      TEXT NOT NULL,
  link         TEXT,
  is_read      INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT DEFAULT (datetime('now'))
);

-- ─── AUTOMATED FOLLOW-UPS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS follow_ups (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  reservation_id INTEGER REFERENCES reservations(id),
  customer_id    INTEGER NOT NULL REFERENCES customers(id),
  follow_up_type TEXT NOT NULL,  -- booking_inquiry | payment_reminder | event_reminder | checkin_reminder | post_stay | feedback_request
  scheduled_at   TEXT NOT NULL,
  sent_at        TEXT,
  status         TEXT NOT NULL DEFAULT 'pending',  -- pending | sent | failed | skipped
  message        TEXT,
  created_at     TEXT DEFAULT (datetime('now'))
);

-- ─── AUDIT LOGS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER REFERENCES users(id),
  action       TEXT NOT NULL,
  module       TEXT NOT NULL,
  record_id    INTEGER,
  old_values   TEXT,   -- JSON
  new_values   TEXT,   -- JSON
  ip_address   TEXT,
  user_agent   TEXT,
  created_at   TEXT DEFAULT (datetime('now'))
);

-- ─── AI INSIGHTS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_insights (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  insight_type  TEXT NOT NULL,   -- trend | recommendation | forecast | alert
  category      TEXT,            -- reservations | revenue | inventory | events | satisfaction
  title         TEXT NOT NULL,
  message       TEXT NOT NULL,
  data_basis    TEXT,            -- JSON: supporting data used to generate insight
  confidence    TEXT,            -- low | medium | high
  is_dismissed  INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT DEFAULT (datetime('now'))
);

-- ─── SYSTEM SETTINGS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  key        TEXT NOT NULL UNIQUE,
  value      TEXT,
  label      TEXT,
  group_name TEXT DEFAULT 'general',
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ─── RESERVATION STATUS HISTORY ───────────────────────────────
CREATE TABLE IF NOT EXISTS reservation_status_history (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  reservation_id INTEGER NOT NULL REFERENCES reservations(id),
  from_status    TEXT,
  to_status      TEXT NOT NULL,
  changed_by     INTEGER REFERENCES users(id),
  notes          TEXT,
  created_at     TEXT DEFAULT (datetime('now'))
);

-- ─── INDEXES ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_reservations_customer   ON reservations(customer_id);
CREATE INDEX IF NOT EXISTS idx_reservations_status     ON reservations(status);
CREATE INDEX IF NOT EXISTS idx_reservations_dates      ON reservations(check_in_date, check_out_date);
CREATE INDEX IF NOT EXISTS idx_reservations_ref        ON reservations(booking_ref);
CREATE INDEX IF NOT EXISTS idx_events_date             ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_payments_reservation    ON payments(reservation_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user      ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_guests_reservation      ON guests(reservation_id);
CREATE INDEX IF NOT EXISTS idx_crm_customer            ON crm_activities(customer_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_cat     ON inventory_items(category_id);
CREATE INDEX IF NOT EXISTS idx_audit_user              ON audit_logs(user_id);
