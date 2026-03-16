// -------------------------------------------------------
// scheduler.js — Hourly Update Engine
// -------------------------------------------------------
// This file runs background tasks on a timer. Think of it
// like an alarm clock that triggers specific jobs at set
// intervals — in our case, every hour.
//
// Why do we need hourly updates?
// - News articles are published constantly — we want fresh results
// - Court records get updated when new filings happen
// - The Epstein archive adds new documents over time
//
// We use a library called "node-cron" which lets you schedule
// tasks using "cron syntax" — a compact way of expressing
// time patterns. "0 * * * *" means "at minute 0 of every hour".
// -------------------------------------------------------

const cron = require('node-cron');
const db = require('../db/database');
const { fetchNewsForPerson } = require('./newsService');
const { searchCasesForPerson } = require('./courtListener');

// -------------------------------------------------------
// refreshNewsCache()
// -------------------------------------------------------
// Goes through every person in our database and refreshes
// their cached news articles. Old articles are deleted and
// replaced with fresh ones.
// -------------------------------------------------------
async function refreshNewsCache() {
  console.log(`[scheduler] ${new Date().toISOString()} — Starting hourly news cache refresh...`);

  // Get all known person names from our JSON database
  const names = db.getAllPersonNames();

  let refreshed = 0;
  let failed = 0;

  for (const name of names) {
    try {
      const articles = await fetchNewsForPerson(name);
      db.replaceNewsForPerson(name, articles);
      refreshed++;
      await sleep(500); // 500ms pause between people — polite to news APIs
    } catch (error) {
      console.error(`[scheduler] Failed to refresh news for "${name}":`, error.message);
      failed++;
    }
  }

  console.log(`[scheduler] News cache refresh complete. Refreshed: ${refreshed}, Failed: ${failed}`);
}

// -------------------------------------------------------
// refreshCourtCache()
// -------------------------------------------------------
// Updates court record cache for all known persons.
// -------------------------------------------------------
async function refreshCourtCache() {
  console.log(`[scheduler] ${new Date().toISOString()} — Starting hourly court cache refresh...`);

  const names = db.getAllPersonNames();

  for (const name of names) {
    try {
      const { cases } = await searchCasesForPerson(name);
      db.replaceCourtForPerson(name, cases);
      await sleep(1000); // 1 second — CourtListener rate limit is stricter
    } catch (error) {
      console.error(`[scheduler] Failed to refresh court data for "${name}":`, error.message);
    }
  }

  console.log('[scheduler] Court cache refresh complete.');
}

// -------------------------------------------------------
// sleep(ms)
// -------------------------------------------------------
// Pauses execution for a given number of milliseconds.
// Used to add polite delays between API calls so we don't
// get rate-limited (blocked for making too many requests).
// -------------------------------------------------------
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// -------------------------------------------------------
// startScheduler()
// -------------------------------------------------------
// Registers all cron jobs and starts them running.
// Call this once when the server starts.
// -------------------------------------------------------
function startScheduler() {
  // Refresh news every hour (at minute 0 of every hour)
  cron.schedule('0 * * * *', () => {
    refreshNewsCache().catch(err =>
      console.error('[scheduler] Unhandled error in refreshNewsCache:', err)
    );
  });

  // Refresh court records every hour (at minute 5 — offset from news)
  cron.schedule('5 * * * *', () => {
    refreshCourtCache().catch(err =>
      console.error('[scheduler] Unhandled error in refreshCourtCache:', err)
    );
  });

  console.log('[scheduler] Hourly update jobs registered. News: :00, Court: :05');
}

module.exports = { startScheduler, refreshNewsCache, refreshCourtCache };
