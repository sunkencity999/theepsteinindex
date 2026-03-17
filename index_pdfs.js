// ═══════════════════════════════════════════════════════════════
// index_pdfs.js — Local PDF Indexer
// ═══════════════════════════════════════════════════════════════
//
// Walks E:\EpsteinFiles, extracts the text layer from every PDF,
// and writes one JSON record per document to indexed_docs.ndjson.
//
// The process is FULLY RESUMABLE — progress is saved to
// index_progress.json every 50 files. If the script is stopped,
// just run it again and it picks up where it left off.
//
// SETUP (run once):
//   npm install pdf-parse
//
// USAGE:
//   node index_pdfs.js
//
// THEN:
//   node upload_index.js   ← pushes indexed_docs.ndjson to the server
// ═══════════════════════════════════════════════════════════════

'use strict';

const fs   = require('fs');
const path = require('path');

// ── CONFIG ────────────────────────────────────────────────────────────────────

const SOURCE_DIR    = 'E:\\EpsteinFiles';
const OUTPUT_FILE   = path.join(__dirname, 'indexed_docs.ndjson');
const PROGRESS_FILE = path.join(__dirname, 'index_progress.json');

// How many PDFs to parse at the same time.
// Higher = faster, but more RAM usage.
// 4 is a safe default for most machines.
const CONCURRENCY   = 4;

// Skip any single file larger than this (150 MB).
// Giant PDFs are almost always image-heavy scans that take
// forever to parse and yield little searchable text.
const MAX_FILE_BYTES = 150 * 1024 * 1024;

// Abort parsing a single PDF after this long.
const PARSE_TIMEOUT_MS = 30_000;

// ── DEPENDENCY CHECK ──────────────────────────────────────────────────────────

let pdfParse;
try {
  pdfParse = require('pdf-parse');
} catch {
  console.error('\n  Missing dependency. Please run:\n');
  console.error('    npm install pdf-parse\n');
  process.exit(1);
}

// ── PROGRESS HELPERS ──────────────────────────────────────────────────────────

function loadProgress() {
  try {
    const raw = fs.readFileSync(PROGRESS_FILE, 'utf8');
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

function saveProgress(doneSet) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify([...doneSet]));
}

// ── DIRECTORY WALKER ──────────────────────────────────────────────────────────
// Generator that recursively yields every .pdf path under a directory.

function* walkDir(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    console.warn(`\n  [warn] Cannot read directory: ${dir} — ${err.message}`);
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkDir(full);
    } else if (entry.name.toLowerCase().endsWith('.pdf')) {
      yield full;
    }
  }
}

// ── PDF PARSER ────────────────────────────────────────────────────────────────

async function parsePDF(filePath) {
  const buf = fs.readFileSync(filePath);
  const data = await Promise.race([
    pdfParse(buf, { max: 0 }),   // max: 0 = all pages
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), PARSE_TIMEOUT_MS)
    )
  ]);
  return {
    pageCount: data.numpages || null,
    text:      data.text ? data.text.trim() : ''
  };
}

// ── CONCURRENCY POOL ──────────────────────────────────────────────────────────
// Processes a shared queue with N concurrent workers.

async function runPool(queue, workerFn, concurrency) {
  async function worker() {
    while (queue.length > 0) {
      const item = queue.shift();
      await workerFn(item);
    }
  }
  await Promise.all(
    Array.from({ length: concurrency }, worker)
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║       THE EPSTEIN INDEX — PDF Indexer     ║');
  console.log('╚═══════════════════════════════════════════╝\n');

  // Load previous progress
  const done = loadProgress();
  console.log(`  Previous progress: ${done.size} files already indexed.`);

  // Scan for all PDFs not yet processed
  console.log(`  Scanning ${SOURCE_DIR}…`);
  const pending = [];
  for (const fp of walkDir(SOURCE_DIR)) {
    if (!done.has(fp)) pending.push(fp);
  }

  if (pending.length === 0) {
    console.log('\n  All files already indexed!');
    console.log('  Run  node upload_index.js  to push to the server.\n');
    return;
  }

  console.log(`  Files to index: ${pending.length}`);
  console.log(`  Output: ${OUTPUT_FILE}\n`);

  // Open the output file in append mode (safe for resuming)
  const out = fs.createWriteStream(OUTPUT_FILE, { flags: 'a' });

  let processed  = 0;
  let skipped    = 0;
  let errors     = 0;
  const startMs  = Date.now();

  async function processFile(filePath) {
    let record;
    let stat;

    try {
      stat = fs.statSync(filePath);
    } catch {
      // File disappeared after scan — skip silently
      done.add(filePath);
      return;
    }

    if (stat.size > MAX_FILE_BYTES) {
      // Too large — record stub so it shows in the index
      record = {
        filePath,
        title:     path.basename(filePath, '.pdf'),
        fileSize:  stat.size,
        pageCount: null,
        text:      '',
        skipped:   true,
        reason:    `file too large (${(stat.size / 1e6).toFixed(0)} MB)`
      };
      skipped++;
    } else {
      try {
        const { pageCount, text } = await parsePDF(filePath);
        record = {
          filePath,
          title:     path.basename(filePath, '.pdf'),
          fileSize:  stat.size,
          pageCount,
          text
        };
      } catch (err) {
        record = {
          filePath,
          title:     path.basename(filePath, '.pdf'),
          fileSize:  stat.size,
          pageCount: null,
          text:      '',
          error:     err.message
        };
        errors++;
      }
    }

    out.write(JSON.stringify(record) + '\n');
    done.add(filePath);
    processed++;

    // Save progress checkpoint every 50 files
    if (processed % 50 === 0) saveProgress(done);

    // Live progress display
    const elapsedS = (Date.now() - startMs) / 1000;
    const rate     = processed / elapsedS;
    const remaining = pending.length - processed;
    const etaMin   = rate > 0 ? (remaining / rate / 60).toFixed(0) : '?';

    process.stdout.write(
      `\r  ${processed}/${pending.length} | ` +
      `${rate.toFixed(1)}/s | ` +
      `~${etaMin}m left | ` +
      `${errors} errors | ` +
      `${skipped} skipped   `
    );
  }

  // Run all files through the pool
  await runPool([...pending], processFile, CONCURRENCY);

  // Final save + close
  saveProgress(done);
  out.end();

  const totalMin = ((Date.now() - startMs) / 1000 / 60).toFixed(1);

  console.log('\n\n╔═══════════════════════════════════════════╗');
  console.log('║  Indexing complete!                       ║');
  console.log('╚═══════════════════════════════════════════╝');
  console.log(`  Processed : ${processed}`);
  console.log(`  Skipped   : ${skipped}  (files > 150 MB)`);
  console.log(`  Errors    : ${errors}   (corrupt / password-protected)`);
  console.log(`  Time      : ${totalMin} minutes`);
  console.log(`\n  Output    : ${OUTPUT_FILE}`);
  console.log('\n  Next step:\n    node upload_index.js\n');
}

main().catch(err => {
  console.error('\n[fatal]', err.message);
  process.exit(1);
});
