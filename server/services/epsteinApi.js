// -------------------------------------------------------
// epsteinApi.js — Epstein Investigation Archive API
// -------------------------------------------------------
// This file handles all communication with the free public API
// at epsteininvestigation.org — a database of 207,000+ documents,
// 23,000+ named individuals, and 3,000+ flight records from the
// officially released Epstein government files.
//
// Think of this file as a "translator" between our app and their
// database — we ask questions in JavaScript, it sends those
// questions to their server, and brings back the answers.
// -------------------------------------------------------

const axios = require('axios');

// The base URL for the API. All endpoints are appended to this.
const BASE_URL = 'https://www.epsteininvestigation.org/api/v1';

// How long to wait for a response before giving up (10 seconds).
// Without a timeout, a slow server could hang our app forever.
const TIMEOUT_MS = 10000;

// -------------------------------------------------------
// searchEntities(query)
// -------------------------------------------------------
// Searches for PEOPLE by name in the Epstein archive.
// Returns a list of matching individuals with their
// document count, flight count, and role description.
//
// Example: searchEntities("Prince Andrew") returns all
// records matching that name.
// -------------------------------------------------------
async function searchEntities(query, page = 1, limit = 20) {
  try {
    const response = await axios.get(`${BASE_URL}/entities`, {
      params: {
        q: query,          // The name we're searching for
        type: 'person',    // We only want people, not organizations or locations
        page,              // Which page of results (for pagination)
        limit              // How many results per page
      },
      timeout: TIMEOUT_MS
    });

    // The API returns { data: [...], total, page, limit }
    // We normalize it to { results: [...], total, page, limit } for consistency
    return {
      results: response.data.data || [],
      total:   response.data.total || 0,
      page:    response.data.page  || 1,
      limit:   response.data.limit || limit
    };

  } catch (error) {
    // If something goes wrong (network error, API down, etc.)
    // we log the error and return an empty result set rather
    // than crashing the whole app.
    console.error('[epsteinApi] searchEntities error:', error.message);
    return { results: [], total: 0, page: 1, limit };
  }
}

// -------------------------------------------------------
// getEntityBySlug(slug)
// -------------------------------------------------------
// Fetches full details for a single person using their "slug"
// (a slug is a URL-friendly version of their name, like
// "jeffrey-epstein" or "ghislaine-maxwell").
//
// Returns everything the archive knows about that person:
// documents they appear in, flights they took, connections, etc.
// -------------------------------------------------------
async function getEntityBySlug(slug) {
  try {
    const response = await axios.get(`${BASE_URL}/entities/${slug}`, {
      timeout: TIMEOUT_MS
    });
    return response.data;

  } catch (error) {
    console.error(`[epsteinApi] getEntityBySlug error for "${slug}":`, error.message);
    return null;
  }
}

// -------------------------------------------------------
// getDocumentsForPerson(name)
// -------------------------------------------------------
// Fetches all documents that mention a specific person.
// Documents include court filings, FBI files, depositions,
// emails, and financial records.
//
// We search by name in the full-text search endpoint rather
// than the entity endpoint, to catch partial name matches.
// -------------------------------------------------------
async function getDocumentsForPerson(name, page = 1, limit = 10) {
  try {
    const response = await axios.get(`${BASE_URL}/search`, {
      params: {
        q: name,   // Search the full text of all documents for this name
        page,
        limit
      },
      timeout: TIMEOUT_MS
    });
    return {
      results: response.data.data || [],
      total:   response.data.total || 0
    };

  } catch (error) {
    console.error(`[epsteinApi] getDocumentsForPerson error for "${name}":`, error.message);
    return { results: [], total: 0 };
  }
}

// -------------------------------------------------------
// getFlightsForPerson(name)
// -------------------------------------------------------
// Looks up all recorded flights where this person appears
// on the passenger manifest (the list of people on the plane).
//
// Epstein's private jets flew to locations like his island
// and his homes. The passenger logs were subpoenaed and
// are part of the court record.
// -------------------------------------------------------
async function getFlightsForPerson(name, page = 1, limit = 20) {
  try {
    const response = await axios.get(`${BASE_URL}/flights`, {
      params: {
        passenger: name,   // Filter flights by passenger name
        page,
        limit
      },
      timeout: TIMEOUT_MS
    });
    return {
      results: response.data.data || [],
      total:   response.data.total || 0
    };

  } catch (error) {
    console.error(`[epsteinApi] getFlightsForPerson error for "${name}":`, error.message);
    return { results: [], total: 0 };
  }
}

// -------------------------------------------------------
// fullTextSearch(query)
// -------------------------------------------------------
// A general-purpose search across ALL document content.
// This is what powers the main search bar on the homepage.
// Unlike entity search, this looks inside the actual text
// of every document — useful for finding names that might
// not have their own entity profile yet.
// -------------------------------------------------------
async function fullTextSearch(query, page = 1, limit = 20) {
  try {
    const response = await axios.get(`${BASE_URL}/search`, {
      params: { q: query, page, limit },
      timeout: TIMEOUT_MS
    });
    return {
      results: response.data.data || [],
      total:   response.data.total || 0
    };

  } catch (error) {
    console.error(`[epsteinApi] fullTextSearch error for "${query}":`, error.message);
    return { results: [], total: 0 };
  }
}

// Export all functions so other files can use them.
module.exports = {
  searchEntities,
  getEntityBySlug,
  getDocumentsForPerson,
  getFlightsForPerson,
  fullTextSearch
};
