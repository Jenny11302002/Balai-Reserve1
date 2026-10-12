'use strict';

const RESOURCE_TABLES = {
  room: 'rooms',
  cottage: 'cottages',
  venue: 'venues',
};

function releaseReservationItems(db, reservationId) {
  const items = db.prepare(`
    SELECT item_type, item_id
    FROM reservation_items
    WHERE reservation_id = ?
      AND item_type IN ('room', 'cottage', 'venue')
  `).all(reservationId);

  const transaction = db.transaction(() => {
    for (const item of items) {
      const table = RESOURCE_TABLES[item.item_type];
      if (!table) continue;

      db.prepare(`
        UPDATE ${table}
        SET status = 'available', updated_at = datetime('now')
        WHERE id = ?
      `).run(item.item_id);
    }
  });

  transaction();
}

function reconcileExpiredReservations(db) {
  const today = new Date().toISOString().slice(0, 10);
  const currentTime = new Date().toTimeString().slice(0, 5);
  const expiredReservations = db.prepare(`
    SELECT id, reservation_type, check_out_date, event_date, start_time, end_time
    FROM reservations
    WHERE status NOT IN ('completed', 'cancelled', 'rejected', 'no_show')
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
    const previousStatus = db.prepare(`
      SELECT status FROM reservations WHERE id = ?
    `).get(reservation.id).status;

    db.prepare(`
      UPDATE reservations
      SET status = 'completed', updated_at = datetime('now')
      WHERE id = ? AND status NOT IN ('completed', 'cancelled', 'rejected', 'no_show')
    `).run(reservation.id);

    db.prepare(`
      INSERT INTO reservation_status_history
        (reservation_id, from_status, to_status, changed_by, notes)
      VALUES (?, ?, 'completed', NULL, 'Automatically completed after the reservation date passed')
    `).run(reservation.id, previousStatus);

    releaseReservationItems(db, reservation.id);
  });

  for (const reservation of expiredReservations) {
    completeReservation(reservation);
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
