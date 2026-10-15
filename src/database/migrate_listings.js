/**
 * Migration: Update room types, venues, and cottages to approved listings.
 *
 * This script updates the LIVE database without wiping existing reservations.
 * Run once: node src/database/migrate_listings.js
 */
'use strict';

require('dotenv').config();
const Database = require('better-sqlite3');
const path     = require('path');

const DB_PATH = process.env.DB_PATH || './src/database/balai_reserve.db';
const db      = new Database(path.resolve(DB_PATH));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log('[Migrate] Starting listings migration...');

db.transaction(() => {

  // ── 1. ROOM TYPES ─────────────────────────────────────────────────────────
  // Remove old types that are no longer used
  const oldRoomTypes = ['Standard','Deluxe','Suite','Family','Cottage'];
  for (const name of oldRoomTypes) {
    db.prepare(`DELETE FROM room_types WHERE name = ? AND id NOT IN (SELECT DISTINCT room_type_id FROM rooms)`).run(name);
  }

  // Deactivate any rooms still referencing removed types
  db.prepare(`
    UPDATE rooms SET is_active = 0
    WHERE room_type_id IN (
      SELECT id FROM room_types WHERE name IN ('Standard','Deluxe','Suite','Family','Cottage')
    )
  `).run();

  // Upsert the four approved room types
  const upsertRT = db.prepare(`
    INSERT INTO room_types (name, description, base_price)
    VALUES (?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET description=excluded.description, base_price=excluded.base_price
  `);
  upsertRT.run('Casa Standard Room',          'Casa standard room with essential amenities',              3500);
  upsertRT.run('Casa Deluxe Room',            'Casa deluxe room with premium amenities',                  5500);
  upsertRT.run('Villa with Private Pool',     'Private villa featuring an exclusive pool',                8500);
  upsertRT.run('Main House with Private Pool','Spacious main house with a dedicated private pool',       12000);

  // ── 2. ROOMS ──────────────────────────────────────────────────────────────
  // Deactivate ALL old seeded rooms (we'll add the new ones)
  db.prepare(`UPDATE rooms SET is_active = 0 WHERE room_number IN ('101','102','103','201','202','203','301','302','401','402')`).run();

  const roomTypes = {};
  db.prepare('SELECT id, name FROM room_types').all().forEach(rt => { roomTypes[rt.name] = rt.id; });

  const insertRoom = db.prepare(`
    INSERT OR IGNORE INTO rooms
      (room_type_id, room_number, name, description, capacity, price, amenities, floor, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, '', 'available')
  `);
  const amenStandard = JSON.stringify(['WiFi','AC','TV','Hot Shower','Breakfast']);
  const amenDeluxe   = JSON.stringify(['WiFi','AC','TV','Hot Shower','Breakfast','Mini-bar','Balcony']);
  const amenVilla    = JSON.stringify(['WiFi','AC','TV','Hot Shower','Breakfast','Private Pool','Kitchen','Living Area']);
  const amenMain     = JSON.stringify(['WiFi','AC','TV','Hot Shower','Breakfast','Private Pool','Full Kitchen','Living Area','Dining Area','Multiple Rooms']);

  insertRoom.run(roomTypes['Casa Standard Room'],          'CS-01', 'Casa Standard Room 1',     'Cozy casa standard room',                   4, 3500,  amenStandard);
  insertRoom.run(roomTypes['Casa Standard Room'],          'CS-02', 'Casa Standard Room 2',     'Casa standard room with garden view',       4, 3500,  amenStandard);
  insertRoom.run(roomTypes['Casa Deluxe Room'],            'CD-01', 'Casa Deluxe Room 1',       'Spacious casa deluxe room',                 4, 5500,  amenDeluxe);
  insertRoom.run(roomTypes['Casa Deluxe Room'],            'CD-02', 'Casa Deluxe Room 2',       'Casa deluxe room with scenic view',         4, 5500,  amenDeluxe);
  insertRoom.run(roomTypes['Villa with Private Pool'],     'VP-01', 'Villa with Private Pool 1','Private villa with exclusive pool',         8, 8500,  amenVilla);
  insertRoom.run(roomTypes['Villa with Private Pool'],     'VP-02', 'Villa with Private Pool 2','Villa with private pool and garden',        8, 8500,  amenVilla);
  insertRoom.run(roomTypes['Main House with Private Pool'],'MH-01', 'Main House with Private Pool','Full main house with private pool',     20, 12000, amenMain);

  console.log('[Migrate] Room types and rooms updated.');

  // ── 3. VENUES ─────────────────────────────────────────────────────────────
  // Deactivate all old seeded venues
  db.prepare(`UPDATE venues SET is_active = 0`).run();

  const insertVenueM = db.prepare(`
    INSERT INTO venues (name, venue_type, capacity, description, location, price, amenities, status)
    SELECT ?, ?, ?, ?, ?, ?, ?, 'available'
    WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = ? COLLATE NOCASE)
  `);
  const activateVenue = db.prepare(`UPDATE venues SET is_active = 1, venue_type=?, capacity=?, price=?, amenities=? WHERE name = ?`);

  const venueRows = [
    ['Main House Function Hall',     'function_hall', 150, 'Elegant air-conditioned main house function hall',       'Main House',    15000, JSON.stringify(['Sound System','Projector','AC','Stage','Tables','Chairs'])],
    ['Villa Isabella Function Hall', 'function_hall', 100, 'Beautiful Villa Isabella function hall for celebrations','Villa Isabella', 12000, JSON.stringify(['Sound System','Projector','AC','Tables','Chairs'])],
    ['Pavillion Function Hall',      'pavilion',      200, 'Open-air pavilion for large gatherings and events',      'Pavilion Area', 10000, JSON.stringify(['Stage','Sound System','Outdoor Lighting','Tables','Chairs'])],
  ];

  for (const [name, vtype, cap, desc, loc, price, amen] of venueRows) {
    insertVenueM.run(name, vtype, cap, desc, loc, price, amen, name);
    activateVenue.run(vtype, cap, price, amen, name);
  }

  console.log('[Migrate] Venues updated.');

  // ── 4. COTTAGES ───────────────────────────────────────────────────────────
  // Deactivate all old cottages
  db.prepare(`UPDATE cottages SET is_active = 0`).run();

  const insertCottageM = db.prepare(`
    INSERT INTO cottages (name, description, capacity, price, amenities, status)
    SELECT ?, ?, ?, ?, ?, 'available'
    WHERE NOT EXISTS (SELECT 1 FROM cottages WHERE name = ? COLLATE NOCASE)
  `);
  const activateCottage = db.prepare(`UPDATE cottages SET is_active = 1, capacity=?, price=?, amenities=? WHERE name = ?`);

  const cottageRows = [
    ['Cottage',        'Shaded cottage near the pool — ideal for small groups',     5, 500,  JSON.stringify(['Fan','Table','Chairs'])],
    ['Umbrella Table', 'Beachside umbrella table perfect for a cozy group outing',  4, 300,  JSON.stringify(['Umbrella','Table','Chairs'])],
    ['Pavillion',      'Large open pavilion accommodating big gatherings',         60, 2000,  JSON.stringify(['Tables','Chairs','Outdoor Lighting'])],
  ];

  for (const [name, desc, cap, price, amen] of cottageRows) {
    insertCottageM.run(name, desc, cap, price, amen, name);
    activateCottage.run(cap, price, amen, name);
  }

  console.log('[Migrate] Cottages updated.');

})();

db.close();
console.log('[Migrate] Done. Listings have been updated in the live database.');
