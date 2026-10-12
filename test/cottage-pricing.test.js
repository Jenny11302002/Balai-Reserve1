'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  calculateCottageTotal,
  validateCottageTimeRange,
} = require('../src/utils/cottagePricing');

test('calculates an hourly cottage total from duration', () => {
  assert.equal(calculateCottageTotal(500, '14:00', '16:00'), 1000);
});

test('charges a whole-day cottage rate once regardless of selected hours', () => {
  assert.equal(calculateCottageTotal(300, '09:00', '17:00', true), 300);
});

test('rejects a cottage end time that is not after its start time', () => {
  assert.equal(validateCottageTimeRange('16:00', '14:00'), false);
  assert.equal(validateCottageTimeRange('14:00', '14:00'), false);
});

test('accepts a valid cottage time range', () => {
  assert.equal(validateCottageTimeRange('14:00', '16:00'), true);
});
