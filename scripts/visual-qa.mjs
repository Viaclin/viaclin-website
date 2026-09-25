#!/usr/bin/env node
// Visual QA: every route at 1440, 768 and 390 px, in the light and the dark theme.
// For each view the script scrolls the page so lazy media loads, asserts that nothing overflows
// sideways, collects console errors and page errors, and saves a full-page PNG to qa/.
//
//   npm run dev (or npm run preview), then: npm run qa:visual
//   BASE=http://127.0.0.1:4321 npm run qa:visual       another server
//   npm run qa:visual -- --all                          the built-in route list, even when dist exists
//   npm run qa:visual -- --routes=home,contact          chosen routes (home is /; a leading slash is optional)
//   npm run qa:visual -- --motion                       leave motion on (no static flag, no reduced motion)
//   npm run qa:visual -- --verbose                      print each view as it finishes
//   npm run qa:visual -- --no-banner                    store a "reject all" choice first, so the cookie banner
//                                                       stays out of the screenshots
//
// Exit code 1 on any overflow, console error, page error or missing page.

import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// Console messages that are expected. Nothing else is ignored. Each entry names its reason.
const ALLOW = [
  { route: '/404', pattern: /status of 404/i, reason: 'the 404 page answers with status 404 by design' },
  { devOnly: true, pattern: /\/pagefind\/pagefind\.js/, reason: 'the search index exists after a build; a dev server has none, and the search dialog says so' },
];

const WIDTHS = [1440, 768, 390];
const THEMES = ['light', 'dark'];
const HEIGHTS = { 1440: 900, 768: 1024, 390: 844 };
const PARALLEL = 3;
const VIEW_TIMEOUT_MS = 90000;

// Routes from the plan, used when dist holds no pages.
const BUILT_IN_ROUTES = [
  '/', '/services/supply-chain-consultancy', '/services/project-management',
  '/services/operations-excellence', '/how-we-work', '/contact',
  '/thanks', '/privacy', '/terms', '/cookies', '/accessibility', '/legal', '/search', '/brand', '/404',
];

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = (process.env.BASE || 'http://127.0.0.1:4321').replace(/\/$/, '');
const args = process.argv.slice(2);
const motion = args.includes('--motion');
const verbose = args.includes('--verbose');
const noBanner = args.includes('--no-banner');
const outDir = join(root, 'qa');

function routesFromDist() {
  const dist = resolve(root, process.env.DIST || 'dist');
  if (!existsSync(dist) || !statSync(dist).isDirectory()) return [];
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'pagefind' && entry.name !== '_astro') walk(full);
      } else if (entry.name.endsWith('.html')) {
        // A file that also sits in public/ is a static download (the email signature), not a route.
        if (existsSync(join(root, 'public', relative(dist, full)))) continue;
        const path = `/${relative(dist, full).split('\\').join('/')}`.replace(/\.html$/, '').replace(/\/index$/, '');
        found.push(path === '' ? '/' : path);
      }
    }
  };
  walk(dist);
  return found.sort((a, b) => (a === '/' ? -1 : b === '/' ? 1 : a.localeCompare(b)));
}

/** Accepts /contact, contact or home. Names without a slash survive shells that rewrite paths (Git Bash). */
function normaliseRoute(value) {
  const route = value.trim().replace(/^\/+|\/+$/g, '');
  if (!route) return value.trim() === '/' ? '/' : '';
  return route === 'home' || route === 'index' ? '/' : `/${route}`;
}

function pickRoutes() {
  const chosen = args.find((arg) => arg.startsWith('--routes='));
  if (chosen) return { routes: chosen.slice(9).split(',').map(normaliseRoute).filter(Boolean), source: 'the --routes flag' };
  if (!args.includes('--all')) {
    const fromDist = routesFromDist();
    if (fromDist.length) return { routes: fromDist, source: 'dist' };
  }
  return { routes: BUILT_IN_ROUTES, source: 'the built-in list' };
}

async function launch() {
  try {
    return await chromium.launch({ channel: 'msedge' });
  } catch {
    try {
      return await chromium.launch();
    } catch (error) {
      console.error('Visual QA: no browser to drive. Install Microsoft Edge, or run: npx playwright install chromium');
      console.error(String(error.message).split('\n')[0]);
      process.exit(1);
    }
  }
}

const slugOf = (route) => (route === '/' ? 'home' : route.replace(/^\/+/, '').replace(/[^a-z0-9]+/gi, '-'));
let devServer = false;
const isAllowed = (route, text) =>
  ALLOW.some((rule) => (!rule.route || rule.route === route) && (!rule.devOnly || devServer) && rule.pattern.test(text));

