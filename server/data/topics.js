// -------------------------------------------------------
// data/topics.js — Topic Definitions
// -------------------------------------------------------
// Each topic maps a human-readable theme to a set of
// search keywords. The topic API runs these keywords
// against both data sources and merges results.
//
// categories:
//   crimes    — direct criminal acts
//   networks  — who was connected and how
//   legal     — court proceedings, immunity, victims
//   locations — physical locations in the files
// -------------------------------------------------------

const TOPICS = [
  // ── CRIMES ──────────────────────────────────────────
  {
    slug:        'trafficking',
    name:        'Sex Trafficking',
    description: 'Documents describing the recruitment, transport, and exploitation of victims across the Epstein network.',
    keywords:    ['sex trafficking', 'trafficking'],
    category:    'crimes'
  },
  {
    slug:        'minors',
    name:        'Crimes Against Minors',
    description: 'Records referencing underage individuals, abuse of minors, and child exploitation in the files.',
    keywords:    ['underage', 'minor'],
    category:    'crimes'
  },
  {
    slug:        'blackmail',
    name:        'Blackmail & Coercion',
    description: 'Evidence of leverage, coercion, and compromising material used to silence victims and protect perpetrators.',
    keywords:    ['blackmail', 'coercion'],
    category:    'crimes'
  },
  {
    slug:        'paedophilia',
    name:        'Child Sexual Abuse',
    description: 'Direct references to child sexual abuse and paedophilia across court filings and investigation documents.',
    keywords:    ['paedophilia', 'child abuse'],
    category:    'crimes'
  },
  {
    slug:        'parties',
    name:        'Events & Gatherings',
    description: 'Records of social events, parties, and gatherings at which abuse was allegedly orchestrated.',
    keywords:    ['party', 'massage'],
    category:    'crimes'
  },
  {
    slug:        'finance',
    name:        'Financial Crimes',
    description: 'Wire transfers, money laundering, offshore accounts, and the financial infrastructure behind the operation.',
    keywords:    ['wire transfer', 'money laundering'],
    category:    'crimes'
  },
  {
    slug:        'occult',
    name:        'Occult & Ritual',
    description: 'Documents referencing occult practices, ritualistic behavior, and related allegations within the network.',
    keywords:    ['occult', 'ritual'],
    category:    'crimes'
  },

  // ── NETWORKS ─────────────────────────────────────────
  {
    slug:        'maxwell',
    name:        'Maxwell & Recruiters',
    description: 'Ghislaine Maxwell, Jean-Luc Brunel, and others who allegedly recruited and groomed victims on Epstein\'s behalf.',
    keywords:    ['maxwell', 'brunel'],
    category:    'networks'
  },
  {
    slug:        'mossad',
    name:        'Intelligence Connections',
    description: 'References to intelligence agencies including CIA, Mossad, and state actors allegedly linked to the Epstein operation.',
    keywords:    ['mossad', 'intelligence'],
    category:    'networks'
  },
  {
    slug:        'israel',
    name:        'Israel & Wexner Network',
    description: 'Epstein\'s deep ties to Israel, the Wexner Foundation, and associated political and financial networks.',
    keywords:    ['israel', 'wexner'],
    category:    'networks'
  },
  {
    slug:        'politics',
    name:        'Political Connections',
    description: 'Politicians, elected officials, and government figures appearing throughout the released documents.',
    keywords:    ['politician', 'senator'],
    category:    'networks'
  },
  {
    slug:        'russia',
    name:        'Russia & Eastern Europe',
    description: 'Russian and Eastern European connections documented within the Epstein orbit and associated networks.',
    keywords:    ['russia', 'russian'],
    category:    'networks'
  },
  {
    slug:        'hollywood',
    name:        'Hollywood & Media',
    description: 'Celebrity, film, and entertainment industry figures appearing in the released files and court records.',
    keywords:    ['hollywood', 'celebrity'],
    category:    'networks'
  },

  // ── LEGAL ────────────────────────────────────────────
  {
    slug:        'victims',
    name:        'Victims & Testimony',
    description: 'Survivor statements, victim depositions, and first-hand accounts of what occurred in the Epstein operation.',
    keywords:    ['victim', 'survivor'],
    category:    'legal'
  },
  {
    slug:        'legal',
    name:        'Legal Proceedings & Immunity',
    description: 'Plea deals, non-prosecution agreements, depositions, and how prosecutors handled — and mishandled — the case.',
    keywords:    ['non-prosecution', 'deposition'],
    category:    'legal'
  },

  // ── LOCATIONS ────────────────────────────────────────
  {
    slug:        'island',
    name:        'Little Saint James Island',
    description: 'Documents about Epstein\'s private island in the U.S. Virgin Islands, central site of many alleged crimes.',
    keywords:    ['little saint james', 'private island'],
    category:    'locations'
  },
  {
    slug:        'new-mexico',
    name:        'Zorro Ranch, New Mexico',
    description: 'Records related to Epstein\'s New Mexico ranch and activities that allegedly took place there.',
    keywords:    ['zorro ranch', 'new mexico'],
    category:    'locations'
  }
];

// Category display labels
const CATEGORIES = {
  crimes:    'Criminal Acts',
  networks:  'Networks & Connections',
  legal:     'Legal Record',
  locations: 'Key Locations'
};

module.exports = { TOPICS, CATEGORIES };
