// -------------------------------------------------------
// routes/topic.js — Topic Browse API
// -------------------------------------------------------
// GET /api/topic           → list all topics (for homepage grid)
// GET /api/topic/:slug     → search documents/people for a topic
// GET /api/topic/:slug/docs?page=N → paginated docs for a topic
// -------------------------------------------------------

const express = require('express');
const router  = express.Router();

const { TOPICS, CATEGORIES }            = require('../data/topics');
const { fullTextSearch }                = require('../services/epsteinApi');
const { searchDocuments, searchPersons } = require('../services/epsteinExposedApi');

// -------------------------------------------------------
// GET /api/topic
// Returns all topic definitions so the frontend can render
// the topic grid on the home page without hard-coding HTML.
// -------------------------------------------------------
router.get('/', (req, res) => {
  res.json({ topics: TOPICS, categories: CATEGORIES });
});

// -------------------------------------------------------
// GET /api/topic/:slug
// Runs parallel searches for a topic's keywords and merges
// the results — people + documents, deduplicated.
// -------------------------------------------------------
router.get('/:slug', async (req, res) => {
  const topic = TOPICS.find(t => t.slug === req.params.slug);
  if (!topic) return res.status(404).json({ error: 'Topic not found' });

  const page  = parseInt(req.query.page)  || 1;
  const limit = parseInt(req.query.limit) || 20;

  // Fire searches for the first two keywords simultaneously.
  // More keywords = richer results without extra latency.
  const [kw1, kw2] = topic.keywords;

  const [persons, docs1, docs2] = await Promise.all([
    searchPersons(kw1, page, Math.ceil(limit / 2)),
    searchDocuments(kw1, page, 10),
    kw2 ? searchDocuments(kw2, page, 5) : Promise.resolve({ results: [], total: 0 })
  ]);

  // ── MERGE & DEDUPLICATE DOCUMENTS ──
  const seenTitles = new Set();
  const mergedDocs = [];

  for (const doc of [...(docs1.results || []), ...(docs2.results || [])]) {
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
        page_count:    doc.page_count || null
      });
    }
  }

  // ── MERGE & DEDUPLICATE PEOPLE ──
  const seenNames = new Set();
  const mergedPersons = [];

  for (const p of (persons.results || [])) {
    const key = (p.name || '').toLowerCase().trim();
    if (!seenNames.has(key)) {
      seenNames.add(key);
      mergedPersons.push({
        name:             p.name,
        slug:             p.slug,
        role_description: p.short_bio || '',
        document_count:   p.stats?.documents || 0,
        flight_count:     p.stats?.flights   || 0,
        email_count:      p.stats?.emails    || 0,
        legal_status:     p.status           || [],
        aliases:          p.aliases          || [],
        source:           'epsteinexposed'
      });
    }
  }

  res.json({
    topic,
    entities:        mergedPersons,
    documents:       mergedDocs,
    total_entities:  persons.total || 0,
    total_documents: docs1.total   || 0,
    page,
    limit
  });
});

// -------------------------------------------------------
// GET /api/topic/:slug/docs?page=N&limit=10
// Paginated document fetch for a topic — used by the
// frontend's infinite scroll to load more results.
// -------------------------------------------------------
router.get('/:slug/docs', async (req, res) => {
  const topic = TOPICS.find(t => t.slug === req.params.slug);
  if (!topic) return res.status(404).json({ error: 'Topic not found' });

  const page  = parseInt(req.query.page)  || 2;
  const limit = parseInt(req.query.limit) || 10;

  const [kw1, kw2] = topic.keywords;

  const [docs1, docs2] = await Promise.all([
    searchDocuments(kw1, page, Math.ceil(limit / 2)),
    kw2 ? searchDocuments(kw2, page, Math.ceil(limit / 2)) : Promise.resolve({ results: [], total: 0 })
  ]);

  const seenTitles = new Set();
  const mergedDocs = [];

  for (const doc of [...(docs1.results || []), ...(docs2.results || [])]) {
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
        page_count:    doc.page_count || null
      });
    }
  }

  res.json({
    documents: mergedDocs,
    total: docs1.total || 0,
    page,
    limit
  });
});

module.exports = router;
