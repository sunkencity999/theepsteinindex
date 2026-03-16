// -------------------------------------------------------
// routes/search.js — Search API Endpoint
// -------------------------------------------------------
// Handles GET /api/search?q=some+name
//
// Now queries TWO sources in parallel and merges results:
//   1. epsteininvestigation.org — 207k documents
//   2. epsteinexposed.com       — 2.1M documents
//
// Combined we cover significantly more of the 3.5M+ pages
// released by the DOJ.
// -------------------------------------------------------

const express = require('express');
const router  = express.Router();

const { searchEntities, fullTextSearch } = require('../services/epsteinApi');
const { searchPersons, searchDocuments } = require('../services/epsteinExposedApi');
const db = require('../db/database');

// -------------------------------------------------------
// GET /api/search?q=...&page=1&limit=20
// -------------------------------------------------------
router.get('/', async (req, res) => {

  const query = (req.query.q || '').trim();
  const page  = parseInt(req.query.page)  || 1;
  const limit = parseInt(req.query.limit) || 20;

  if (!query) {
    return res.status(400).json({
      error: 'Please provide a search term using the "q" parameter.',
      example: '/api/search?q=ghislaine+maxwell'
    });
  }

  // Log the search
  try { await db.logSearch(query); } catch (e) {}

  // ── QUERY ALL FOUR ENDPOINTS IN PARALLEL ──
  // We fire all four requests at the same time and wait for
  // all of them to finish. This is much faster than waiting
  // for each one sequentially.
  const [
    eiEntities,   // People from epsteininvestigation.org
    eiDocs,       // Documents from epsteininvestigation.org
    eePersons,    // People from epsteinexposed.com
    eeDocs        // Documents from epsteinexposed.com (2.1M pool)
  ] = await Promise.all([
    searchEntities(query, page, Math.ceil(limit / 2)),
    fullTextSearch(query, page, 5),
    searchPersons(query, page, Math.ceil(limit / 2)),
    searchDocuments(query, page, 5)
  ]);

  // ── MERGE & DEDUPLICATE PEOPLE ──
  // Both sources may return the same person. We deduplicate
  // by normalising the name to lowercase and keeping the
  // richest record (epsteinexposed has more detail).
  const seenNames = new Set();
  const mergedEntities = [];

  // Add epsteinexposed people first (richer data: status, aliases, bio)
  for (const p of (eePersons.results || [])) {
    const key = (p.name || '').toLowerCase().trim();
    if (!seenNames.has(key)) {
      seenNames.add(key);
      // Normalise to a consistent shape for the frontend
      mergedEntities.push({
        name:           p.name,
        slug:           p.slug,
        role_description: p.short_bio || '',
        document_count: p.stats?.documents  || 0,
        flight_count:   p.stats?.flights    || 0,
        email_count:    p.stats?.emails     || 0,
        legal_status:   p.status            || [],
        aliases:        p.aliases           || [],
        source:         'epsteinexposed'
      });
    }
  }

  // Then add epsteininvestigation people not already seen
  for (const p of (eiEntities.results || [])) {
    const key = (p.name || '').toLowerCase().trim();
    if (!seenNames.has(key)) {
      seenNames.add(key);
      mergedEntities.push({
        name:           p.name,
        slug:           p.slug,
        role_description: p.role_description || '',
        document_count: p.document_count || 0,
        flight_count:   p.flight_count   || 0,
        email_count:    p.email_count    || 0,
        legal_status:   [],
        aliases:        [],
        source:         'epsteininvestigation'
      });
    }
  }

  // ── MERGE & DEDUPLICATE DOCUMENTS ──
  // Same approach: deduplicate by title, prefer the record
  // that has a direct pdf_url (epsteinexposed usually does).
  const seenTitles = new Set();
  const mergedDocs = [];

  for (const doc of (eeDocs.results || [])) {
    const key = (doc.title || '').toLowerCase().trim();
    if (!seenTitles.has(key)) {
      seenTitles.add(key);
      mergedDocs.push({
        id:            doc.id,
        title:         doc.title,
        excerpt:       doc.summary || '',
        document_date: doc.date,
        document_type: doc.category,
        source:        doc.source,
        // pdf_url is a direct DOJ-hosted link — no middleman
        source_url:    doc.pdf_url || doc.source_url || null,
        file_url:      doc.pdf_url || null,
        page_count:    doc.page_count,
        _source:       'epsteinexposed'
      });
    }
  }

  for (const doc of (eiDocs.results || [])) {
    const key = (doc.title || '').toLowerCase().trim();
    if (!seenTitles.has(key)) {
      seenTitles.add(key);
      mergedDocs.push({
        id:            doc.id,
        title:         doc.title,
        excerpt:       doc.excerpt || '',
        document_date: doc.document_date,
        document_type: doc.document_type,
        source:        doc.source,
        source_url:    doc.source_url || null,
        file_url:      doc.file_url   || null,
        page_count:    null,
        _source:       'epsteininvestigation'
      });
    }
  }

  // Total document count is the SUM from both sources
  // (minus duplicates is hard to calculate exactly, so we
  // show a combined figure as a lower bound)
  const totalDocs     = (eiDocs.total || 0) + (eeDocs.total || 0);
  const totalEntities = Math.max(eiEntities.total || 0, eePersons.total || 0);

  res.json({
    query,
    entities:        mergedEntities,
    documents:       mergedDocs,
    total_entities:  totalEntities,
    total_documents: totalDocs,
    page,
    limit,
    // Tell the frontend which sources contributed results
    sources: {
      epsteininvestigation: { entities: eiEntities.total, documents: eiDocs.total },
      epsteinexposed:       { entities: eePersons.total,  documents: eeDocs.total  }
    }
  });
});

