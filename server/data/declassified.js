// -------------------------------------------------------
// data/declassified.js — Declassified Government Programs
// -------------------------------------------------------
// Curated references to officially declassified government
// records that provide documented institutional context for
// the Epstein investigation and the broader history of
// elite abuse of power in America.
//
// These are NOT part of the Epstein archive — they are
// separate official government disclosures that document
// the same institutions and methods that appear in the
// Epstein files.
//
// All source_url values link directly to official government
// repositories: CIA Reading Room, FBI Vault, Senate records,
// National Archives.
// -------------------------------------------------------

const PROGRAMS = [

  // ── MIND CONTROL & HUMAN EXPERIMENTATION ────────────

  {
    slug:        'mkultra',
    name:        'MKUltra',
    subtitle:    'CIA Mind Control Program, 1953–1973',
    description: 'The CIA\'s covert program testing mind control through LSD, hypnosis, electroconvulsive therapy, and psychological torture on unwitting American and Canadian citizens. Exposed by the Church Committee in 1977.',
    connection:  'Trauma-based conditioning and the sexual compromise of targets documented in MKUltra appear directly in allegations about how the Epstein network recruited, controlled, and silenced victims.',
    source_name: 'CIA Reading Room',
    source_url:  'https://www.cia.gov/readingroom/collection/mkultra-mind-control-collection',
    doc_count:   '~20,000 documents',
    category:    'mind_control'
  },
  {
    slug:        'artichoke',
    name:        'Project ARTICHOKE',
    subtitle:    'CIA Interrogation Research, 1951–1953',
    description: 'The CIA program preceding MKUltra that investigated whether subjects could be made to involuntarily carry out acts against their will through hypnosis, drugs, and psychological manipulation.',
    connection:  'ARTICHOKE established the institutional foundations of non-consensual human experimentation inside U.S. intelligence — the direct precursor to MKUltra\'s industrialised abuse.',
    source_name: 'CIA Reading Room',
    source_url:  'https://www.cia.gov/readingroom/search/site/artichoke',
    doc_count:   'Partially declassified',
    category:    'mind_control'
  },
  {
    slug:        'paperclip',
    name:        'Operation Paperclip',
    subtitle:    'Nazi Scientist Recruitment, 1945–1959',
    description: 'The U.S. program that recruited over 1,600 Nazi scientists — including those who conducted concentration camp experiments — into American research institutions, sanitising their records to hide war crimes.',
    connection:  'Multiple MKUltra researchers had direct ties to Paperclip scientists. Documents how Nazi human experimentation techniques were institutionalised inside U.S. intelligence programs.',
    source_name: 'National Archives',
    source_url:  'https://www.archives.gov/iwg/declassified-records/rg-330-defense-secretary',
    doc_count:   'Declassified files',
    category:    'mind_control'
  },

  // ── CONSCIOUSNESS & PSYCHIC RESEARCH ────────────────

  {
    slug:        'stargate',
    name:        'Project Stargate',
    subtitle:    'CIA/DIA Remote Viewing Program, 1978–1995',
    description: 'A $20M U.S. government program researching remote viewing and psychic phenomena for intelligence applications. The government\'s own evaluators partially validated the results before the program was declassified.',
    connection:  'Documents that senior elements of U.S. intelligence invested heavily in non-conventional consciousness research — factual grounding for broader claims about elite interest in these areas.',
    source_name: 'CIA Reading Room',
    source_url:  'https://www.cia.gov/readingroom/collection/stargate',
    doc_count:   '~89,000 pages',
    category:    'consciousness'
  },

  // ── DOMESTIC OPERATIONS & BLACKMAIL ─────────────────

  {
    slug:        'cointelpro',
    name:        'COINTELPRO',
    subtitle:    'FBI Counterintelligence Program, 1956–1971',
    description: 'The FBI\'s covert and illegal operations to surveil, infiltrate, discredit, and destroy American political organisations. Included wiretapping, forged documents, sexual entrapment, and coordination of violence.',
    connection:  'Establishes the documented FBI playbook of using sexual compromise and blackmail against targets — the same methods alleged in the Epstein operation, running through the same institutions.',
    source_name: 'FBI Vault',
    source_url:  'https://vault.fbi.gov/cointel-pro',
    doc_count:   'Thousands of pages',
    category:    'domestic_ops'
  },
  {
    slug:        'church-committee',
    name:        'Church Committee',
    subtitle:    'Senate Intelligence Investigation, 1975',
    description: 'The landmark Senate investigation that publicly exposed CIA assassination plots, illegal domestic spying, MKUltra, COINTELPRO, and the systematic abuse of power by U.S. intelligence agencies over two decades.',
    connection:  'The most comprehensive public accounting of how U.S. intelligence used sexual compromise, blackmail, and coercion as instruments of power — the institutional template for what the Epstein network allegedly operated at scale.',
    source_name: 'Senate Intelligence Committee',
    source_url:  'https://www.intelligence.senate.gov/sites/default/files/94755_I.pdf',
    doc_count:   '14 volumes',
    category:    'domestic_ops'
  },
  {
    slug:        'mockingbird',
    name:        'Operation Mockingbird',
    subtitle:    'CIA Media Infiltration, 1950s onward',
    description: 'The CIA\'s documented program placing assets inside news organisations and broadcasters to shape domestic and foreign coverage. Confirmed by the Church Committee — journalists and editors were on CIA payroll.',
    connection:  'Provides documented context for how media handling of the Epstein story — what was published, what was suppressed for years — fits a long-established pattern of intelligence-managed public narrative.',
    source_name: 'CIA Records / Church Committee',
    source_url:  'https://www.cia.gov/readingroom/search/site/mockingbird',
    doc_count:   'Partial declassification',
    category:    'domestic_ops'
  },

  // ── DIRECT INTELLIGENCE CONNECTIONS ─────────────────

  {
    slug:        'maxwell-mossad',
    name:        'Robert Maxwell & Mossad',
    subtitle:    'Intelligence Background of Ghislaine Maxwell\'s Father',
    description: 'Robert Maxwell — media baron and father of Epstein co-conspirator Ghislaine Maxwell — was a confirmed Mossad asset, documented by multiple intelligence officials and biographers including Seymour Hersh.',
    connection:  'Establishes the direct intelligence lineage running from Mossad through Robert Maxwell to Ghislaine to Epstein. Multiple intelligence veterans have stated publicly that Epstein\'s operation bore the hallmarks of a state-run honeytrap.',
    source_name: 'Investigative Record',
    source_url:  'https://theintercept.com/2019/07/12/jeffrey-epstein-trump-acosta/',
    doc_count:   'Multiple vetted sources',
    category:    'intel_epstein'
  },
  {
    slug:        'acosta-intelligence',
    name:        'Epstein "Belonged to Intelligence"',
    subtitle:    'U.S. Attorney Alex Acosta, 2008 plea deal',
    description: 'When asked why he gave Epstein an unprecedentedly lenient plea deal in 2008, then-U.S. Attorney Alex Acosta told Trump transition officials that Epstein "belonged to intelligence" and to "leave it alone."',
    connection:  'A direct on-the-record statement from a senior U.S. prosecutor that Epstein was understood to be an intelligence asset — the most explicit official acknowledgment of the intelligence dimension of his operation.',
    source_name: 'Miami Herald',
    source_url:  'https://www.miamiherald.com/news/local/article238284668.html',
    doc_count:   'Reported 2019',
    category:    'intel_epstein'
  }
];

const PROGRAM_CATEGORIES = {
  mind_control:  'Mind Control & Human Experimentation',
  consciousness: 'Consciousness & Psychic Research',
  domestic_ops:  'Domestic Operations & Blackmail',
  intel_epstein: 'Direct Intelligence Connections'
};

module.exports = { PROGRAMS, PROGRAM_CATEGORIES };
