'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { uniqueCatalogRows } = require('../src/utils/catalog');

test('returns one listing for each case-insensitive name and prefers available records', () => {
  const rows = [
    { id: 1, name: 'Pavilion', status: 'reserved' },
    { id: 2, name: 'pavilion', status: 'available' },
    { id: 3, name: 'Garden Hall', status: 'available' },
  ];

  assert.deepEqual(uniqueCatalogRows(rows), [rows[1], rows[2]]);
});

test('preserves a specifically selected duplicate listing', () => {
  const rows = [
    { id: 4, name: 'Cottage', status: 'available' },
    { id: 9, name: 'Cottage', status: 'available' },
  ];

  assert.deepEqual(uniqueCatalogRows(rows, row => row.name, '9'), [rows[1]]);
});

test('keeps differently named event packages separate', () => {
  const rows = [
    { id: 1, name: 'Wedding Package A', event_type: 'wedding' },
    { id: 2, name: 'Wedding Package B', event_type: 'wedding' },
    { id: 3, name: 'Birthday Package', event_type: 'birthday' },
  ];

  assert.deepEqual(uniqueCatalogRows(rows, row => `${row.event_type}:${row.name}`), rows);
});
