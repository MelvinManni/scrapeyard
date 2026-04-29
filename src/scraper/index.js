import { fetch } from 'undici';
import * as cheerio from 'cheerio';
import { createHash } from 'node:crypto';

const UA = process.env.USER_AGENT || 'ScrapeYard/1.0';
const HL = process.env.DEFAULT_LOCALE || 'en-US';
const GL = process.env.DEFAULT_REGION || 'US';

export function urlHash(u) {
  return createHash('sha1').update(u).digest('hex').slice(0, 16);
}

function decodeEntities(s) {
  if (!s) return s;
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
}

// Google News RSS — reliable, no JS, gives source/time/snippet for free.
async function searchGoogleNews(keyword) {
  const q = encodeURIComponent(keyword);
  const url = `https://news.google.com/rss/search?q=${q}&hl=${HL}&gl=${GL}&ceid=${GL}:${HL.split('-')[0]}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Google News ${res.status}`);
  const xml = await res.text();
  const $ = cheerio.load(xml, { xmlMode: true });

  const items = [];
  $('item').each((_, el) => {
    const $el = $(el);
    const title = decodeEntities($el.find('title').text().trim());
    const link = $el.find('link').text().trim();
    const pub = $el.find('pubDate').text().trim();
    const source = $el.find('source').text().trim();
    const desc = $el.find('description').text().trim();

    // description often contains <a href>title</a> blobs — strip to plain
    let snippet = '';
    try {
      const $$ = cheerio.load(desc);
      snippet = $$.text().replace(title, '').replace(source, '').trim();
      if (!snippet) snippet = $$.root().find('a').first().text() || '';
    } catch { snippet = desc; }

    if (title && link) {
      items.push({
        title,
        url: link,
        source: source || 'Google News',
        snippet: snippet.slice(0, 320),
        published_at: pub ? new Date(pub).getTime() : null,
        image_url: null,
      });
    }
  });
  return items;
}

// Direct Cheerio fetch for any URL — useful for full-page enrichment.
export async function fetchAndParse(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`fetch ${url} ${res.status}`);
  const html = await res.text();
  return cheerio.load(html);
}

// Extract OpenGraph image from a page.
export async function extractOgImage(url) {
  try {
    const $ = await fetchAndParse(url);
    return (
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      null
    );
  } catch { return null; }
}

// Heavy fallback for sites that need JavaScript. Lazy-imported so playwright
// stays optional — the module loads fine if browsers aren't installed.
export async function renderWithPlaywright(url) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ userAgent: UA });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    return await page.content();
  } finally {
    await browser.close();
  }
}

// Run a search across multiple keywords, dedupe by URL.
export async function runScrape({ keywords }) {
  const seen = new Set();
  const out = [];
  const errors = [];

  await Promise.all(
    keywords.map(async (kw) => {
      try {
        const items = await searchGoogleNews(kw);
        for (const it of items) {
          const key = urlHash(it.url);
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({ ...it, url_hash: key, matched_keyword: kw });
        }
      } catch (e) {
        errors.push({ keyword: kw, error: String(e.message || e) });
      }
    })
  );

  out.sort((a, b) => (b.published_at || 0) - (a.published_at || 0));
  return { items: out, errors };
}
