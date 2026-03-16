// -------------------------------------------------------
// newsService.js — News Article Fetcher
// -------------------------------------------------------
// This file fetches recent news articles about people in
// the Epstein files by reading RSS feeds from major news
// organizations.
//
// RSS (Really Simple Syndication) is a standard format that
// news sites use to publish their latest articles. Think of
// it like a public bulletin board that any app can read.
// We don't need any API keys — it's completely open.
//
// We search several outlets for each person's name and
// return any matching articles from the past 6 months.
// -------------------------------------------------------

const axios = require('axios');
const RSSParser = require('rss-parser');

// Create an RSS parser instance.
// This library handles the XML format that RSS feeds use.
const parser = new RSSParser({
  timeout: 8000,   // Give up after 8 seconds if a feed is slow
  headers: {
    // Some news sites block automated requests without a User-Agent header.
    // This makes our request look like a normal browser visit.
    'User-Agent': 'Mozilla/5.0 (compatible; EpsteinIndex/1.0; public research tool)'
  }
});

// -------------------------------------------------------
// NEWS SOURCES
// -------------------------------------------------------
// These are RSS feeds from reputable news organizations
// that have covered the Epstein case extensively.
// Each has a search URL template where we plug in a name.
// -------------------------------------------------------
const NEWS_SOURCES = [
  {
    name: 'Reuters',
    // Reuters search RSS: returns articles matching a query
    urlTemplate: (query) => `https://feeds.reuters.com/reuters/topNews`
    // Note: Reuters doesn't support query-based RSS, so we fetch
    // their top news and filter client-side. See fetchNewsForPerson().
  },
  {
    name: 'Google News',
    // Google News provides query-based RSS feeds — very useful.
    // %22 is URL-encoding for quotation marks, so we search for
    // the exact name in quotes to reduce false positives.
    urlTemplate: (query) =>
      `https://news.google.com/rss/search?q=%22${encodeURIComponent(query)}%22+epstein&hl=en-US&gl=US&ceid=US:en`
  }
];

// -------------------------------------------------------
// fetchNewsForPerson(name)
// -------------------------------------------------------
// Fetches recent news articles mentioning a given person
// in the context of the Epstein case.
//
// Returns an array of article objects, each with:
// - title: the headline
// - url: link to the full article
// - source: which news outlet
// - pubDate: when it was published
// - snippet: a short excerpt if available
// -------------------------------------------------------
async function fetchNewsForPerson(name) {
  const articles = [];

  // Try each news source
  for (const source of NEWS_SOURCES) {
    try {
      const feedUrl = source.urlTemplate(name);
      const feed = await parser.parseURL(feedUrl);

      // Each "item" in the RSS feed is one article
      for (const item of (feed.items || [])) {
        // For sources that don't support query filtering (like Reuters),
        // we check if the person's name appears in the title or summary.
        const titleLower    = (item.title   || '').toLowerCase();
        const summaryLower  = (item.contentSnippet || item.summary || '').toLowerCase();
        const nameLower     = name.toLowerCase();

        // Only include the article if the name actually appears in it.
        // This prevents false positives from general Epstein coverage.
        if (titleLower.includes(nameLower) || summaryLower.includes(nameLower)) {

          // Parse the publication date — some feeds use different date formats
          const pubDate = item.pubDate || item.isoDate || null;

          // Only include articles from the past 6 months to keep results fresh.
          // If we can't parse the date, include it anyway (benefit of the doubt).
          if (pubDate) {
            const articleAge = Date.now() - new Date(pubDate).getTime();
            const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;
            if (articleAge > SIX_MONTHS_MS) continue; // Skip old articles
          }

          articles.push({
            title:   item.title,
            url:     item.link,
            source:  source.name,
            pubDate: pubDate,
            snippet: item.contentSnippet || item.summary || ''
          });
        }
      }

    } catch (error) {
      // If one news source fails, we just skip it and continue with the others.
      // We don't want one bad feed to break the whole news section.
      console.warn(`[newsService] Failed to fetch from ${source.name} for "${name}":`, error.message);
    }
  }

  // Sort articles newest-first before returning
  articles.sort((a, b) => {
    const dateA = a.pubDate ? new Date(a.pubDate) : new Date(0);
    const dateB = b.pubDate ? new Date(b.pubDate) : new Date(0);
    return dateB - dateA; // Descending: newest first
  });

  // Return at most 10 articles to keep the UI clean
  return articles.slice(0, 10);
}

module.exports = { fetchNewsForPerson };
