/**
 * GCash Screenshot Validator
 * ---------------------------
 * Uses OCR (tesseract.js) to read the text out of an uploaded image and
 * checks for the markers that a genuine GCash payment receipt always contains:
 *
 *   - the word "GCash"            (e.g. "Sent via GCash")
 *   - a reference-number pattern  (e.g. "Ref No. 4044 288 513679")
 *   - an amount pattern           (e.g. "₱300.00" / "Total Amount Sent")
 *   - money keywords              ("amount", "sent")
 *
 * IMPORTANT: This is fraud *deterrence*, not fraud *proof*. It rejects images
 * that are clearly not GCash receipts (selfies, memes, random photos, wrong
 * app receipts). It CANNOT prove a transfer actually happened or detect a
 * skilfully edited image — staff verification remains the final authority.
 */
'use strict';

const { createWorker } = require('tesseract.js');

/**
 * Normalise OCR text for robust matching:
 * lowercase, collapse whitespace, strip odd characters.
 */
function normalize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[|]/g, 'i')        // OCR often reads 'l'/'I' as '|'
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Run OCR on an image file and return the raw recognised text.
 * @param {string} filePath absolute path to the image
 * @returns {Promise<string>}
 */
async function ocrImage(filePath) {
  const worker = await createWorker('eng');
  try {
    const { data } = await worker.recognize(filePath);
    return data.text || '';
  } finally {
    await worker.terminate();
  }
}

/**
 * Validate that an image looks like a genuine GCash payment receipt.
 *
 * @param {string} filePath absolute path to the uploaded image
 * @returns {Promise<{
 *   valid: boolean,
 *   score: number,
 *   reasons: string[],
 *   extracted: { refNo: string|null, amount: number|null },
 *   rawText: string
 * }>}
 */
async function validateGcashScreenshot(filePath) {
  let rawText = '';
  try {
    rawText = await ocrImage(filePath);
  } catch (err) {
    // OCR engine failure should not hard-block — treat as "couldn't read".
    return {
      valid: false,
      score: 0,
      reasons: ['Could not read the image. Please upload a clear GCash screenshot.'],
      extracted: { refNo: null, amount: null },
      rawText: '',
      ocrFailed: true,
    };
  }

  const text = normalize(rawText);
  const reasons = [];
  let score = 0;

  // ── Marker 1: the GCash brand word ──────────────────────────────────────
  // Accept common OCR misreads of "gcash". On real receipts this is often
  // small grey text ("Sent via GCash") that OCR can miss — so it's a strong
  // positive signal when present, but NOT a hard requirement on its own.
  const hasGcash = /\bg\s?cash\b/.test(text) || /\bgcas[hn]\b/.test(text) || text.includes('gcash');
  if (hasGcash) score += 3;

  // ── Marker 1b: other GCash-specific UI wording ──────────────────────────
  // These strings are characteristic of the GCash "Send Money" receipt and
  // help identify the app even when the faint "GCash" word isn't read.
  const gcashUiHits = [
    /express\s*send/,                       // GCash "Express Send" flow
    /total\s*amount\s*sent/,                // GCash receipt line
    /sent\s*via\s*g\s?cash/,                // "Sent via GCash"
    /send\s*money/,
    /carbon\s*footprint/,                   // GCash green footer
    /gco2e|gco2|co2e/,                      // GCash carbon badge (e.g. "279g gCO2e")
    /by\s*going\s*digital/,                 // GCash green footer text
    /ref(?:erence)?\s*no/,                  // "Ref No."
  ].filter(re => re.test(text)).length;
  if (gcashUiHits >= 1) score += gcashUiHits;   // each distinct UI marker adds signal

  // A receipt is recognisably GCash if it has the brand word OR at least two
  // of the GCash-specific UI markers above.
  const looksLikeGcash = hasGcash || gcashUiHits >= 2;
  if (!looksLikeGcash) {
    reasons.push('The image does not appear to be a GCash receipt (no "GCash" text or GCash receipt layout found).');
  }

  // ── Marker 2: reference number ──────────────────────────────────────────
  // GCash ref numbers are 13 digits, often grouped like "4044 288 513679".
  const refMatch =
    rawText.match(/ref(?:erence)?\s*(?:no\.?|number)?[:\s]*([\d\s]{9,20}\d)/i) ||
    rawText.match(/\b(\d{4}\s?\d{3}\s?\d{6})\b/) ||
    rawText.match(/\b(\d{12,15})\b/);
  let refNo = null;
  if (refMatch) {
    refNo = refMatch[1].replace(/\s+/g, ' ').trim();
    score += 2;
  } else {
    reasons.push('No GCash reference number was detected.');
  }

  // ── Marker 3: amount ────────────────────────────────────────────────────
  // Look for a peso amount: "₱300.00", "P 300.00", "300.00", "Amount Sent"
  const amountMatch =
    rawText.match(/(?:₱|php|p)\s?([\d,]+\.\d{2})/i) ||
    rawText.match(/amount[^\d]{0,20}([\d,]+\.\d{2})/i) ||
    rawText.match(/\b([\d,]{1,9}\.\d{2})\b/);
  let amount = null;
  if (amountMatch) {
    amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    if (!isNaN(amount)) score += 1;
    else amount = null;
  }
  if (amount === null) {
    reasons.push('No payment amount was detected.');
  }

  // ── Marker 4: money keywords ────────────────────────────────────────────
  const hasSent   = /\bsent\b/.test(text) || text.includes('express send') || text.includes('send money');
  const hasAmount = text.includes('amount');
  if (hasSent)   score += 1;
  if (hasAmount) score += 1;
  if (!hasSent && !hasAmount) {
    reasons.push('The image is missing typical GCash receipt wording (e.g. "Amount", "Sent").');
  }

  // ── Decision ────────────────────────────────────────────────────────────
  // Accept the image when it BOTH looks like a GCash receipt (brand word or
  // ≥2 GCash UI markers) AND carries a strong transaction marker (reference
  // number or amount). The score threshold is a safety net against random
  // images that happen to trip one weak signal.
  const strongMarker = !!refMatch || amount !== null;
  const valid = looksLikeGcash && strongMarker && score >= 4;

  if (!valid && reasons.length === 0) {
    reasons.push('This does not look like a valid GCash payment receipt.');
  }

  return {
    valid,
    score,
    reasons,
    extracted: { refNo, amount },
    rawText,
  };
}

module.exports = { validateGcashScreenshot, ocrImage };
