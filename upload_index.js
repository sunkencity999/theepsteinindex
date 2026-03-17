// ═══════════════════════════════════════════════════════════════
// upload_index.js — Push indexed_docs.ndjson to the DO server
// ═══════════════════════════════════════════════════════════════
//
// This script:
//   1. SSHes into 178.128.188.168
//   2. Creates the local_documents table + GIN full-text index
//   3. Uploads indexed_docs.ndjson via SFTP
//   4. Runs a server-side import script to bulk-load into PostgreSQL
//   5. Cleans up temp files
//
// USAGE:
//   DO_ROOT_PASSWORD=yourpassword node upload_index.js
//
// After this runs, the live site will search your local archive
// in addition to the external APIs.
// ═══════════════════════════════════════════════════════════════

'use strict';

const { NodeSSH } = require('node-ssh');
const path        = require('path');
const fs          = require('fs');

const LOCAL_NDJSON  = path.join(__dirname, 'indexed_docs.ndjson');
const REMOTE_DIR    = '/var/www/theepsteinindex';
const REMOTE_NDJSON = `${REMOTE_DIR}/indexed_docs.ndjson`;
const REMOTE_IMPORT = `${REMOTE_DIR}/run_import.js`;

// ── CHECK ─────────────────────────────────────────────────────────────────────

if (!fs.existsSync(LOCAL_NDJSON)) {
  console.error('\n  indexed_docs.ndjson not found.');
  console.error('  Run  node index_pdfs.js  first.\n');
  process.exit(1);
}

const password = process.env.DO_ROOT_PASSWORD;
if (!password) {
  console.error('\n  Set DO_ROOT_PASSWORD before running:');
  console.error('  DO_ROOT_PASSWORD=yourpassword node upload_index.js\n');
  process.exit(1);
}

const fileSizeMB = (fs.statSync(LOCAL_NDJSON).size / 1e6).toFixed(1);

// ── SERVER-SIDE IMPORT SCRIPT ─────────────────────────────────────────────────
// This runs ON the DO server after NDJSON is uploaded.
// It reads line-by-line and bulk-inserts into PostgreSQL in batches of 200.

const IMPORT_SCRIPT = `
'use strict';
require('dotenv').config({ path: '/var/www/theepsteinindex/.env' });
const fs = require('fs');
const readline = require('readline');
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.PG_HOST     || 'localhost',
  port:     parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE,
  user:     process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  ssl:      process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max:      5
});

async function run() {
  const client = await pool.connect();

  // Create table + GIN full-text index (safe to run multiple times)
  await client.query(\`
    CREATE TABLE IF NOT EXISTS local_documents (
      id          SERIAL PRIMARY KEY,
      filename    TEXT NOT NULL,
      filepath    TEXT UNIQUE NOT NULL,
      title       TEXT,
      file_size   BIGINT,
      page_count  INT,
      full_text   TEXT,
      has_text    BOOLEAN GENERATED ALWAYS AS (full_text IS NOT NULL AND full_text != '') STORED,
      indexed_at  TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_local_docs_filepath ON local_documents(filepath);
  \`);

  // GIN index must be created separately (can't be in CREATE TABLE)
  await client.query(\`
    CREATE INDEX IF NOT EXISTS idx_local_docs_fts
    ON local_documents
    USING GIN (to_tsvector('english', coalesce(full_text, '') || ' ' || coalesce(title, '')));
  \`);

  console.log('[import] Table and indexes ready.');
  client.release();

  // Stream the NDJSON file line by line
  const rl = readline.createInterface({
    input: fs.createReadStream('/var/www/theepsteinindex/indexed_docs.ndjson'),
    crlfDelay: Infinity
  });

  let batch   = [];
  let total   = 0;
  let skipped = 0;

  async function flushBatch() {
    if (batch.length === 0) return;
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      for (const rec of batch) {
        await c.query(
          \`INSERT INTO local_documents (filename, filepath, title, file_size, page_count, full_text)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (filepath) DO UPDATE SET
             title      = EXCLUDED.title,
             full_text  = EXCLUDED.full_text,
             page_count = EXCLUDED.page_count,
             indexed_at = NOW()\`,
          [rec.filename, rec.filepath, rec.title, rec.fileSize, rec.pageCount, rec.text || null]
        );
      }
      await c.query('COMMIT');
    } catch (err) {
      await c.query('ROLLBACK');
      console.error('[import] Batch error:', err.message);
      skipped += batch.length;
    } finally {
      c.release();
    }
    total += batch.length;
    batch = [];
    process.stdout.write(\`\\r  Imported: \${total} | Skipped: \${skipped}   \`);
  }

  for await (const line of rl) {
    if (!line.trim()) continue;
    let rec;
    try { rec = JSON.parse(line); } catch { continue; }
    batch.push({
      filename:  require('path').basename(rec.filePath || ''),
      filepath:  rec.filePath || '',
      title:     rec.title || require('path').basename(rec.filePath || '', '.pdf'),
      fileSize:  rec.fileSize || null,
      pageCount: rec.pageCount || null,
      text:      rec.text || ''
    });
    if (batch.length >= 200) await flushBatch();
  }

  await flushBatch(); // remainder

  console.log('\\n[import] Done! ' + total + ' documents in database.');
  await pool.end();
}

run().catch(err => { console.error('[import] Fatal:', err.message); process.exit(1); });
`;

