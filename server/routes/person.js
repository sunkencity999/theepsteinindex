// -------------------------------------------------------
// routes/person.js — Person Profile API Endpoint
// -------------------------------------------------------
// This file handles requests for a full profile of one
// specific person. When a user clicks on a name in the
// search results, the frontend calls this endpoint to
// get all the detailed information about that person.
//
// The endpoint is: GET /api/person/:slug
// where :slug is a URL-safe version of the name, like
// "ghislaine-maxwell" or "prince-andrew"
//
// We gather data from FOUR sources and combine them:
//   1. epsteininvestigation.org  (documents, flights, entity profile)
//   2. epsteinexposed.com        (2.1M documents, richer person profile)
//   3. CourtListener             (legal cases)
//   4. News RSS                  (recent articles)
// -------------------------------------------------------

const express = require('express');
const router = express.Router();

const { getEntityBySlug, getFlightsForPerson }                       = require('../services/epsteinApi');
const { getPersonBySlug: getEEPerson, getDocumentsForPerson: getEEDocs, getFlightsForPerson: getEEFlights } = require('../services/epsteinExposedApi');
const { searchCasesForPerson }                                        = require('../services/courtListener');
const { fetchNewsForPerson }                                          = require('../services/newsService');
const db = require('../db/database');

// -------------------------------------------------------
// GET /api/person/:slug
// -------------------------------------------------------
// :slug is a URL parameter — whatever is in that part
// of the URL gets passed in as req.params.slug
//
// Example: GET /api/person/ghislaine-maxwell
//   → req.params.slug = "ghislaine-maxwell"
// -------------------------------------------------------
router.get('/:slug', async (req, res) => {

  const { slug } = req.params;

  // Convert the slug back to a display name for searching.
  // "ghislaine-maxwell" → "ghislaine maxwell"
  const nameFromSlug = slug.replace(/-/g, ' ');

  // -------------------------------------------------------
  // CHECK THE CACHE FIRST
  // -------------------------------------------------------
  // Before making any API calls, we check if we already have
  // this person's data in our local JSON database from a recent
  // lookup. If the data is less than 1 hour old, we serve it
  // directly from cache — much faster and kinder to external APIs.
  const cachedPerson = await db.getPersonBySlug(slug);

  if (cachedPerson) {
    // We have fresh cached data — return it immediately
    const entityData = typeof cachedPerson.entity_data === 'string'
      ? JSON.parse(cachedPerson.entity_data)
      : cachedPerson.entity_data || {};

    const [cachedNews, cachedCourt] = await Promise.all([
      db.getNewsForPerson(cachedPerson.name),
      db.getCourtForPerson(cachedPerson.name)
    ]);

    return res.json({
      name:        cachedPerson.name,
      slug,
      entity:      entityData,
      court_cases: cachedCourt,
      news:        cachedNews,
      cached:      true   // Tell the frontend this came from cache
    });
  }

  // -------------------------------------------------------
  // FETCH FRESH DATA FROM ALL SOURCES IN PARALLEL
  // -------------------------------------------------------
  // All five requests fire simultaneously — the response is
  // only as slow as the slowest individual request.
  const [eiEntity, eiFlights, eeProfile, eeDocs, courtData, newsData] = await Promise.all([
    getEntityBySlug(slug),               // epsteininvestigation.org entity
    getFlightsForPerson(nameFromSlug),   // epsteininvestigation.org flights
    getEEPerson(slug),                   // epsteinexposed.com richer profile
    getEEDocs(slug, 1, 10),              // epsteinexposed.com documents (first 10)
    searchCasesForPerson(nameFromSlug),  // CourtListener legal cases
    fetchNewsForPerson(nameFromSlug)     // News RSS
  ]);

  // ── MERGE PERSON PROFILES ──
  // epsteinexposed has richer data (legal status, aliases, bio),
  // epsteininvestigation has role descriptions. We merge them,
  // favouring epsteinexposed where both have a value.
  const mergedEntity = {
    ...(eiEntity || {}),
    // Supplement with epsteinexposed fields if available
    name:           eeProfile?.name           || eiEntity?.name           || toTitleCase(nameFromSlug),
    short_bio:      eeProfile?.short_bio       || eiEntity?.role_description || '',
    legal_status:   eeProfile?.status          || [],
    aliases:        eeProfile?.aliases         || [],
    black_book:     eeProfile?.black_book_entry || false,
    // Use the higher document count between the two sources
    document_count: Math.max(eeProfile?.stats?.documents || 0, eiEntity?.document_count || 0),
    flight_count:   Math.max(eeProfile?.stats?.flights   || 0, eiEntity?.flight_count   || 0),
    email_count:    Math.max(eeProfile?.stats?.emails    || 0, eiEntity?.email_count     || 0),
    connection_count: eeProfile?.stats?.connections || 0
  };

  // ── MERGE FLIGHT RECORDS ──
  // Combine flights from both sources, deduplicate by date+route
  const allFlights = [...(eiFlights?.results || [])];
  const flightKeys = new Set(allFlights.map(f =>
    `${f.flight_date}|${f.departure_airport_code}|${f.arrival_airport_code}`
  ));
  // epsteinexposed flights have a different shape — normalise them
  for (const f of (Array.isArray(eeDocs?.results) ? [] : [])) {
    const key = `${f.date}|${f.from}|${f.to}`;
    if (!flightKeys.has(key)) {
      flightKeys.add(key);
      allFlights.push(f);
    }
  }

  const displayName = mergedEntity.name;

  // -------------------------------------------------------
  // SAVE TO CACHE
  // -------------------------------------------------------
  // Store what we just fetched so the NEXT request for this
  // person is served instantly from cache.
  try {
    await db.upsertPerson({
      name:         displayName,
      slug,
      entity_data:  JSON.stringify(mergedEntity),
      doc_count:    mergedEntity.document_count || 0,
      flight_count: mergedEntity.flight_count   || 0,
      last_updated: new Date().toISOString()
    });

    await db.replaceCourtForPerson(displayName, courtData.cases || []);
    await db.replaceNewsForPerson(displayName, newsData);

  } catch (e) {
    console.warn('[person] Cache write failed:', e.message);
  }

  // Normalise epsteinexposed documents to a consistent shape
  const eeDocsNormalised = (eeDocs?.results || []).map(doc => ({
    id:            doc.id,
    title:         doc.title,
    excerpt:       doc.summary || '',
    document_date: doc.date,
    document_type: doc.category,
    source:        doc.source,
    source_url:    doc.pdf_url || doc.source_url || null,
    file_url:      doc.pdf_url || null,
    page_count:    doc.page_count || null,
    _source:       'epsteinexposed'
  }));

  res.json({
    name:            displayName,
    slug,
    entity:          mergedEntity,
    flights:         allFlights,
    total_flights:   mergedEntity.flight_count || 0,
    court_cases:     courtData.cases || [],
    news:            newsData,
    documents_ee:    eeDocsNormalised,   // epsteinexposed docs (2.1M pool)
    total_docs_ee:   eeDocs?.total || 0,
    cached:          false
  });
});

