'use strict';

const RESOURCE_TABLES = {
  room: 'rooms',
  cottage: 'cottages',
  venue: 'venues',
};

const FINAL_RESERVATION_STATUSES = new Set([
  'completed',
  'cancelled',
  'rejected',
  'no_show',
  'checked_out',
]);

// Synchronous: better-sqlite3 does not use promises.
// Call this INSIDE an existing transaction to join it, or on its own.
function releaseReservationItems(db, reservationId) {
  const items = db.prepare(`
    SELECT item_type, item_id
    FROM reservation_items
    WHERE reservation_id = ?
      AND item_type IN ('room', 'cottage', 'venue')
  `).all(reservationId);

  for (const item of items) {
    const table = RESOURCE_TABLES[item.item_type];
    if (!table) continue;

    db.prepare(`
      UPDATE ${table}
      SET status = 'available', updated_at = datetime('now')
      WHERE id = ?
    `).run(item.item_id);
  }
}

function reconcileExpiredReservations(db) {
  const today = new Date().toISOString().slice(0, 10);
  const currentTime = new Date().toTimeString().slice(0, 5);

  const expiredReservations = db.prepare(`
    SELECT id, reservation_type, check_in_date, check_out_date, event_date, start_time, end_time
    FROM reservations
    WHERE status NOT IN ('completed', 'cancelled', 'rejected', 'no_show', 'checked_out')
      AND (
        (reservation_type = 'room' AND check_out_date IS NOT NULL AND check_out_date <= ?)
        OR
        (reservation_type = 'cottage' AND check_in_date IS NOT NULL AND (
          (check_out_date IS NOT NULL AND check_out_date <= ?)
          OR
          (check_out_date IS NULL AND end_time IS NOT NULL AND (
            check_in_date < ? OR (check_in_date = ? AND end_time <= ?)
          ))
        ))
        OR
        (reservation_type IN ('venue', 'event') AND event_date IS NOT NULL AND event_date <= ?)
      )
  `).all(today, today, today, today, currentTime, today);

  const completeReservation = db.transaction((reservation) => {
    const row = db.prepare(`
      SELECT status FROM reservations WHERE id = ?
    `).get(reservation.id);

    const previousStatus = row ? row.status : null;
    if (!previousStatus || FINAL_RESERVATION_STATUSES.has(previousStatus)) {
      return;
    }

    db.prepare(`
      UPDATE reservations
      SET status = 'completed', updated_at = datetime('now')
      WHERE id = ?
        AND status NOT IN ('completed', 'cancelled', 'rejected', 'no_show', 'checked_out')
    `).run(reservation.id);

    db.prepare(`
      INSERT INTO reservation_status_history
        (reservation_id, from_status, to_status, changed_by, notes)
      VALUES (?, ?, 'completed', NULL, 'Automatically completed after the reservation date passed')
    `).run(reservation.id, previousStatus);

    // Now runs INSIDE the transaction (before it was a floating promise outside it)
    releaseReservationItems(db, reservation.id);
  });

  let completed = 0;

  for (const reservation of expiredReservations) {
    try {
      completeReservation(reservation);
      completed += 1;
    } catch (err) {
      console.error(`[reconciler] Failed to complete reservation ${reservation.id}:`, err);
    }
  }

  return completed;
}

function startReservationAvailabilityReconciler(db, intervalMs = 60000) {
  const run = () => {
    try {
      const count = reconcileExpiredReservations(db);
      if (count > 0) console.log(`[reconciler] Auto-completed ${count} expired reservation(s)`);
    } catch (err) {
      console.error('[reconciler] Error during reconciliation:', err);
    }'use strict';

const RESOURCE_TABLES = {
  room: 'rooms',
  cottage: 'cottages',
  venue: 'venues',
};

const FINAL_RESERVATION_STATUSES = new Set([
  'completed',
  'cancelled',
  'rejected',
  'no_show',
  'checked_out',
]);

async function releaseReservationItems(db, reservationId) {
  const [items] = await db.execute(`
    SELECT item_type, item_id
    FROM reservation_items
    WHERE reservation_id = ?
      AND item_type IN ('room', 'cottage', 'venue')
  `, [reservationId]);

  for (const item of items) {
    const table = RESOURCE_TABLES[item.item_type];
    if (!table) continue;

    await db.execute(`
      UPDATE ${table}
      SET status = 'available', updated_at = NOW()
      WHERE id = ?
    `, [item.item_id]);
  }
}

async function reconcileExpiredReservations(db) {
  const today = new Date().toISOString().slice(0, 10);
  const currentTime = new Date().toTimeString().slice(0, 5);
  
  const [expiredReservations] = await db.execute(`
    SELECT id, reservation_type, check_out_date, event_date, start_time, end_time, check_in_date
    FROM reservations
    WHERE status NOT IN ('completed', 'cancelled', 'rejected', 'no_show', 'checked_out')
      AND (
        (reservation_type = 'room' AND check_out_date IS NOT NULL AND check_out_date <= ?)
        OR
        (reservation_type = 'cottage' AND check_in_date IS NOT NULL AND (
          (check_out_date IS NOT NULL AND check_out_date <= ?)
          OR
          (check_out_date IS NULL AND end_time IS NOT NULL AND (
            check_in_date < ? OR (check_in_date = ? AND end_time <= ?)
          ))
        ))
        OR
        (reservation_type IN ('venue', 'event') AND event_date IS NOT NULL AND event_date <= ?)
      )
  `, [today, today, today, today, currentTime, today]);

  for (const reservation of expiredReservations) {
    const [rows] = await db.execute(`SELECT status FROM reservations WHERE id = ?`, [reservation.id]);
    const previousStatus = rows.length > 0 ? rows[0].status : null;

    if (!previousStatus || FINAL_RESERVATION_STATUSES.has(previousStatus)) {
      continue;
    }

    await db.execute(`
      UPDATE reservations
      SET status = 'completed', updated_at = NOW()
      WHERE id = ? AND status NOT IN ('completed', 'cancelled', 'rejected', 'no_show', 'checked_out')
    `, [reservation.id]);

    await db.execute(`
      INSERT INTO reservation_status_history
        (reservation_id, from_status, to_status, changed_by, notes)
      VALUES (?, ?, 'completed', NULL, 'Automatically completed after the reservation date passed')
    `, [reservation.id, previousStatus]);

    await releaseReservationItems(db, reservation.id);
  }

  return expiredReservations.length;
}

function startReservationAvailabilityReconciler(db, intervalMs = 60000) {
  reconcileExpiredReservations(db);
  return setInterval(() => reconcileExpiredReservations(db), intervalMs);
}

module.exports = {
  reconcileExpiredReservations,
  startReservationAvailabilityReconciler,
};
  };

  run();
  return setInterval(run, intervalMs);
}

module.exports = {
  releaseReservationItems,
  reconcileExpiredReservations,
  startReservationAvailabilityReconciler,
};