// -------------------------------------------------------
// database.js — PostgreSQL Database Layer
// -------------------------------------------------------
// This file handles all communication with our PostgreSQL
// database hosted on SiteGround.
//
// PostgreSQL is a powerful, open-source relational database.
// Think of it like a very organised filing cabinet where
// every drawer (table) has a strict structure, and you can
// query across drawers very quickly.
//
// We use the "pg" library (node-postgres) to talk to it.
// A "pool" is a set of reusable database connections —
// rather than opening a new connection for every query
// (slow), we keep a pool of connections ready to use.
// -------------------------------------------------------

const { Pool } = require('pg');

// -------------------------------------------------------
// CONNECTION POOL
// -------------------------------------------------------
// All connection details come from environment variables
// (the .env file). Never hardcode credentials in code.
//
// SiteGround PostgreSQL typically runs on localhost when
// accessed from the same server.
const pool = new Pool({
  host:     process.env.PG_HOST     || 'localhost',
  port:     parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE,
  user:     process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  // Max 10 simultaneous connections in the pool.
  // SiteGround shared hosting has connection limits.
  max: 5,
  // If a connection isn't used for 30 seconds, close it
  idleTimeoutMillis: 30000,
  // Give up trying to connect after 2 seconds
  connectionTimeoutMillis: 2000,
  // Use SSL if the environment says so (required on some hosts)
  ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false
});

// Log connection errors without crashing the app
pool.on('error', (err) => {
  console.error('[database] Unexpected pool error:', err.message);
});

// -------------------------------------------------------
// INITIALISE TABLES
// -------------------------------------------------------
// Creates all our tables if they don't already exist.
// This runs once on server startup. IF NOT EXISTS means
// it's safe to run every time — it won't wipe data.
async function initTables() {
  const client = await pool.connect();
  try {
    await client.query(`

      -- Stores person profiles we've looked up.
      -- We cache data here to avoid re-fetching from APIs.
      CREATE TABLE IF NOT EXISTS persons (
        id           SERIAL PRIMARY KEY,
        name         TEXT NOT NULL,
        slug         TEXT UNIQUE NOT NULL,
        entity_data  TEXT,           -- JSON blob of all fetched data
        doc_count    INTEGER DEFAULT 0,
        flight_count INTEGER DEFAULT 0,
        last_updated TIMESTAMPTZ DEFAULT NOW()
      );

      -- Logs every search made (for analytics / trending searches)
      CREATE TABLE IF NOT EXISTS searches (
        id           SERIAL PRIMARY KEY,
        query        TEXT NOT NULL,
        result_count INTEGER DEFAULT 0,
        searched_at  TIMESTAMPTZ DEFAULT NOW()
      );

      -- Cached news articles per person, refreshed hourly
      CREATE TABLE IF NOT EXISTS news_cache (
        id           SERIAL PRIMARY KEY,
        person_name  TEXT NOT NULL,
        title        TEXT,
        url          TEXT,
        source       TEXT,
        pub_date     TEXT,
        fetched_at   TIMESTAMPTZ DEFAULT NOW()
      );

      -- Cached court records per person, refreshed hourly
      CREATE TABLE IF NOT EXISTS court_cache (
        id             SERIAL PRIMARY KEY,
        person_name    TEXT NOT NULL,
        case_name      TEXT,
        docket_number  TEXT,
        court          TEXT,
        date_filed     TEXT,
        status         TEXT,
        url            TEXT,
        fetched_at     TIMESTAMPTZ DEFAULT NOW()
      );

      -- Indexes speed up lookups on frequently queried columns.
      -- Think of an index like a book's index — faster to find
      -- things without reading the whole book cover to cover.
      CREATE INDEX IF NOT EXISTS idx_persons_slug        ON persons(slug);
      CREATE INDEX IF NOT EXISTS idx_news_person_name    ON news_cache(person_name);
      CREATE INDEX IF NOT EXISTS idx_court_person_name   ON court_cache(person_name);
      CREATE INDEX IF NOT EXISTS idx_searches_query      ON searches(query);

    `);
    console.log('[database] Tables ready.');
  } finally {
    // Always release the client back to the pool when done
    client.release();
  }
}

// -------------------------------------------------------
// HELPER METHODS
// -------------------------------------------------------
// A clean API the rest of the app uses so route/service
// files don't need to write raw SQL themselves.

// ── PERSONS ──

// Find a cached person by slug, but only if fresher than 1 hour
async function getPersonBySlug(slug) {
  const result = await pool.query(
    `SELECT * FROM persons
     WHERE slug = $1
     AND last_updated > NOW() - INTERVAL '1 hour'`,
    [slug]
  );
  return result.rows[0] || null;
}

// Insert or update a person record
async function upsertPerson(data) {
  await pool.query(
    `INSERT INTO persons (name, slug, entity_data, doc_count, flight_count, last_updated)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (slug) DO UPDATE SET
       entity_data  = EXCLUDED.entity_data,
       doc_count    = EXCLUDED.doc_count,
       flight_count = EXCLUDED.flight_count,
       last_updated = NOW()`,
    [data.name, data.slug, data.entity_data, data.doc_count || 0, data.flight_count || 0]
  );
}

// Get all person names (used by the scheduler)
async function getAllPersonNames() {
  const result = await pool.query('SELECT name FROM persons');
  return result.rows.map(r => r.name);
}

// ── NEWS CACHE ──

async function getNewsForPerson(personName) {
  const result = await pool.query(
    `SELECT * FROM news_cache
     WHERE person_name = $1
     ORDER BY pub_date DESC NULLS LAST
     LIMIT 10`,
    [personName]
  );
  return result.rows;
}

async function replaceNewsForPerson(personName, articles) {
  const client = await pool.connect();
  try {
    // Use a transaction: either ALL changes succeed or NONE do.
    // This prevents partial updates leaving inconsistent data.
    await client.query('BEGIN');
    await client.query('DELETE FROM news_cache WHERE person_name = $1', [personName]);

    for (const a of articles) {
      await client.query(
        `INSERT INTO news_cache (person_name, title, url, source, pub_date)
         VALUES ($1, $2, $3, $4, $5)`,
        [personName, a.title, a.url, a.source, a.pubDate || a.pub_date || null]
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// ── COURT CACHE ──

async function getCourtForPerson(personName) {
  const result = await pool.query(
    'SELECT * FROM court_cache WHERE person_name = $1 ORDER BY date_filed DESC NULLS LAST',
    [personName]
  );
  return result.rows;
}

async function replaceCourtForPerson(personName, cases) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM court_cache WHERE person_name = $1', [personName]);

    for (const c of cases) {
      await client.query(
        `INSERT INTO court_cache (person_name, case_name, docket_number, court, date_filed, status, url)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          personName,
          c.case_name,
          c.docket_number,
          c.court,
          c.date_filed,
          c.date_terminated ? 'Closed' : (c.status || 'Open'),
          c.url
        ]
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// ── SEARCHES ──

async function logSearch(query) {
  await pool.query(
    'INSERT INTO searches (query) VALUES ($1)',
    [query]
  );
}

// Export everything the rest of the app needs
module.exports = {
  pool,
  initTables,
  getPersonBySlug,
  upsertPerson,
  getAllPersonNames,
  getNewsForPerson,
  replaceNewsForPerson,
  getCourtForPerson,
  replaceCourtForPerson,
  logSearch
};
