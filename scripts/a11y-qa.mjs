#!/usr/bin/env node
// Accessibility QA: axe-core on every route, in the light and the dark theme, at desktop and phone width.
// Rule sets: wcag2a, wcag2aa, wcag21aa, wcag22aa. Serious and critical violations fail the run;
// moderate and minor ones are listed as warnings.
//
//   npm run dev (or npm run preview), then: npm run qa:a11y
//   BASE=http://127.0.0.1:4321 npm run qa:a11y          another server
//   npm run qa:a11y -- --all                             the built-in route list, even when dist exists
//   npm run qa:a11y -- --routes=home,contact             chosen routes (home is /; a leading slash is optional)
//   npm run qa:a11y -- --verbose                         print each view as it finishes
//
// axe cannot judge contrast for text that sits on footage or glass. Those nodes come back as
// "incomplete"; the count is printed so a person can check them by eye.

import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];
const FAILING = new Set(['serious', 'critical']);
const WIDTHS = [1440, 390];
const THEMES = ['light', 'dark'];
const HEIGHTS = { 1440: 900, 390: 844 };
const PARALLEL = 2;
const VIEW_TIMEOUT_MS = 120000;

// Routes from the plan, used when dist holds no pages.
const BUILT_IN_ROUTES = [
  '/', '/services/supply-chain-consultancy', '/services/project-management',
  '/services/optimised-operations', '/our-team', '/contact',
  '/thanks', '/privacy', '/terms', '/cookies', '/accessibility', '/legal', '/search', '/brand', '/404',
];

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = (process.env.BASE || 'http://127.0.0.1:4321').replace(/\/$/, '');
const args = process.argv.slice(2);
const verbose = args.includes('--verbose');

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
      console.error('Accessibility QA: no browser to drive. Install Microsoft Edge, or run: npx playwright install chromium');
      console.error(String(error.message).split('\n')[0]);
      process.exit(1);
    }
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

async function audit(context, route, width, theme) {
  const result = { route, width, theme, violations: [], incomplete: 0, problem: '' };
  let page = await context.newPage();
  const url = `${BASE}${route}${route.includes('?') ? '&' : '?'}theme=${theme}&static=1`;
  const run = async () => {
    let response;
    try {
      response = await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
    } catch {
      response = await page.goto(url, { waitUntil: 'load', timeout: 20000 });
    }
    if (response && response.status() === 404 && route !== '/404') {
      result.problem = 'missing page: the server answered 404';
      return;
    }
    // Walk down the page so every reveal has run and every poster has loaded before axe reads it.
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < height; y += 700) {
      await page.evaluate((top) => window.scrollTo(0, top), y);
      await page.waitForTimeout(80);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);

    const report = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    result.incomplete = report.incomplete.reduce((sum, item) => sum + item.nodes.length, 0);
    result.violations = report.violations.map((item) => ({
      id: item.id,
      impact: item.impact || 'minor',
      help: item.help,
      count: item.nodes.length,
      targets: item.nodes.slice(0, 3).map((node) => node.target.flat().join(' ')),
    }));
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
        page = await context.newPage();
        continue;
      }
      result.problem = `audit stopped: ${text}`;
      break;
    }
  }
  page.close().catch(() => {});
  if (verbose) console.log(`  done ${route} ${width} ${theme}${result.problem || result.violations.length ? ' (findings)' : ''}`);
  return result;
}

async function main() {
  const { routes, source } = pickRoutes();
  if (!(await serverAnswers())) {
    console.error(`Accessibility QA: no server answers at ${BASE}. Start one with npm run dev or npm run preview, or set BASE.`);
    process.exit(1);
  }
  console.log(`Accessibility QA: ${routes.length} ${routes.length === 1 ? 'route' : 'routes'} from ${source}, widths ${WIDTHS.join(' and ')} px, both themes, against ${BASE}`);
  console.log(`Rule sets: ${TAGS.join(', ')}\n`);

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
        reducedMotion: 'reduce',
      });
      for (const route of routes) results.push(await audit(context, route, width, theme));
      await withDeadline(context.close(), 15000, 'context').catch(() => {});
    }
  });
  await Promise.all(workers);
  await withDeadline(browser.close(), 15000, 'browser').catch(() => {});

  // One row per route, one cell per view: count of failing rules, then count of warnings.
  const routeWidth = Math.max(5, ...routes.map((r) => r.length)) + 2;
  const cellOf = (r) => {
    if (r.problem) return 'problem';
    const failing = r.violations.filter((v) => FAILING.has(v.impact)).length;
    const warned = r.violations.length - failing;
    return failing || warned ? `${failing} fail ${warned} warn` : 'ok';
  };
  console.log(`${'Route'.padEnd(routeWidth)}${views.map((v) => `${v.width} ${v.theme}`.padEnd(16)).join('')}`);
  for (const route of routes) {
    const cells = views.map((view) => {
      const found = results.find((r) => r.route === route && r.width === view.width && r.theme === view.theme);
      return (found ? cellOf(found) : 'none').padEnd(16);
    });
    console.log(`${route.padEnd(routeWidth)}${cells.join('')}`);
  }
  console.log('');

  // Detail, ordered by route.
  const order = (r) => routes.indexOf(r.route) * 100 + views.findIndex((v) => v.width === r.width && v.theme === r.theme);
  const withFindings = results.filter((r) => r.problem || r.violations.length).sort((a, b) => order(a) - order(b));
  for (const r of withFindings) {
    console.log(`${r.route}  ${r.width} px  ${r.theme}`);
    if (r.problem) console.log(`  ${r.problem}`);
    for (const v of r.violations) {
      console.log(`  ${FAILING.has(v.impact) ? 'fail' : 'warn'}  ${v.id}  ${v.impact}  ${v.count} ${v.count === 1 ? 'node' : 'nodes'}  ${v.help}`);
      for (const target of v.targets) console.log(`        ${target}`);
    }
  }
  if (withFindings.length) console.log('');

  // Totals by rule, so one shared component shows up as one line.
  const byRule = new Map();
  for (const r of results) {
    for (const v of r.violations) {
      const entry = byRule.get(v.id) || { impact: v.impact, nodes: 0, views: 0 };
      entry.nodes += v.count;
      entry.views += 1;
      byRule.set(v.id, entry);
    }
  }
  if (byRule.size) {
    console.log('By rule');
    console.log(`  ${'Rule'.padEnd(34)}${'Impact'.padEnd(12)}${'Views'.padEnd(8)}Nodes`);
    for (const [id, entry] of [...byRule].sort((a, b) => b[1].nodes - a[1].nodes)) {
      console.log(`  ${id.padEnd(34)}${entry.impact.padEnd(12)}${String(entry.views).padEnd(8)}${entry.nodes}`);
    }
    console.log('');
  }

  const incomplete = results.reduce((sum, r) => sum + r.incomplete, 0);
  console.log(`Nodes axe could not judge (check by eye, mostly text over footage or glass): ${incomplete}`);

  const failures = results.filter((r) => r.problem || r.violations.some((v) => FAILING.has(v.impact)));
  if (failures.length) {
    console.log(`Accessibility QA failed: ${failures.length} of ${results.length} views carry a serious or critical violation, or did not load.`);
    process.exit(1);
  }
  console.log(`Accessibility QA passed: ${results.length} views, no serious or critical violation.`);
  process.exit(0);
}

main();
