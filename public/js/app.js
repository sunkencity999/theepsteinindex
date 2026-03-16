// ═══════════════════════════════════════════════════════════
// app.js — The Epstein Index Frontend Application
// ═══════════════════════════════════════════════════════════
// This is the JavaScript that runs in the user's browser.
// It handles:
//   - Capturing search input and sending requests to our API
//   - Rendering search results as HTML cards
//   - Navigating between views (home → results → person profile)
//   - Displaying person profiles with all their data sections
//
// This is a "vanilla" JavaScript app — no frameworks like React
// or Vue. Just pure JavaScript, which keeps things simple and
// fast to load.
// ═══════════════════════════════════════════════════════════


// ─────────────────────────────────────────────────────────
// WAIT FOR THE PAGE TO FULLY LOAD
// ─────────────────────────────────────────────────────────
// We wrap everything in DOMContentLoaded so our code only
// runs after the HTML has been fully parsed. Without this,
// we might try to find elements that don't exist yet.
document.addEventListener('DOMContentLoaded', () => {


  // ─────────────────────────────────────────────────────
  // GRAB REFERENCES TO DOM ELEMENTS
  // ─────────────────────────────────────────────────────
  // getElementById gets a reference to an HTML element
  // by its "id" attribute. We store these in variables so
  // we don't have to search for them every time.

  // Views (the three main screens)
  const viewHome    = document.getElementById('view-home');
  const viewResults = document.getElementById('view-results');
  const viewPerson  = document.getElementById('view-person');

  // Home view elements
  const homeSearchInput = document.getElementById('home-search-input');
  const homeSearchBtn   = document.getElementById('home-search-btn');

  // Header persistent search
  const headerSearch      = document.getElementById('header-search');
  const headerSearchInput = document.getElementById('header-search-input');
  const headerSearchBtn   = document.getElementById('header-search-btn');

  // Results view elements
  const resultsTitle   = document.getElementById('results-title');
  const resultsMeta    = document.getElementById('results-meta');
  const resultsLoading = document.getElementById('results-loading');
  const resultsError   = document.getElementById('results-error');
  const entityResults  = document.getElementById('entity-results');
  const documentResults = document.getElementById('document-results');

  // Person profile elements
  const personLoading = document.getElementById('person-loading');
  const personError   = document.getElementById('person-error');
  const personProfile = document.getElementById('person-profile');
  const personName    = document.getElementById('person-name');
  const personRole    = document.getElementById('person-role');
  const personStats   = document.getElementById('person-stats');
  const panelArchive  = document.getElementById('panel-archive');
  const panelFlights  = document.getElementById('panel-flights');
  const panelCourt    = document.getElementById('panel-court');
  const panelNews     = document.getElementById('panel-news');
  const panelDocuments = document.getElementById('panel-documents');

  const backBtn        = document.getElementById('back-btn');
  const resultsBackBtn = document.getElementById('results-back-btn');
  const logoLink       = document.getElementById('logo-link');

  // Topic browsing elements
  const topicContext     = document.getElementById('topic-context');
  const topicContextDesc = document.getElementById('topic-context-desc');
  const topicContextTags = document.getElementById('topic-context-tags');


  // ─────────────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────────────
  // "State" is the app's memory — what's currently happening.
  // We track the last search query so the back button can
  // return to the right results.
  let lastQuery = '';

  // ── Infinite scroll — person profile documents ──
  // Tracks which page of docs we've loaded for the current
  // person, so each scroll event fetches the next batch.
  let personDocsSlug    = '';
  let personDocsPage    = 1;
  let personDocsTotal   = 0;
  let personDocsActive  = false;   // true while a fetch is in flight
  let personDocsObserver = null;   // IntersectionObserver instance

  // ── Infinite scroll — search result documents ──
  let searchDocsQuery   = '';
  let searchDocsPage    = 1;
  let searchDocsTotal   = 0;
  let searchDocsActive  = false;
  let searchDocsObserver = null;

  // ── Topic browse state ──
  let currentTopicSlug  = '';   // slug of the topic currently being browsed
  let topicDocsPage     = 1;
  let topicDocsTotal    = 0;
  let topicDocsActive   = false;
  let topicDocsObserver = null;


  // ─────────────────────────────────────────────────────
  // VIEW SWITCHING
  // ─────────────────────────────────────────────────────
  // These helper functions show one view and hide the others.
  // CSS display:none hides an element; removing it shows it.

  function showView(viewName) {
    viewHome.style.display    = 'none';
    viewResults.style.display = 'none';
    viewPerson.style.display  = 'none';

    if (viewName === 'home') {
      viewHome.style.display = 'flex';
      headerSearch.style.display = 'none';  // Hide the compact header search on homepage
      document.title = 'The Epstein Index — Public Accountability Archive';
    } else if (viewName === 'results') {
      viewResults.style.display = 'block';
      headerSearch.style.display = 'flex';  // Show compact search in header
    } else if (viewName === 'person') {
      viewPerson.style.display = 'block';
      headerSearch.style.display = 'flex';
    }

    // Scroll back to the top of the page whenever we switch views
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }


  // ─────────────────────────────────────────────────────
  // SEARCH FUNCTION
  // ─────────────────────────────────────────────────────
  // This is the main function that fires when a user searches.
  // It:
  //   1. Validates the input (makes sure something was typed)
  //   2. Shows the results view with a loading spinner
  //   3. Calls our backend API
  //   4. Renders the results as HTML cards
  //
  async function performSearch(query) {

    // Trim removes leading/trailing whitespace
    query = query.trim();

    // Don't search if the box is empty
    if (!query) return;

    // Disconnect any previous search-docs observer before starting fresh
    if (searchDocsObserver) { searchDocsObserver.disconnect(); searchDocsObserver = null; }
    if (topicDocsObserver)  { topicDocsObserver.disconnect();  topicDocsObserver  = null; }

    // Remember the query for the back button
    lastQuery = query;

    // Clear any topic context banner when doing a keyword search
    topicContext.style.display = 'none';
    currentTopicSlug = '';

    // Keep the header search bar in sync
    headerSearchInput.value = query;

    // Switch to the results view
    showView('results');

    // Update the results heading
    resultsTitle.textContent = `Results for "${query}"`;
    resultsMeta.textContent  = 'Searching…';

    // Show loading spinner, hide previous results and errors
    resultsLoading.style.display  = 'flex';
    resultsError.style.display    = 'none';
    entityResults.innerHTML       = '';
    documentResults.innerHTML     = '';

    try {
      // ── CALL THE API ──
      // fetch() is the browser's built-in function for making
      // HTTP requests. We call our own backend at /api/search.
      // encodeURIComponent makes the query URL-safe (handles
      // spaces, special characters, etc.)
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);

      // If the server returned an error status (400, 500, etc.)
      // throw an error so we land in the catch block below
      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      // Parse the JSON response into a JavaScript object
      const data = await response.json();

      // Update the page title to reflect the search
      document.title = `"${query}" — The Epstein Index`;

      // Hide the loading spinner
      resultsLoading.style.display = 'none';

      // Show result counts in the subtitle
      resultsMeta.textContent =
        `${data.total_entities} people · ${data.total_documents} documents`;

      // ── RENDER ENTITY (PEOPLE) RESULTS ──
      if (data.entities && data.entities.length > 0) {
        entityResults.innerHTML = data.entities
          .map(entity => renderEntityCard(entity))
          .join('');

        // Add click handlers to each card
        // When clicked, load that person's full profile
        document.querySelectorAll('.entity-card').forEach(card => {
          card.addEventListener('click', () => {
            loadPersonProfile(card.dataset.slug, card.dataset.name);
          });
        });

      } else {
        entityResults.innerHTML = '<p class="no-results">No named individuals found matching this search.</p>';
      }

      // ── RENDER DOCUMENT RESULTS ──
      if (data.documents && data.documents.length > 0) {
        documentResults.innerHTML = data.documents
          .map(doc => renderDocCard(doc))
          .join('');

        // Set up infinite scroll for search documents if there are more pages
        searchDocsQuery = query;
        searchDocsPage  = 1;
        searchDocsTotal = data.total_documents;

        if (data.total_documents > data.documents.length) {
          // Add a sentinel element that the IntersectionObserver watches
          const sentinel = document.createElement('div');
          sentinel.id = 'search-docs-sentinel';
          documentResults.appendChild(sentinel);
          setupSearchDocsObserver();
        }
      } else {
        documentResults.innerHTML = '<p class="no-results">No documents found matching this search.</p>';
      }

    } catch (error) {
      // Something went wrong — show the error message
      resultsLoading.style.display = 'none';
      resultsError.style.display   = 'block';
      resultsError.textContent     = `Search failed: ${error.message}. Please try again.`;
      console.error('[app] Search error:', error);
    }
  }


  // ─────────────────────────────────────────────────────
  // RENDER HELPERS — Entity Card
  // ─────────────────────────────────────────────────────
  // These functions take a data object and return an HTML
  // string. The browser then parses and displays that HTML.
  //
  // We use template literals (backtick strings) which let us
  // embed variables inside HTML using ${variable} syntax.

  function renderEntityCard(entity) {
    // Build the "slug" — a URL-safe version of the name
    // "Ghislaine Maxwell" → "ghislaine-maxwell"
    const slug = entity.slug || nameToSlug(entity.name);

    // Build badge HTML for document count, flight count, legal status, etc.
    const badges = [];

    // Legal status badges — e.g. "convicted", "charged", "deceased"
    // These come from epsteinexposed.com's richer person profiles.
    for (const status of (entity.legal_status || [])) {
      const label = status.replace(/-/g, ' ');
      // Convicted gets a stronger red highlight; others get a neutral style
      const cls = status === 'convicted' ? 'badge badge-convicted' : 'badge badge-status';
      badges.push(`<span class="${cls}">${escapeHtml(label)}</span>`);
    }

    if (entity.document_count > 0) {
      badges.push(`<span class="badge badge-accent">${entity.document_count.toLocaleString()} documents</span>`);
    }
    if (entity.flight_count > 0) {
      badges.push(`<span class="badge">${entity.flight_count} flights</span>`);
    }
    if (entity.email_count > 0) {
      badges.push(`<span class="badge">${entity.email_count} emails</span>`);
    }
    if (entity.black_book) {
      badges.push(`<span class="badge badge-blackbook">Black Book</span>`);
    }

    const badgesHtml = badges.length
      ? `<div class="entity-badges">${badges.join('')}</div>`
      : '';

    // Show short_bio (from epsteinexposed) or role_description (from epsteininvestigation)
    const roleText = entity.role_description || entity.short_bio || '';
    const roleHtml = roleText
      ? `<p class="entity-role">${escapeHtml(roleText)}</p>`
      : '';

    // data-slug and data-name are "data attributes" — custom HTML
    // attributes we use to pass data to our click handler above
    return `
      <div class="entity-card" data-slug="${escapeHtml(slug)}" data-name="${escapeHtml(entity.name)}">
        <div class="entity-name">${escapeHtml(entity.name)}</div>
        ${roleHtml}
        ${badgesHtml}
      </div>
    `;
  }


  // ─────────────────────────────────────────────────────
  // RENDER HELPERS — Document Card
  // ─────────────────────────────────────────────────────
  function renderDocCard(doc) {
    const date   = doc.document_date ? formatDate(doc.document_date)   : '';
    const type   = doc.document_type ? formatDocType(doc.document_type) : '';
    const source = doc.source        ? formatSource(doc.source)         : '';

    // Use source_url if available, fall back to file_url (direct PDF link).
    const docUrl = doc.source_url || doc.file_url || '';

    // Make the title itself the link — far more visible than a small "View" link
    const titleHtml = docUrl
      ? `<a class="doc-title-link" href="${escapeHtml(docUrl)}" target="_blank" rel="noopener">${escapeHtml(doc.title || 'Untitled Document')} ↗</a>`
      : `<span>${escapeHtml(doc.title || 'Untitled Document')}</span>`;

    return `
      <div class="doc-card">
        <div class="doc-title">${titleHtml}</div>
        <div class="doc-excerpt">${escapeHtml(doc.excerpt || '')}</div>
        <div class="doc-meta">
          ${date   ? `<span>${date}</span>`   : ''}
          ${type   ? `<span>${type}</span>`   : ''}
          ${source ? `<span>${source}</span>` : ''}
        </div>
      </div>
    `;
  }


  // ─────────────────────────────────────────────────────
  // LOAD PERSON PROFILE
  // ─────────────────────────────────────────────────────
  // Fetches full profile data for one person and renders
  // the person profile view.

  async function loadPersonProfile(slug, name) {

    // Disconnect any previous infinite scroll observer so we don't
    // fire requests for the old person while loading the new one.
    if (personDocsObserver) { personDocsObserver.disconnect(); personDocsObserver = null; }
    if (searchDocsObserver) { searchDocsObserver.disconnect(); searchDocsObserver = null; }
    if (topicDocsObserver)  { topicDocsObserver.disconnect();  topicDocsObserver  = null; }

    // Switch to the person view and show the loading state
    showView('person');
    personLoading.style.display = 'flex';
    personError.style.display   = 'none';
    personProfile.style.display = 'none';

    // Update the browser tab title
    document.title = `${name} — The Epstein Index`;

    try {
      const response = await fetch(`/api/person/${encodeURIComponent(slug)}`);

      if (!response.ok) throw new Error(`Server returned status ${response.status}`);

      const data = await response.json();

      // Hide the spinner, show the profile container
      personLoading.style.display  = 'none';
      personProfile.style.display  = 'block';

      // ── POPULATE THE PROFILE ──

      // Name and role
      personName.textContent = data.name;
      personRole.textContent = data.entity?.role_description || '';

      // Summary stats row
      personStats.innerHTML = `
        <div class="person-stat">
          <span class="person-stat-number">${data.entity?.document_count || 0}</span>
          <span class="person-stat-label">Documents</span>
        </div>
        <div class="person-stat">
          <span class="person-stat-number">${data.total_flights || 0}</span>
          <span class="person-stat-label">Flights</span>
        </div>
        <div class="person-stat">
          <span class="person-stat-number">${data.entity?.email_count || 0}</span>
          <span class="person-stat-label">Emails</span>
        </div>
        <div class="person-stat">
          <span class="person-stat-number">${data.court_cases?.length || 0}</span>
          <span class="person-stat-label">Court Cases</span>
        </div>
      `;

      // Archive panel
      renderArchivePanel(data);

      // Flights panel
      renderFlightsPanel(data.flights || []);

      // Court records panel
      renderCourtPanel(data.court_cases || []);

      // News panel
      renderNewsPanel(data.news || []);

      // Documents section
      renderDocumentsSection(data);

    } catch (error) {
      personLoading.style.display = 'none';
      personError.style.display   = 'block';
      personError.textContent     = `Failed to load profile: ${error.message}`;
      console.error('[app] Profile load error:', error);
    }
  }


  // ─────────────────────────────────────────────────────
  // PANEL RENDERERS
  // ─────────────────────────────────────────────────────

  // Archive panel — summary combining both data sources
  function renderArchivePanel(data) {
    const entity = data.entity || {};

    if (!entity.name) {
      panelArchive.innerHTML = '<p class="no-results">No entity profile found in the archive.</p>';
      return;
    }

    // Legal status badges (convicted, charged, deceased, etc.)
    const statusBadges = (entity.legal_status || []).map(s => {
      const label = s.replace(/-/g, ' ');
      const cls = s === 'convicted' ? 'badge badge-convicted' : 'badge badge-status';
      return `<span class="${cls}">${escapeHtml(label)}</span>`;
    }).join(' ');

    // Aliases (other names this person goes by)
    const aliasHtml = (entity.aliases || []).length
      ? `<p><strong style="color:var(--text);">Also known as:</strong> ${escapeHtml(entity.aliases.join(', '))}</p>`
      : '';

    // Links to both source databases
    const eiLink = entity.slug
      ? `<a href="https://www.epsteininvestigation.org/entity/${entity.slug}" target="_blank" rel="noopener">Investigation Archive ↗</a>`
      : '';
    const eeLink = entity.slug
      ? `<a href="https://epsteinexposed.com/persons/${entity.slug}" target="_blank" rel="noopener">Epstein Exposed ↗</a>`
      : '';

    panelArchive.innerHTML = `
      <div style="font-size:0.875rem; color:var(--text-muted); line-height:1.8;">
        ${statusBadges ? `<div style="margin-bottom:0.75rem;">${statusBadges}</div>` : ''}
        ${entity.short_bio ? `<p style="margin-bottom:0.75rem; color:var(--text);">${escapeHtml(entity.short_bio)}</p>` : ''}
        ${aliasHtml}
        <p><strong style="color:var(--text);">Documents:</strong> ${(entity.document_count || 0).toLocaleString()} files</p>
        <p><strong style="color:var(--text);">Flights:</strong> ${(entity.flight_count || 0).toLocaleString()} recorded</p>
        <p><strong style="color:var(--text);">Emails:</strong> ${(entity.email_count || 0).toLocaleString()} records</p>
        ${entity.connection_count ? `<p><strong style="color:var(--text);">Connections:</strong> ${entity.connection_count} linked individuals</p>` : ''}
        ${entity.black_book ? `<p><strong style="color:var(--text);">Black Book:</strong> Listed in Epstein's personal contact book</p>` : ''}
        ${(eiLink || eeLink) ? `<p style="margin-top:0.75rem;">${[eiLink, eeLink].filter(Boolean).join(' · ')}</p>` : ''}
      </div>
    `;
  }

  // Flights panel — list of flights this person took on Epstein's planes
  function renderFlightsPanel(flights) {
    if (!flights || flights.length === 0) {
      panelFlights.innerHTML = '<p class="no-results">No flight records found.</p>';
      return;
    }

    panelFlights.innerHTML = flights.map(flight => {
      const from = flight.departure_airport || flight.departure_airport_code || '?';
      const to   = flight.arrival_airport   || flight.arrival_airport_code   || '?';
      const date = flight.flight_date ? formatDate(flight.flight_date) : 'Date unknown';
      const passengers = Array.isArray(flight.passenger_names)
        ? flight.passenger_names.join(', ')
        : '';

      return `
        <div class="flight-row">
          <div>
            <div class="flight-route">${escapeHtml(from)} → ${escapeHtml(to)}</div>
            ${passengers ? `<div style="font-size:0.75rem;color:var(--text-muted);">With: ${escapeHtml(passengers)}</div>` : ''}
          </div>
          <div class="flight-date">${escapeHtml(date)}</div>
        </div>
      `;
    }).join('');
  }

  // Court records panel — federal cases from CourtListener
  function renderCourtPanel(cases) {
    if (!cases || cases.length === 0) {
      panelCourt.innerHTML = '<p class="no-results">No federal court cases found in public records.</p>';
      return;
    }

    panelCourt.innerHTML = cases.map(c => {
      // Determine open/closed status for the colored dot indicator
      const isOpen = (c.status || '').toLowerCase() === 'open';
      const dotClass = isOpen ? 'status-open' : 'status-closed';
      const statusText = isOpen ? 'Open' : 'Closed';

      const caseLink = c.url
        ? `<a href="${escapeHtml(c.url)}" target="_blank" rel="noopener">CourtListener ↗</a>`
        : '';

      return `
        <div class="court-row">
          <div class="court-case-name">${escapeHtml(c.case_name || 'Unnamed Case')}</div>
          <div class="court-meta">
            ${c.docket_number ? `<span>${escapeHtml(c.docket_number)}</span>` : ''}
            ${c.court         ? `<span>${escapeHtml(c.court.toUpperCase())}</span>` : ''}
            ${c.date_filed    ? `<span>Filed ${formatDate(c.date_filed)}</span>` : ''}
            <span>
              <span class="status-dot ${dotClass}"></span>${statusText}
            </span>
            ${caseLink}
          </div>
        </div>
      `;
    }).join('');
  }

  // News panel — recent articles from RSS feeds
  function renderNewsPanel(articles) {
    if (!articles || articles.length === 0) {
      panelNews.innerHTML = '<p class="no-results">No recent news articles found.</p>';
      return;
    }

    panelNews.innerHTML = articles.map(article => {
      const date = article.pub_date || article.pubDate
        ? formatDate(article.pub_date || article.pubDate)
        : '';
      const source = article.source || '';

      return `
        <div class="news-row">
          <div class="news-title">
            <a href="${escapeHtml(article.url)}" target="_blank" rel="noopener">
              ${escapeHtml(article.title || 'Untitled')}
            </a>
          </div>
          <div class="news-meta">
            ${source ? `<span>${escapeHtml(source)}</span>` : ''}
            ${date   ? `<span>${escapeHtml(date)}</span>`   : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  // ─────────────────────────────────────────────────────
  // RENDER HELPERS — single document row (reused by both
  // the initial render and the infinite scroll append)
  // ─────────────────────────────────────────────────────
  function renderDocRow(doc) {
    const url = doc.source_url || doc.file_url;
    return `
      <div class="doc-row">
        <div class="doc-row-title">
          ${url
            ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(doc.title || 'Untitled')}</a>`
            : escapeHtml(doc.title || 'Untitled')
          }
        </div>
        <div class="doc-row-excerpt">${escapeHtml(doc.excerpt || '')}</div>
        <div class="doc-row-meta">
          ${doc.document_date ? `<span>${formatDate(doc.document_date)}</span>` : ''}
          ${doc.document_type ? `<span>${formatDocType(doc.document_type)}</span>` : ''}
          ${doc.source        ? `<span>${formatSource(doc.source)}</span>`        : ''}
          ${doc.page_count    ? `<span>${doc.page_count} pages</span>`            : ''}
        </div>
      </div>
    `;
  }

  // Documents section — full-width list pulling from both sources,
  // with infinite scroll to load more on demand.
  function renderDocumentsSection(data) {
    // Use epsteinexposed docs (larger pool) if available,
    // fall back to epsteininvestigation entity docs
    const docs = (data.documents_ee && data.documents_ee.length > 0)
      ? data.documents_ee
      : (data.entity?.recent_documents || []);

    const totalDocs = data.total_docs_ee || data.entity?.document_count || 0;

    if (!docs || docs.length === 0) {
      panelDocuments.innerHTML = `
        <p class="no-results">
          Search directly on the
          <a href="https://www.epsteininvestigation.org/search?q=${encodeURIComponent(data.name)}"
             target="_blank" rel="noopener">Epstein Investigation Archive ↗</a>
          or
          <a href="https://epsteinexposed.com/persons/${data.entity?.slug || ''}"
             target="_blank" rel="noopener">Epstein Exposed ↗</a>
          to browse all documents.
        </p>
      `;
      return;
    }

    // Render the first batch of docs
    panelDocuments.innerHTML = docs.map(doc => renderDocRow(doc)).join('');

    // Set up infinite scroll state for this person
    personDocsSlug  = data.slug;
    personDocsPage  = 1;  // Page 1 is already loaded above
    personDocsTotal = totalDocs;

    if (totalDocs > docs.length) {
      // Add a small "X of Y" note at the top of the panel
      const note = document.createElement('p');
      note.id = 'person-docs-count-note';
      note.className = 'docs-count-note';
      note.textContent = `Showing ${docs.length} of ${totalDocs.toLocaleString()} documents — scroll for more`;
      panelDocuments.insertAdjacentElement('afterbegin', note);

      // Sentinel div watched by the IntersectionObserver
      const sentinel = document.createElement('div');
      sentinel.id = 'person-docs-sentinel';
      panelDocuments.appendChild(sentinel);

      setupPersonDocsObserver();
    }
  }

  // ─────────────────────────────────────────────────────
  // INFINITE SCROLL — Person Profile Documents
  // ─────────────────────────────────────────────────────
  // Uses the IntersectionObserver API — a browser-native
  // way to detect when an element enters the visible area.
  // When the invisible sentinel div at the bottom of the
  // document list scrolls into view, we fetch the next page.
  function setupPersonDocsObserver() {
    const sentinel = document.getElementById('person-docs-sentinel');
    if (!sentinel) return;

    personDocsObserver = new IntersectionObserver(async (entries) => {
      if (!entries[0].isIntersecting || personDocsActive) return;
      personDocsActive = true;

      // Spinner shown while the request is in flight
      const spinner = document.createElement('div');
      spinner.className = 'docs-loading-more';
      spinner.id = 'person-docs-spinner';
      spinner.innerHTML = '<div class="spinner-sm"></div><span>Loading more…</span>';
      sentinel.before(spinner);

      try {
        const nextPage = personDocsPage + 1;
        const res  = await fetch(`/api/person/${encodeURIComponent(personDocsSlug)}/documents?page=${nextPage}&limit=10`);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const result = await res.json();

        document.getElementById('person-docs-spinner')?.remove();

        if (result.documents && result.documents.length > 0) {
          sentinel.insertAdjacentHTML('beforebegin',
            result.documents.map(doc => renderDocRow(doc)).join('')
          );
          personDocsPage = nextPage;

          // Update the count note
          const loaded = panelDocuments.querySelectorAll('.doc-row').length;
          const noteEl = document.getElementById('person-docs-count-note');
          if (noteEl) {
            noteEl.textContent = loaded >= personDocsTotal
              ? `All ${personDocsTotal.toLocaleString()} documents loaded`
              : `Showing ${loaded} of ${personDocsTotal.toLocaleString()} documents — scroll for more`;
          }
        }

        // If the page came back empty or we've loaded everything, stop observing
        if (!result.documents || result.documents.length === 0 ||
            panelDocuments.querySelectorAll('.doc-row').length >= personDocsTotal) {
          sentinel.remove();
          personDocsObserver.disconnect();
          personDocsObserver = null;
        }

      } catch (e) {
        document.getElementById('person-docs-spinner')?.remove();
        console.error('[app] loadMorePersonDocs error:', e);
      }

      personDocsActive = false;
    }, {
      // Fire when the sentinel is within 200px of the bottom of the viewport
      rootMargin: '0px 0px 200px 0px',
      threshold: 0
    });

    personDocsObserver.observe(sentinel);
  }

  // ─────────────────────────────────────────────────────
  // INFINITE SCROLL — Search Result Documents
  // ─────────────────────────────────────────────────────
  function setupSearchDocsObserver() {
    const sentinel = document.getElementById('search-docs-sentinel');
    if (!sentinel) return;

    searchDocsObserver = new IntersectionObserver(async (entries) => {
      if (!entries[0].isIntersecting || searchDocsActive) return;
      searchDocsActive = true;

      const spinner = document.createElement('div');
      spinner.className = 'docs-loading-more';
      spinner.id = 'search-docs-spinner';
      spinner.innerHTML = '<div class="spinner-sm"></div><span>Loading more…</span>';
      sentinel.before(spinner);

      try {
        const nextPage = searchDocsPage + 1;
        const res = await fetch(`/api/search/docs?q=${encodeURIComponent(searchDocsQuery)}&page=${nextPage}&limit=10`);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const result = await res.json();

        document.getElementById('search-docs-spinner')?.remove();

        if (result.documents && result.documents.length > 0) {
          sentinel.insertAdjacentHTML('beforebegin',
            result.documents.map(doc => renderDocCard(doc)).join('')
          );
          searchDocsPage = nextPage;
        }

        if (!result.documents || result.documents.length === 0) {
          sentinel.remove();
          searchDocsObserver.disconnect();
          searchDocsObserver = null;
        }

      } catch (e) {
        document.getElementById('search-docs-spinner')?.remove();
        console.error('[app] loadMoreSearchDocs error:', e);
      }

      searchDocsActive = false;
    }, {
      rootMargin: '0px 0px 200px 0px',
      threshold: 0
    });

    searchDocsObserver.observe(sentinel);
  }


  // ─────────────────────────────────────────────────────
  // TOPIC BROWSING
  // ─────────────────────────────────────────────────────
  // loadTopics() fetches all topic definitions from the API
  // and renders clickable topic cards on the home page.
  // performTopicSearch() fires when a card is clicked.

  async function loadTopics() {
    try {
      const res  = await fetch('/api/topic');
      if (!res.ok) throw new Error('Failed to fetch topics');
      const data = await res.json();
      renderTopicGrid(data.topics, data.categories);
    } catch (e) {
      // If topics fail to load, just hide the section cleanly
      const section = document.getElementById('topic-section');
      if (section) section.style.display = 'none';
      console.error('[app] loadTopics error:', e);
    }
  }

  function renderTopicGrid(topics, categories) {
    const grid = document.getElementById('topic-grid');
    if (!grid) return;

    // Group topics by category
    const grouped = {};
    for (const topic of topics) {
      if (!grouped[topic.category]) grouped[topic.category] = [];
      grouped[topic.category].push(topic);
    }

    // Render each category group
    const categoryOrder = ['crimes', 'networks', 'legal', 'locations'];
    const categoryLabels = categories || {
      crimes: 'Criminal Acts', networks: 'Networks & Connections',
      legal: 'Legal Record',   locations: 'Key Locations'
    };

    let html = '';
    for (const cat of categoryOrder) {
      if (!grouped[cat]) continue;
      html += `<div class="topic-category-group">
        <h3 class="topic-category-label">${escapeHtml(categoryLabels[cat] || cat)}</h3>
        <div class="topic-category-cards">`;
      for (const topic of grouped[cat]) {
        html += `
          <button class="topic-card" data-slug="${escapeHtml(topic.slug)}">
            <span class="topic-card-name">${escapeHtml(topic.name)}</span>
            <span class="topic-card-desc">${escapeHtml(topic.description)}</span>
          </button>`;
      }
      html += `</div></div>`;
    }

    grid.innerHTML = html;

    // Attach click handlers to all topic cards
    grid.querySelectorAll('.topic-card').forEach(card => {
      card.addEventListener('click', () => {
        performTopicSearch(card.dataset.slug);
      });
    });
  }

  async function performTopicSearch(slug) {
    // Disconnect any existing observers from previous navigation
    if (searchDocsObserver) { searchDocsObserver.disconnect(); searchDocsObserver = null; }
    if (topicDocsObserver)  { topicDocsObserver.disconnect();  topicDocsObserver  = null; }

    currentTopicSlug = slug;
    lastQuery = '';  // Clear keyword search state

    showView('results');

    // Show loading state
    resultsLoading.style.display  = 'flex';
    resultsError.style.display    = 'none';
    entityResults.innerHTML       = '';
    documentResults.innerHTML     = '';
    topicContext.style.display    = 'none';

    try {
      const res  = await fetch(`/api/topic/${encodeURIComponent(slug)}`);
      if (!res.ok) throw new Error(`Server returned status ${res.status}`);
      const data = await res.json();

      document.title = `${data.topic.name} — The Epstein Index`;
      resultsLoading.style.display = 'none';

      // Show topic name as results heading
      resultsTitle.textContent = data.topic.name;
      resultsMeta.textContent  =
        `${data.total_entities} people · ${data.total_documents} documents`;

      // Show the topic context banner with description + keyword tags
      topicContextDesc.textContent = data.topic.description;
      topicContextTags.innerHTML = data.topic.keywords
        .map(kw => `<span class="topic-kw-tag">${escapeHtml(kw)}</span>`)
        .join('');
      topicContext.style.display = 'block';

      // Render people
      if (data.entities && data.entities.length > 0) {
        entityResults.innerHTML = data.entities
          .map(entity => renderEntityCard(entity))
          .join('');
        document.querySelectorAll('.entity-card').forEach(card => {
          card.addEventListener('click', () => {
            loadPersonProfile(card.dataset.slug, card.dataset.name);
          });
        });
      } else {
        entityResults.innerHTML = '<p class="no-results">No named individuals found for this topic.</p>';
      }

      // Render documents with infinite scroll
      if (data.documents && data.documents.length > 0) {
        documentResults.innerHTML = data.documents
          .map(doc => renderDocCard(doc))
          .join('');

        topicDocsPage  = 1;
        topicDocsTotal = data.total_documents;

        if (data.total_documents > data.documents.length) {
          const sentinel = document.createElement('div');
          sentinel.id = 'topic-docs-sentinel';
          documentResults.appendChild(sentinel);
          setupTopicDocsObserver();
        }
      } else {
        documentResults.innerHTML = '<p class="no-results">No documents found for this topic.</p>';
      }

    } catch (error) {
      resultsLoading.style.display = 'none';
      resultsError.style.display   = 'block';
      resultsError.textContent     = `Failed to load topic: ${error.message}`;
      console.error('[app] Topic search error:', error);
    }
  }

  // Infinite scroll for topic documents — same pattern as search/person docs
  function setupTopicDocsObserver() {
    const sentinel = document.getElementById('topic-docs-sentinel');
    if (!sentinel) return;

    topicDocsObserver = new IntersectionObserver(async (entries) => {
      if (!entries[0].isIntersecting || topicDocsActive) return;
      topicDocsActive = true;

      const spinner = document.createElement('div');
      spinner.className = 'docs-loading-more';
      spinner.id = 'topic-docs-spinner';
      spinner.innerHTML = '<div class="spinner-sm"></div><span>Loading more…</span>';
      sentinel.before(spinner);

      try {
        const nextPage = topicDocsPage + 1;
        const res = await fetch(`/api/topic/${encodeURIComponent(currentTopicSlug)}/docs?page=${nextPage}&limit=10`);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const result = await res.json();

        document.getElementById('topic-docs-spinner')?.remove();

        if (result.documents && result.documents.length > 0) {
          sentinel.insertAdjacentHTML('beforebegin',
            result.documents.map(doc => renderDocCard(doc)).join('')
          );
          topicDocsPage = nextPage;
        }

        if (!result.documents || result.documents.length === 0) {
          sentinel.remove();
          topicDocsObserver.disconnect();
          topicDocsObserver = null;
        }

      } catch (e) {
        document.getElementById('topic-docs-spinner')?.remove();
        console.error('[app] loadMoreTopicDocs error:', e);
      }

      topicDocsActive = false;
    }, { rootMargin: '0px 0px 200px 0px', threshold: 0 });

    topicDocsObserver.observe(sentinel);
  }

  // ─────────────────────────────────────────────────────
  // DECLASSIFIED PROGRAMS
  // ─────────────────────────────────────────────────────
  // Fetches the curated list of declassified government
  // programs from /api/declassified and renders them as
  // external-link cards grouped by category.

  async function loadDeclassified() {
    try {
      const res  = await fetch('/api/declassified');
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      renderDeclassifiedGrid(data.programs, data.categories);
    } catch (e) {
      const section = document.getElementById('declassified-section');
      if (section) section.style.display = 'none';
      console.error('[app] loadDeclassified error:', e);
    }
  }

  function renderDeclassifiedGrid(programs, categories) {
    const grid = document.getElementById('declassified-grid');
    if (!grid) return;

    // Group programs by category
    const grouped = {};
    for (const prog of programs) {
      if (!grouped[prog.category]) grouped[prog.category] = [];
      grouped[prog.category].push(prog);
    }

    const categoryOrder = ['intel_epstein', 'domestic_ops', 'mind_control', 'consciousness'];
    const categoryLabels = categories || {};

    let html = '';
    for (const cat of categoryOrder) {
      if (!grouped[cat]) continue;
      html += `<div class="decl-category-group">
        <h3 class="decl-category-label">${escapeHtml(categoryLabels[cat] || cat)}</h3>
        <div class="decl-category-cards">`;

      for (const prog of grouped[cat]) {
        html += `
          <a class="decl-card"
             href="${escapeHtml(prog.source_url)}"
             target="_blank"
             rel="noopener">
            <div class="decl-card-header">
              <span class="decl-card-name">${escapeHtml(prog.name)}</span>
              <span class="decl-card-source">${escapeHtml(prog.source_name)} ↗</span>
            </div>
            <div class="decl-card-subtitle">${escapeHtml(prog.subtitle)}</div>
            <div class="decl-card-desc">${escapeHtml(prog.description)}</div>
            <div class="decl-card-connection">
              <span class="decl-connection-label">Epstein connection:</span>
              ${escapeHtml(prog.connection)}
            </div>
            <div class="decl-card-count">${escapeHtml(prog.doc_count)}</div>
          </a>`;
      }

      html += `</div></div>`;
    }

    grid.innerHTML = html;
  }

  // ─────────────────────────────────────────────────────
  // UTILITY FUNCTIONS
  // ─────────────────────────────────────────────────────

  // Convert a display name to a URL-safe slug
  // "Ghislaine Maxwell" → "ghislaine-maxwell"
  function nameToSlug(name) {
    return (name || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric chars with hyphens
      .replace(/^-|-$/g, '');        // Remove leading/trailing hyphens
  }

  // Format a date string into a readable format
  // "2024-01-15" → "Jan 15, 2024"
  function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      // We append T00:00:00 to prevent timezone-related off-by-one day issues
      return new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : ''))
        .toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  // Make document type slugs human-readable
  // "court_record" → "Court Record"
  function formatDocType(type) {
    const map = {
      court_record:    'Court Record',
      fbi_file:        'FBI File',
      foia_release:    'FOIA Release',
      deposition:      'Deposition',
      correspondence:  'Correspondence',
      financial_record:'Financial Record',
      other:           'Document'
    };
    return map[type] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  // Make source identifiers human-readable
  // "doj_dataset_1" → "DOJ Dataset"
  function formatSource(source) {
    const map = {
      doj_dataset_1:    'DOJ',
      doj_court_records:'DOJ Court Records',
      fbi_vault:        'FBI Vault',
      house_oversight:  'House Oversight'
    };
    return map[source] || source.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  // ── SECURITY: escapeHtml ──
  // IMPORTANT: Any time we insert user-controlled or API-sourced
  // text into the HTML, we MUST escape it first. Without this,
  // a name containing <script> tags could execute malicious code
  // in the browser — this is called an XSS (Cross-Site Scripting)
  // attack. escapeHtml converts dangerous characters to safe ones:
  //   < → &lt;    > → &gt;    " → &quot;    & → &amp;
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }


  // ─────────────────────────────────────────────────────
  // EVENT LISTENERS
  // ─────────────────────────────────────────────────────
  // These lines "listen" for user actions (clicks, keypresses)
  // and call the appropriate functions in response.

  // Load topic cards and declassified program cards on startup
  loadTopics();
  loadDeclassified();

  // Home search button click
  homeSearchBtn.addEventListener('click', () => {
    performSearch(homeSearchInput.value);
  });

  // Home search: pressing Enter triggers search
  homeSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') performSearch(homeSearchInput.value);
  });

  // Header search button click
  headerSearchBtn.addEventListener('click', () => {
    performSearch(headerSearchInput.value);
  });

  // Header search: pressing Enter triggers search
  headerSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') performSearch(headerSearchInput.value);
  });

  // Example tag buttons on the home page
  document.querySelectorAll('.example-tag').forEach(tag => {
    tag.addEventListener('click', () => {
      const query = tag.dataset.query;
      homeSearchInput.value = query;
      performSearch(query);
    });
  });

  // Back button on person profile: return to results
  backBtn.addEventListener('click', () => {
    if (lastQuery) {
      showView('results');
    } else {
      showView('home');
    }
  });

  // Back button on results page: return to home
  resultsBackBtn.addEventListener('click', () => {
    showView('home');
  });

  // Logo click: go back to home
  logoLink.addEventListener('click', (e) => {
    e.preventDefault();
    showView('home');
  });

}); // end DOMContentLoaded
