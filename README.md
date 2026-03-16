# The Epstein Index

**A non-commercial public interest research tool for searching the Jeffrey Epstein files, court records, flight logs, and documented connections.**

> _"Inclusion in this database does not imply guilt or wrongdoing — it reflects only that a person's name appears in the public record."_

---

## Overview

The Epstein Index is an open-source web application that makes the publicly released Epstein government files searchable and navigable for journalists, researchers, and concerned citizens. It indexes **2.3 million+ documents** sourced exclusively from official U.S. government disclosures, FOIA releases, court filings, and FBI Vault records.

The project was conceived and built by **Christopher Bradford** as a public accountability resource. All data is drawn from verifiable official sources. No proprietary databases, paid data brokers, or unverified information are used.

---

## Features

- **Full-text name and document search** across 2.3M+ government-released documents
- **People in the Files** — searchable profiles of 23,540+ named individuals drawn from court records, flight logs, and DOJ disclosures
- **Flight Records** — 4,700+ flight log entries cross-referenced against named individuals
- **Court Records** — live integration with CourtListener for federal case filings
- **Browse by Topic** — 18 curated topic categories (trafficking, blackmail, finance, Mossad connections, political networks, victims, legal proceedings, and more) each mapped to keyword searches across the full archive
- **Documented Institutional History** — a curated section linking to separately declassified U.S. government records (MKUltra, COINTELPRO, Church Committee, Operation Paperclip, etc.) that document the same institutions and patterns of elite abuse appearing in the Epstein investigation
- **Recent News** — per-person news aggregation from RSS feeds
- **Infinite scroll** on all document result sets — no pagination clicks needed
- **Fully responsive** — works on desktop, tablet, and mobile

---

## Data Sources

All data is sourced from official, publicly available government and court repositories. No proprietary or unverified data is used.

| Source | Type | URL |
|--------|------|-----|
| DOJ Epstein Library | Primary archive | https://www.justice.gov/epstein |
| FBI Vault | FBI releases | https://vault.fbi.gov/jeffrey-epstein |
| Epstein Investigation Archive API | 207,000+ documents, 23,000+ named individuals | https://www.epsteininvestigation.org |
| Epstein Exposed API | 2.1M+ documents with direct DOJ PDF links | https://epsteinexposed.com |
| CourtListener | Federal court records | https://www.courtlistener.com |
| CIA Reading Room | Declassified program records | https://www.cia.gov/readingroom |
| Senate Church Committee Records | 1975–1976 Intelligence oversight | https://www.senate.gov |
| National Archives | Declassified federal records | https://www.archives.gov |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML5, CSS3, JavaScript (ES6+) — no framework |
| Backend | Node.js + Express |
| Database | PostgreSQL (for news caching and scheduled data) |
| External APIs | Epstein Investigation API, Epstein Exposed API, CourtListener API |
| Fonts | Google Fonts — Playfair Display + Inter |
| Hosting | DigitalOcean |

---

## Project Structure

```
theepsteinindex/
├── public/                     # Static frontend (served directly by Express)
│   ├── index.html              # Single-page application shell
│   ├── favicon.svg             # SVG favicon (modern browsers)
│   ├── favicon.ico             # ICO favicon (16/32/48px, legacy browsers)
│   ├── css/
│   │   └── styles.css          # All application styles
│   └── js/
│       └── app.js              # All frontend logic (SPA router, API calls, rendering)
│
├── server/                     # Node.js / Express backend
│   ├── index.js                # Entry point — server setup, middleware, route mounting
│   ├── routes/
│   │   ├── search.js           # GET /api/search?q=  — entity + document search
│   │   ├── person.js           # GET /api/person/:slug — full profile + paginated docs
│   │   ├── topic.js            # GET /api/topic, /api/topic/:slug — topic browsing
│   │   └── declassified.js     # GET /api/declassified — curated program list
│   ├── services/
│   │   ├── epsteinApi.js       # Client for epsteininvestigation.org API
│   │   ├── epsteinExposedApi.js# Client for epsteinexposed.com API (2.1M docs)
│   │   ├── courtListener.js    # Client for CourtListener federal court API
│   │   ├── newsService.js      # RSS news aggregation per person
│   │   └── scheduler.js        # node-cron hourly background update jobs
│   ├── db/
│   │   └── database.js         # PostgreSQL connection + table initialisation
│   └── data/
│       ├── topics.js           # 18 curated topic definitions with keywords
│       └── declassified.js     # 9 curated declassified program records
│
├── gen_favicon.js              # One-time script: generates favicon.ico from scratch
├── .env.example                # Environment variable template
├── package.json
└── .gitignore
```

---

