'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { formatExcelValue, getColumnWidth } = require('../src/modules/reports/xlsxFormatting');

test('formats date values as readable text for Excel exports', () => {
  assert.equal(
    formatExcelValue(new Date('2026-10-15T14:05:06.000Z'), 'check_in_date'),
    '2026-10-15'
  );
  assert.equal(
    formatExcelValue(new Date('2026-10-15T14:05:06.000Z'), 'created_at'),
    '2026-10-15 14:05:06'
  );
});

test('keeps non-date values and empty cells unchanged', () => {
  assert.equal(formatExcelValue('awaiting_payment', 'status'), 'awaiting_payment');
  assert.equal(formatExcelValue(3500, 'total_amount'), 3500);
  assert.equal(formatExcelValue(null, 'event_date'), '');
  assert.equal(formatExcelValue(new Date('invalid'), 'event_date'), '');
});

test('sizes report columns for their headers and longest values', () => {
  assert.equal(getColumnWidth('Booking Ref', ['BK-2026-00001234'], 'booking_ref'), 18);
  assert.equal(getColumnWidth('status', ['awaiting_payment']), 18);
  assert.equal(getColumnWidth('Check In Date', ['2026-10-15'], 'check_in_date'), 15);
  assert.equal(getColumnWidth('Created At', ['2026-10-15 14:05:06'], 'created_at'), 21);
});

test('caps long text columns while preserving room for wrapping', () => {
  assert.equal(getColumnWidth('customer', ['A'.repeat(100)]), 50);
});
