'use strict';

function timeToMinutes(time) {
  if (time === null || time === undefined) return null;
  const value = String(time).trim();
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function validateCottageTimeRange(startTime, endTime) {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  return startMinutes !== null && endMinutes !== null && endMinutes > startMinutes;
}

function calculateCottageTotal(hourlyRate, startTime, endTime, wholeDayRate = false) {
  const rate = Number(hourlyRate);
  if (!Number.isFinite(rate) || rate < 0) return 0;
  if (wholeDayRate) return rate;
  if (!validateCottageTimeRange(startTime, endTime)) return 0;

  const durationMinutes = timeToMinutes(endTime) - timeToMinutes(startTime);
  return Number((rate * (durationMinutes / 60)).toFixed(2));
}

module.exports = {
  calculateCottageTotal,
  validateCottageTimeRange,
};