## Getting Started

### Prerequisites

- **Node.js** v18 or higher — https://nodejs.org
- **PostgreSQL** v14 or higher (optional — only required for news caching; the app runs without it)
- **npm** (included with Node.js)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/sunkencity999/theepsteinindex.git
cd theepsteinindex

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env
# Edit .env with your values (see Configuration section below)

# 4. Start the server
npm start
```

The application will be available at **http://localhost:3000**

For development with auto-restart on file changes:

```bash
npm run dev
```

---

## Configuration

Copy `.env.example` to `.env` and configure the following variables:

```env
# Port the server listens on (default: 3000)
PORT=3000

# CourtListener API token
# Free at https://www.courtlistener.com/sign-in/
# Without this token, requests still work but are rate-limited.
COURTLISTENER_TOKEN=your_token_here

# PostgreSQL connection (required only for news caching)
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=epsteinindex
PG_USER=your_db_user
PG_PASSWORD=your_db_password

# Environment label
NODE_ENV=development
```

The app runs without a database — it will log a warning at startup but all core search features work via the external APIs.

---

## API Endpoints

All endpoints return JSON.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/search?q={query}` | Search entities (people) and documents |
| `GET` | `/api/search/docs?q={query}&page={n}&limit=10` | Paginated document search (for infinite scroll) |
| `GET` | `/api/person/:slug` | Full profile: archive summary, flights, court records, news |
| `GET` | `/api/person/:slug/documents?page={n}&limit=10` | Paginated documents for a person (infinite scroll) |
| `GET` | `/api/topic` | List all topic categories and their definitions |
| `GET` | `/api/topic/:slug` | Search archive using a topic's keyword set |
| `GET` | `/api/topic/:slug/docs?page={n}&limit=10` | Paginated topic document results |
| `GET` | `/api/declassified` | Return curated declassified program list |

---

## Topics Covered

The Browse by Topic section organises the archive into 18 thematic entry points:

**Crimes & Abuse** — Sex trafficking, minors, sexual abuse, blackmail, parties & events
**Networks & Connections** — Financial networks, occult connections, Maxwell network, Mossad/intelligence links, political connections, Russian connections, Hollywood connections
**Victims & Survivors** — Victim accounts, legal proceedings
**Locations** — Little St. James (the island), Zorro Ranch (New Mexico)

---

## Documented Institutional History

A companion section links to separately declassified U.S. government records documenting the same institutions, methods, and patterns of elite abuse that appear throughout the Epstein investigation. All programs listed link exclusively to official government repositories:

- **MKUltra** — CIA mind control program (CIA Reading Room)
- **Project ARTICHOKE** — CIA behavioral modification research
- **Operation Paperclip** — Post-WWII intelligence recruitment (National Archives)
- **Project Stargate** — Declassified remote viewing program (CIA Reading Room)
- **COINTELPRO** — FBI domestic surveillance (FBI Vault)
- **Church Committee** — 1975 Senate intelligence oversight hearings
- **Operation Mockingbird** — CIA media infiltration (Church Committee records)
- **Maxwell / Mossad connections** — Documented in court filings and journalism
- **Acosta DOJ admission** — Documented in Miami Herald / Miami U.S. Attorney records

---

## Public Interest Statement

This tool exists because the public has a right to access and understand the documents their government has released. The Epstein files implicate powerful institutions and individuals across finance, politics, intelligence, and media. Making those records searchable is a public service.

**This is not an accusation engine.** Appearance in the archive means only that a person's name appears somewhere in the 3.5 million pages of released government files. Researchers, attorneys, journalists, bystanders, and investigators all appear in these records alongside anyone else.

If you find errors, dead links, or have additional official source material to contribute, please open an issue on GitHub.

---

## Developer

**Christopher Bradford**
- GitHub: [@sunkencity999](https://github.com/sunkencity999)
- Project repository: https://github.com/sunkencity999/theepsteinindex

---

## License

This project is released for public use. The source code is open and may be freely used, modified, and redistributed for non-commercial public interest purposes. Attribution appreciated.

The underlying data belongs to the U.S. government and is in the public domain. This tool makes no claim of ownership over any of the documents, records, or information it indexes.

---

## Acknowledgements

- [Epstein Investigation Archive](https://www.epsteininvestigation.org) — for maintaining a structured API over the DOJ-released documents
- [Epstein Exposed](https://epsteinexposed.com) — for indexing 2.1M+ documents with direct source links
- [CourtListener / Free Law Project](https://www.courtlistener.com) — for free public access to federal court records
- The journalists at the **Miami Herald**, **ProPublica**, and **BBC** whose years of investigative reporting forced the release of these documents into the public record