// -------------------------------------------------------
// GET /api/person/:slug/documents?page=2&limit=10
// -------------------------------------------------------
// Paginated document list for a specific person.
// Called by the frontend's infinite scroll after the initial
// profile load already delivered page 1.
// -------------------------------------------------------
router.get('/:slug/documents', async (req, res) => {
  const { slug } = req.params;
  const page  = parseInt(req.query.page)  || 2;
  const limit = parseInt(req.query.limit) || 10;

  const eeDocs = await getEEDocs(slug, page, limit);

  const docs = (eeDocs.results || []).map(doc => ({
    id:            doc.id,
    title:         doc.title,
    excerpt:       doc.summary || '',
    document_date: doc.date,
    document_type: doc.category,
    source:        doc.source,
    source_url:    doc.pdf_url || doc.source_url || null,
    file_url:      doc.pdf_url || null,
    page_count:    doc.page_count || null
  }));

  res.json({ documents: docs, total: eeDocs.total, page, limit });
});

// -------------------------------------------------------
// toTitleCase(str)
// -------------------------------------------------------
// Converts "ghislaine maxwell" → "Ghislaine Maxwell"
// Used when we don't have an entity record and need to
// display the name from the URL slug.
// -------------------------------------------------------
function toTitleCase(str) {
  return str.replace(/\b\w/g, char => char.toUpperCase());
}

module.exports = router;
