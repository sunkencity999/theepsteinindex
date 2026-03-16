// -------------------------------------------------------
// epsteinExposedApi.js — Epstein Exposed API (v2)
// -------------------------------------------------------
// This is our second data source: epsteinexposed.com
// It indexes 2.1 MILLION documents — roughly 10x more than
// our primary source (epsteininvestigation.org).
//
// Why two sources? Each has indexed different portions of
// the 3.5 million released pages. Using both gives us the
// broadest possible coverage of the public record.
//
// Key differences vs. epsteininvestigation.org:
//   - 10x more documents (2.1M vs 207k)
//   - Richer person profiles (legal status, aliases, bio)
//   - Direct pdf_url links straight to the DOJ source files
//   - Response wrapped in { data: ..., meta: { total, ... } }
// -------------------------------------------------------

const axios = require('axios');

const BASE_URL    = 'https://epsteinexposed.com/api/v2';
const TIMEOUT_MS  = 10000;

// -------------------------------------------------------
// searchPersons(query)
// -------------------------------------------------------
// Searches for people by name across the Epstein Exposed
// database. Returns rich profiles including legal status,
// aliases, and cross-reference stats.
// -------------------------------------------------------
async function searchPersons(query, page = 1, perPage = 20) {
  try {
    const response = await axios.get(`${BASE_URL}/persons`, {
      params: { q: query, page, per_page: perPage },
      timeout: TIMEOUT_MS
    });

    // Normalize to a consistent shape our routes expect:
    // { results: [...], total: N }
    const data = response.data;
    return {
      results: data.data || [],
      total:   data.meta?.total || 0
    };

  } catch (error) {
    console.error('[epsteinExposedApi] searchPersons error:', error.message);
    return { results: [], total: 0 };
  }
}

// -------------------------------------------------------
// searchDocuments(query)
// -------------------------------------------------------
// Full-text search across 2.1 million indexed documents.
// Each result includes a direct pdf_url pointing to the
// original DOJ-hosted file — no middleman.
// -------------------------------------------------------
async function searchDocuments(query, page = 1, perPage = 10) {
  try {
    const response = await axios.get(`${BASE_URL}/documents`, {
      params: { q: query, page, per_page: perPage },
      timeout: TIMEOUT_MS
    });

    const data = response.data;
    return {
      results: data.data || [],
      total:   data.meta?.total || 0
    };

  } catch (error) {
    console.error('[epsteinExposedApi] searchDocuments error:', error.message);
    return { results: [], total: 0 };
  }
}

// -------------------------------------------------------
// getPersonBySlug(slug)
// -------------------------------------------------------
// Fetches a full person profile including legal status,
// conviction details, aliases, and connection counts.
// -------------------------------------------------------
async function getPersonBySlug(slug) {
  try {
    const response = await axios.get(`${BASE_URL}/persons/${slug}`, {
      timeout: TIMEOUT_MS
    });
    return response.data.data || null;

  } catch (error) {
    // 404 is expected when a person isn't in this database — not a real error
    if (error.response?.status !== 404) {
      console.error(`[epsteinExposedApi] getPersonBySlug error for "${slug}":`, error.message);
    }
    return null;
  }
}

// -------------------------------------------------------
// getDocumentsForPerson(slug)
// -------------------------------------------------------
// Returns documents specifically linked to a person's
// profile page on epsteinexposed.com.
// -------------------------------------------------------
async function getDocumentsForPerson(slug, page = 1, perPage = 20) {
  try {
    const response = await axios.get(`${BASE_URL}/persons/${slug}/documents`, {
      params: { page, per_page: perPage },
      timeout: TIMEOUT_MS
    });

    const data = response.data;
    return {
      results: data.data || [],
      total:   data.meta?.total || 0
    };

  } catch (error) {
    if (error.response?.status !== 404) {
      console.error(`[epsteinExposedApi] getDocumentsForPerson error for "${slug}":`, error.message);
    }
    return { results: [], total: 0 };
  }
}

// -------------------------------------------------------
// getFlightsForPerson(slug)
// -------------------------------------------------------
// Returns flight records linked to a specific person's
// profile on epsteinexposed (often more complete than
// the other source due to larger dataset).
// -------------------------------------------------------
async function getFlightsForPerson(slug) {
  try {
    const response = await axios.get(`${BASE_URL}/persons/${slug}/flights`, {
      timeout: TIMEOUT_MS
    });
    return response.data.data || [];

  } catch (error) {
    if (error.response?.status !== 404) {
      console.error(`[epsteinExposedApi] getFlightsForPerson error for "${slug}":`, error.message);
    }
    return [];
  }
}

module.exports = {
  searchPersons,
  searchDocuments,
  getPersonBySlug,
  getDocumentsForPerson,
  getFlightsForPerson
};
