'use strict';

const MIN_COLUMN_WIDTH = 12;
const MAX_COLUMN_WIDTH = 50;

function isDateColumn(header) {
  return /(?:_date|_at)$/.test(header);
}

function formatExcelValue(value, header) {
  if (value == null) return '';
  if (!(value instanceof Date)) return value;
  if (Number.isNaN(value.getTime())) return '';

  const timestamp = value.toISOString();
  return header.endsWith('_at')
    ? `${timestamp.slice(0, 10)} ${timestamp.slice(11, 19)}`
    : timestamp.slice(0, 10);
}

function getColumnWidth(label, values, dataKey = label) {
  const longestValue = values.reduce((longest, value) => {
    const length = String(value ?? '').length;
    return Math.max(longest, length);
  }, label.length);

  const dateWidth = isDateColumn(dataKey) ? (dataKey.endsWith('_at') ? 21 : 12) : MIN_COLUMN_WIDTH;
  return Math.min(Math.max(longestValue + 2, dateWidth), MAX_COLUMN_WIDTH);
}

module.exports = { formatExcelValue, getColumnWidth };
