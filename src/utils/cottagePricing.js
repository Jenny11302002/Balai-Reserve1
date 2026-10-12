'use strict';

function timeToMinutes(time) {
  if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const [hours, minutes] = time.split(':').map(Number);
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
  return rate * (durationMinutes / 60);
}

module.exports = {
  calculateCottageTotal,
  validateCottageTimeRange,
};
