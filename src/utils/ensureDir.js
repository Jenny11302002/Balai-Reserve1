/**
 * Safe directory creation for serverless environments
 * Skips on Vercel where filesystem is read-only
 */
'use strict';

const fs = require('fs');

function ensureDir(dirPath) {
  // Skip on Vercel/serverless
  if (process.env.VERCEL === '1') {
    return false;
  }
  
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    return true;
  } catch (err) {
    console.warn(`Could not create directory ${dirPath} (serverless environment):`, err.message);
    return false;
  }
}

module.exports = { ensureDir };
