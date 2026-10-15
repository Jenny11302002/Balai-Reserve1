'use strict';

function uniqueCatalogRows(rows, keyForRow = row => row.name, preferredId = null) {
  const winners = new Map();

  for (const [index, row] of rows.entries()) {
    const normalizedKey = String(keyForRow(row) || '').trim().toLowerCase();
    const key = normalizedKey || `__unnamed_${row.id ?? index}`;
    const current = winners.get(key);

    if (!current) {
      winners.set(key, row);
      continue;
    }

    const rowIsPreferred = preferredId != null && String(row.id) === String(preferredId);
    const currentIsPreferred = preferredId != null && String(current.id) === String(preferredId);
    const rowIsAvailable = row.status === 'available';
    const currentIsAvailable = current.status === 'available';

    if (
      (rowIsPreferred && !currentIsPreferred) ||
      (rowIsPreferred === currentIsPreferred && rowIsAvailable && !currentIsAvailable) ||
      (rowIsPreferred === currentIsPreferred && rowIsAvailable === currentIsAvailable && row.id < current.id)
    ) {
      winners.set(key, row);
    }
  }

  const winningRows = new Set(winners.values());
  return rows.filter(row => winningRows.has(row));
}

module.exports = { uniqueCatalogRows };