// -------------------------------------------------------
// GET /api/search/docs?q=...&page=2&limit=10
// -------------------------------------------------------
// Lightweight document-only endpoint used by the frontend's
// infinite scroll. Subsequent pages after the initial search
// call this instead of the full search endpoint, so we don't
// re-fetch entity results on every scroll event.
// -------------------------------------------------------
router.get('/docs', async (req, res) => {
  const query = (req.query.q || '').trim();
  const page  = parseInt(req.query.page)  || 1;
  const limit = parseInt(req.query.limit) || 10;

  if (!query) return res.status(400).json({ error: 'q param required' });

  const [eiDocs, eeDocs] = await Promise.all([
    fullTextSearch(query, page, Math.ceil(limit / 2)),
    searchDocuments(query, page, Math.ceil(limit / 2))
  ]);

  const seenTitles = new Set();
  const mergedDocs = [];

  for (const doc of (eeDocs.results || [])) {
    const key = (doc.title || '').toLowerCase().trim();
    if (!seenTitles.has(key)) {
      seenTitles.add(key);
      mergedDocs.push({
        id:            doc.id,
        title:         doc.title,
        excerpt:       doc.summary || '',
        document_date: doc.date,
        document_type: doc.category,
        source:        doc.source,
        source_url:    doc.pdf_url || doc.source_url || null,
        file_url:      doc.pdf_url || null,
        page_count:    doc.page_count
      });
    }
  }

  for (const doc of (eiDocs.results || [])) {
    const key = (doc.title || '').toLowerCase().trim();
    if (!seenTitles.has(key)) {
      seenTitles.add(key);
      mergedDocs.push({
        id:            doc.id,
        title:         doc.title,
        excerpt:       doc.excerpt || '',
        document_date: doc.document_date,
        document_type: doc.document_type,
        source:        doc.source,
        source_url:    doc.source_url || null,
        file_url:      doc.file_url   || null,
        page_count:    null
      });
    }
  }

  res.json({
    documents: mergedDocs,
    total: (eiDocs.total || 0) + (eeDocs.total || 0),
    page,
    limit
  });
});

module.exports = router;