/** A dev server serves the Vite client; a preview or live server does not. */
async function isDevServer() {
  try {
    const response = await fetch(`${BASE}/@vite/client`, { signal: AbortSignal.timeout(8000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function serverAnswers() {
  try {
    const response = await fetch(`${BASE}/`, { signal: AbortSignal.timeout(8000) });
    return response.status < 500;
  } catch {
    return false;
  }
}

/** Puts a deadline on a step, so one stuck page cannot stall the whole run. */
function withDeadline(promise, ms, label) {
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label}: no result in ${ms / 1000} s`)), ms);
  });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

async function capture(context, route, width, theme) {
  const result = { route, width, theme, errors: [], overflow: null, status: 0, file: '' };
  let page = await context.newPage();
  const listen = () => {
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      const at = message.location()?.url;
      const text = `${message.text()}${at && !message.text().includes(at) ? ` (${at})` : ''}`;
      if (!isAllowed(route, text)) result.errors.push(`console: ${text}`);
    });
    page.on('pageerror', (error) => {
      if (!isAllowed(route, error.message)) result.errors.push(`page error: ${error.message}`);
    });
  };
  listen();

  const query = `theme=${theme}${motion ? '' : '&static=1'}`;
  const url = `${BASE}${route}${route.includes('?') ? '&' : '?'}${query}`;
  const run = async () => {
    let response;
    try {
      response = await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
    } catch {
      response = await page.goto(url, { waitUntil: 'load', timeout: 20000 });
    }
    result.status = response ? response.status() : 0;
    if (result.status === 404 && route !== '/404') {
      result.errors.push('missing page: the server answered 404');
      return;
    }
    await page.waitForTimeout(500);

    // Walk down the page so lazy posters, films and reveals load, then return to the top.
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < height; y += 700) {
      await page.evaluate((top) => window.scrollTo(0, top), y);
      await page.waitForTimeout(100);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);

    const size = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    if (size.scrollWidth !== size.clientWidth) result.overflow = size;

    const file = join('qa', `${slugOf(route)}-${width}-${theme}.png`);
    await page.screenshot({ path: join(root, file), fullPage: true, timeout: 30000 });
    result.file = file;
  };

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await withDeadline(run(), VIEW_TIMEOUT_MS, 'view');
      break;
    } catch (error) {
      const text = String(error.message).split('\n')[0];
      // A dev server reloads the page when a source file changes. Try the view once more on a fresh page.
      if (attempt === 1 && /context was destroyed|navigation|Target page.*closed/i.test(text)) {
        page.close().catch(() => {});
        result.errors.length = 0;
        result.overflow = null;
        page = await context.newPage();
        listen();
        continue;
      }
      result.errors.push(`capture stopped: ${text}`);
      break;
    }
  }
  page.close().catch(() => {});
  if (verbose) console.log(`  done ${route} ${width} ${theme}${result.errors.length || result.overflow ? ' (needs attention)' : ''}`);
  return result;
}

async function main() {
  const { routes, source } = pickRoutes();
  if (!(await serverAnswers())) {
    console.error(`Visual QA: no server answers at ${BASE}. Start one with npm run dev or npm run preview, or set BASE.`);
    process.exit(1);
  }
  devServer = await isDevServer();
  mkdirSync(outDir, { recursive: true });
  console.log(`Visual QA: ${routes.length} ${routes.length === 1 ? 'route' : 'routes'} from ${source}, ${WIDTHS.length} widths, ${THEMES.length} themes, against ${BASE}\n`);

  const browser = await launch();
  const views = WIDTHS.flatMap((width) => THEMES.map((theme) => ({ width, theme })));
  const results = [];
  const queue = [...views];
  const workers = Array.from({ length: Math.min(PARALLEL, queue.length) }, async () => {
    while (queue.length) {
      const { width, theme } = queue.shift();
      const context = await browser.newContext({
        viewport: { width, height: HEIGHTS[width] || 900 },
        deviceScaleFactor: 1,
        colorScheme: theme,
        reducedMotion: motion ? 'no-preference' : 'reduce',
      });
      if (noBanner) {
        // The same record consent.ts writes after "Reject all". Nothing else loads or changes.
        await context.addInitScript(() => {
          try {
            localStorage.setItem('viaclin-consent', JSON.stringify({ v: 1, analytics: false, insights: false, ts: Date.now() }));
          } catch {
            // Storage blocked: the banner shows, which is fine.
          }
        });
      }
      for (const route of routes) results.push(await capture(context, route, width, theme));
      await withDeadline(context.close(), 15000, 'context').catch(() => {});
    }
  });
  await Promise.all(workers);
  await withDeadline(browser.close(), 15000, 'browser').catch(() => {});

  // One row per route, one cell per view.
  const cell = (r) => (r.errors.length && r.overflow ? 'both' : r.overflow ? 'wide' : r.errors.length ? 'error' : 'ok');
  const routeWidth = Math.max(5, ...routes.map((r) => r.length)) + 2;
  console.log(`${'Route'.padEnd(routeWidth)}${views.map((v) => `${v.width} ${v.theme}`.padEnd(12)).join('')}`);
  for (const route of routes) {
    const cells = views.map((view) => {
      const found = results.find((r) => r.route === route && r.width === view.width && r.theme === view.theme);
      return (found ? cell(found) : 'none').padEnd(12);
    });
    console.log(`${route.padEnd(routeWidth)}${cells.join('')}`);
  }
  console.log('\nok: clean   wide: sideways overflow   error: console or page error   both: overflow and error\n');

  const order = (r) => routes.indexOf(r.route) * 100 + views.findIndex((v) => v.width === r.width && v.theme === r.theme);
  const bad = results.filter((r) => r.errors.length || r.overflow).sort((a, b) => order(a) - order(b));
  for (const r of bad) {
    console.log(`${r.route}  ${r.width} px  ${r.theme}`);
    if (r.overflow) console.log(`  overflow: scrollWidth ${r.overflow.scrollWidth}, clientWidth ${r.overflow.clientWidth}`);
    for (const text of [...new Set(r.errors)]) console.log(`  ${text}`);
  }
  if (bad.length) console.log('');

  console.log(`Screenshots: ${relative(root, outDir)}/ (${results.filter((r) => r.file).length} files)`);
  if (bad.length) {
    console.log(`Visual QA failed: ${bad.length} of ${results.length} views need attention.`);
    process.exit(1);
  }
  console.log(`Visual QA passed: ${results.length} views.`);
  process.exit(0);
}

main();