// ── MAIN ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║  THE EPSTEIN INDEX — Upload & Import      ║');
  console.log('╠═══════════════════════════════════════════╣');
  console.log(`║  File: indexed_docs.ndjson (${fileSizeMB} MB)`.padEnd(44) + '║');
  console.log('║  Target: 178.128.188.168                  ║');
  console.log('╚═══════════════════════════════════════════╝\n');

  const ssh = new NodeSSH();

  // ── CONNECT ──
  console.log('[1/5] Connecting…');
  await ssh.connect({ host: '178.128.188.168', username: 'root', password });
  console.log('      Connected.\n');

  // ── WRITE IMPORT SCRIPT TO SERVER ──
  console.log('[2/5] Writing import script to server…');
  await ssh.execCommand(`cat > ${REMOTE_IMPORT} << 'SCRIPTEOF'\n${IMPORT_SCRIPT}\nSCRIPTEOF`);

  // ── UPLOAD NDJSON ──
  console.log(`[3/5] Uploading indexed_docs.ndjson (${fileSizeMB} MB)…`);
  console.log('      This may take a few minutes depending on your connection.');
  const uploadStart = Date.now();
  await ssh.putFile(LOCAL_NDJSON, REMOTE_NDJSON);
  const uploadSec = ((Date.now() - uploadStart) / 1000).toFixed(0);
  console.log(`      Done in ${uploadSec}s.\n`);

  // ── RUN IMPORT ──
  console.log('[4/5] Running server-side import into PostgreSQL…');
  console.log('      (Streaming output — this will take a while for large archives)\n');
  const importResult = await ssh.execCommand(
    `cd ${REMOTE_DIR} && node run_import.js`,
    {
      onStdout: (chunk) => process.stdout.write(chunk.toString()),
      onStderr: (chunk) => process.stderr.write(chunk.toString())
    }
  );
  if (importResult.code !== 0) {
    console.error('\n[error] Import failed. Check output above.');
  } else {
    console.log('\n');
  }

  // ── CLEANUP ──
  console.log('[5/5] Cleaning up temp files…');
  await ssh.execCommand(`rm -f ${REMOTE_IMPORT}`);
  // Leave indexed_docs.ndjson on server in case re-import is needed
  console.log('      Done.\n');

  ssh.dispose();

  console.log('╔═══════════════════════════════════════════╗');
  console.log('║  Upload complete!                         ║');
  console.log('║                                           ║');
  console.log('║  The live site now searches your local    ║');
  console.log('║  archive alongside the external APIs.     ║');
  console.log('╚═══════════════════════════════════════════╝\n');
}

main().catch(err => {
  console.error('\n[fatal]', err.message);
  process.exit(1);
});
