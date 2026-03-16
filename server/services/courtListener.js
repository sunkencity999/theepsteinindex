// -------------------------------------------------------
// courtListener.js — CourtListener Legal Records API
// -------------------------------------------------------
// CourtListener (courtlistener.com) is a free, non-profit
// legal database that indexes millions of federal court records.
// It's operated by the Free Law Project, a nonprofit organization.
//
// We use it to look up whether a person named in the Epstein
// files has any PUBLIC federal court cases — charges, lawsuits,
// civil suits, settlements, etc. This is entirely public information
// that anyone can look up at the federal courthouse.
//
// IMPORTANT: We only show things that are IN the official court
// record. This is not speculation — it's documented legal history.
// -------------------------------------------------------

const axios = require('axios');

// Base URL for CourtListener's REST API version 4
const BASE_URL = 'https://www.courtlistener.com/api/rest/v4';

// 10-second timeout
const TIMEOUT_MS = 10000;

// Read the API token from environment variables (.env file).
// A token gives us a higher rate limit (more searches per minute).
// The app works WITHOUT a token, just slightly slower.
const TOKEN = process.env.COURTLISTENER_TOKEN || '';

// Build the authorization header if we have a token.
// If no token, we send an empty headers object.
const AUTH_HEADERS = TOKEN
  ? { Authorization: `Token ${TOKEN}` }
  : {};

// -------------------------------------------------------
// searchCasesForPerson(name)
// -------------------------------------------------------
// Searches CourtListener for federal court cases involving
// a given person's name. Returns cases where they appear
// as a party (plaintiff, defendant, etc.).
//
// For example, searching "Ghislaine Maxwell" returns her
// criminal case (US v. Maxwell) and related civil suits.
// -------------------------------------------------------
async function searchCasesForPerson(name) {
  try {
    // The CourtListener "dockets" endpoint lets us search
    // for cases by party name. A "docket" is the official
    // log of everything that happens in a court case.
    const response = await axios.get(`${BASE_URL}/dockets/`, {
      headers: AUTH_HEADERS,
      params: {
        party_name: name,    // Search for cases where this person is a party
        order_by: '-date_filed',  // Newest cases first
        page_size: 10        // Return up to 10 cases
      },
      timeout: TIMEOUT_MS
    });

    // The results array contains docket objects.
    // We map (transform) them into a simpler, cleaner shape
    // that our frontend can easily display.
    const cases = (response.data.results || []).map(docket => ({
      case_name:     docket.case_name,          // e.g. "United States v. Maxwell"
      docket_number: docket.docket_number,      // e.g. "1:20-cr-00330"
      court:         docket.court_id,           // e.g. "nysd" (Southern District of NY)
      date_filed:    docket.date_filed,         // e.g. "2020-07-02"
      date_terminated: docket.date_terminated, // null if case is still open
      nature_of_suit: docket.nature_of_suit,   // Category of case (criminal, civil, etc.)
      url:           `https://www.courtlistener.com${docket.absolute_url}` // Link to full record
    }));

    return { cases, total: response.data.count || 0 };

  } catch (error) {
    console.error(`[courtListener] searchCasesForPerson error for "${name}":`, error.message);
    return { cases: [], total: 0 };
  }
}

// -------------------------------------------------------
// getEpsteinCoreCases()
// -------------------------------------------------------
// Returns the key Epstein-related cases we always want to
// display prominently — the criminal case, the Giuffre/Maxwell
// civil case where the documents were unsealed, etc.
//
// These are hardcoded because they're the foundation of
// everything in this database.
// -------------------------------------------------------
async function getEpsteinCoreCases() {
  // These docket IDs are CourtListener's internal IDs for
  // the most important Epstein-related cases.
  const CORE_CASE_IDS = [
    4355835,   // Giuffre v. Maxwell — the civil case that produced the 2024 document release
    15887848   // United States v. Epstein (SDNY 2019) — the federal criminal case
  ];

  const cases = [];

  for (const id of CORE_CASE_IDS) {
    try {
      const response = await axios.get(`${BASE_URL}/dockets/${id}/`, {
        headers: AUTH_HEADERS,
        timeout: TIMEOUT_MS
      });

      const d = response.data;
      cases.push({
        case_name:     d.case_name,
        docket_number: d.docket_number,
        court:         d.court_id,
        date_filed:    d.date_filed,
        date_terminated: d.date_terminated,
        url:           `https://www.courtlistener.com${d.absolute_url}`
      });

    } catch (error) {
      console.error(`[courtListener] Failed to fetch core case ID ${id}:`, error.message);
    }
  }

  return cases;
}

module.exports = {
  searchCasesForPerson,
  getEpsteinCoreCases
};
