#!/usr/bin/env node
// Link check for the built site. Reads every dist/**/*.html and proves that each internal target exists.
//
//   npm run build && npm run qa:links          internal links, fragments, mailto links
//   npm run qa:links -- --external             also send a HEAD request to every external link
//
// Rules:
//   /x resolves to dist/x, dist/x.html or dist/x/index.html; / resolves to dist/index.html
//   a redirect source in vercel.json counts as a target that exists
//   #id must match an id in the target page
//   mailto links must hold one well formed address; tel links break the house rule (no phone number)
//   absolute links to the site's own origin are treated as internal, so canonical and share image URLs are proven too
// Exit code 1 on any broken internal link. External failures are listed and never change the exit code.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORIGIN = 'https://viaclin.com';
const OWN_HOSTS = new Set(['viaclin.com', 'www.viaclin.com']);
const URL_ATTRS = new Set(['href', 'src', 'poster', 'data-src-lg', 'data-src-sm']);
const SKIP_DIRS = new Set(['pagefind', '_astro']);
const EXTERNAL_TIMEOUT_MS = 10000;
const EXTERNAL_PARALLEL = 6;

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, process.env.DIST || 'dist'); // DIST lets a scratch build be checked
const checkExternal = process.argv.includes('--external');
const toPosix = (p) => p.split('\\').join('/');

if (!existsSync(dist) || !statSync(dist).isDirectory()) {
  console.error(`Link check: ${toPosix(relative(root, dist)) || 'dist'} is missing. Run npm run build first.`);
  process.exit(1);
}

function walkHtml(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) found.push(...walkHtml(full));
    } else if (entry.name.toLowerCase().endsWith('.html')) found.push(full);
  }
  return found;
}

/** dist/services/x.html to /services/x; dist/index.html to /. */
function routeOf(file) {
  let path = `/${toPosix(relative(dist, file))}`.replace(/\.html$/i, '');
  path = path.replace(/\/index$/i, '');
  return path === '' ? '/' : path;
}

function decodeEntities(text) {
  return text
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)));
}

/** Every tag outside script and style bodies and comments, with its attributes. */
function tagsOf(html) {
  const clean = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/(<script\b[^>]*>)[\s\S]*?(<\/script>)/gi, '$1$2')
    .replace(/(<style\b[^>]*>)[\s\S]*?(<\/style>)/gi, '$1$2');
  const tags = [];
  const tagRe = /<([a-zA-Z][\w:-]*)((?:\s+(?:[^\s"'=<>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?|\/))*)\s*>/g;
  const attrRe = /([^\s"'=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let match;
  while ((match = tagRe.exec(clean))) {
    const attrs = {};
    let attr;
    attrRe.lastIndex = 0;
    while ((attr = attrRe.exec(match[2]))) {
      attrs[attr[1].toLowerCase()] = decodeEntities(attr[2] ?? attr[3] ?? attr[4] ?? '');
    }
    tags.push({ name: match[1].toLowerCase(), attrs });
  }
  return tags;
}

const pages = new Map(); // route -> { file, ids, links }
for (const file of walkHtml(dist)) {
  const tags = tagsOf(readFileSync(file, 'utf8'));
  const ids = new Set();
  const links = [];
  for (const { name, attrs } of tags) {
    if (attrs.id) ids.add(attrs.id);
    if (name === 'a' && attrs.name) ids.add(attrs.name);
    for (const [attr, value] of Object.entries(attrs)) {
      if (URL_ATTRS.has(attr)) links.push({ tag: name, attr, value });
    }
    if (attrs.srcset) {
      // As browsers read it: each URL is a run with no spaces, so a comma inside a data URL stays in the URL.
      for (const [, url] of attrs.srcset.matchAll(/(?:^|,)\s*(\S+?)(?=,*(?:\s|$))/g)) {
        links.push({ tag: name, attr: 'srcset', value: url });
      }
    }
    if (name === 'meta' && /^(og:image|og:url|twitter:image)$/i.test(attrs.property || attrs.name || '') && attrs.content) {
      links.push({ tag: 'meta', attr: attrs.property || attrs.name, value: attrs.content });
    }
  }
  pages.set(routeOf(file), { file: `dist/${toPosix(relative(dist, file))}`, ids, links });
}

const redirects = new Set();
try {
  const vercel = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));
  for (const rule of vercel.redirects || []) if (rule.source) redirects.add(rule.source.replace(/\/$/, '') || '/');
} catch {
  // No vercel.json, or one that does not parse: no redirect sources to honour.
}

/** Where a site path lands in dist. Returns { kind: 'page', route } | { kind: 'file' } | { kind: 'redirect' } | null. */
function resolveInternal(pathname) {
  let path;
  try {
    path = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const trimmed = path.length > 1 ? path.replace(/\/+$/, '') : path;
  if (trimmed === '/' || trimmed === '') return pages.has('/') ? { kind: 'page', route: '/' } : null;
  const asRoute = trimmed.replace(/\.html$/i, '').replace(/\/index$/i, '') || '/';
  if (pages.has(asRoute)) return { kind: 'page', route: asRoute };
  const onDisk = join(dist, trimmed);
  if (existsSync(onDisk) && statSync(onDisk).isFile()) return { kind: 'file' };
  if (redirects.has(trimmed)) return { kind: 'redirect' };
  return null;
}

const broken = [];
const warnings = [];
const external = new Map(); // url -> Set of routes
let checked = 0;

for (const [route, page] of pages) {
  for (const link of page.links) {
    const value = link.value.trim();
    const where = `<${link.tag} ${link.attr}>`;
    checked++;
    if (value === '') {
      broken.push({ route, where, value: '(empty)', reason: 'empty URL' });
      continue;
    }
    if (/^mailto:/i.test(value)) {
      const address = value.slice(7).split('?')[0];
      if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/.test(decodeURIComponent(address))) {
        broken.push({ route, where, value, reason: 'mailto address is not well formed' });
      }
      continue;
    }
    if (/^tel:/i.test(value)) {
      broken.push({ route, where, value, reason: 'tel link: the site carries no phone number' });
      continue;
    }
    if (/^(data|blob|about):/i.test(value)) continue;
    if (/^javascript:/i.test(value)) {
      warnings.push({ route, where, value, reason: 'javascript URL' });
      continue;
    }

    let url;
    try {
      url = new URL(value, ORIGIN + (route === '/' ? '/' : route));
    } catch {
      broken.push({ route, where, value, reason: 'URL does not parse' });
      continue;
    }
    if (!/^https?:$/.test(url.protocol)) {
      warnings.push({ route, where, value, reason: `scheme ${url.protocol} left alone` });
      continue;
    }
    if (!OWN_HOSTS.has(url.hostname)) {
      const key = url.href;
      if (!external.has(key)) external.set(key, new Set());
      external.get(key).add(route);
      continue;
    }

    const target = resolveInternal(url.pathname);
    if (!target) {
      broken.push({ route, where, value, reason: 'no such file in dist' });
      continue;
    }
    if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
      warnings.push({ route, where, value, reason: 'trailing slash: the site serves clean URLs without one' });
    }
    const fragment = url.hash ? decodeURIComponent(url.hash.slice(1)) : '';
    if (fragment && !fragment.startsWith(':~:') && target.kind === 'page') {
      if (!pages.get(target.route).ids.has(fragment)) {
        broken.push({ route, where, value, reason: `no id="${fragment}" in ${pages.get(target.route).file}` });
      }
    }
  }
}

async function head(url) {
  const attempt = async (method) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), EXTERNAL_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method,
        redirect: 'follow',
        signal: controller.signal,
        headers: { 'user-agent': 'viaclin-link-check/1.0 (+https://viaclin.com)' },
      });
      return response.status;
    } finally {
      clearTimeout(timer);
    }
  };
  try {
    let status = await attempt('HEAD');
    if (status >= 400) status = await attempt('GET'); // some servers answer HEAD with an error and GET with the page
    return { status };
  } catch (error) {
    return { error: error.name === 'AbortError' ? `no answer in ${EXTERNAL_TIMEOUT_MS / 1000} s` : error.message };
  }
}

const externalResults = [];
if (checkExternal && external.size) {
  const queue = [...external.keys()];
  const workers = Array.from({ length: Math.min(EXTERNAL_PARALLEL, queue.length) }, async () => {
    while (queue.length) {
      const url = queue.shift();
      externalResults.push({ url, ...(await head(url)) });
    }
  });
  await Promise.all(workers);
}

// Report
console.log(`Link check: ${pages.size} pages, ${checked} URLs read, ${external.size} external targets\n`);

/** One entry per target and reason, with the pages that carry it. */
function printGrouped(title, items) {
  if (!items.length) return;
  const groups = new Map();
  for (const item of items) {
    const key = `${item.value} | ${item.reason}`;
    if (!groups.has(key)) groups.set(key, { ...item, routes: new Set(), count: 0 });
    const group = groups.get(key);
    group.routes.add(item.route);
    group.count++;
  }
  console.log(title);
  for (const group of groups.values()) {
    const routes = [...group.routes];
    const shown = routes.slice(0, 4).join(', ') + (routes.length > 4 ? ` and ${routes.length - 4} more` : '');
    console.log(`  ${group.value}  ${group.where}`);
    console.log(`      ${group.reason}; ${group.count} ${group.count === 1 ? 'link' : 'links'} on ${shown}`);
  }
  console.log('');
}

printGrouped('Broken', broken);
printGrouped('Warnings', warnings);
if (external.size) {
  console.log(checkExternal ? 'External links (HEAD request sent)' : 'External links (listed; pass --external to request each one)');
  const sorted = [...external.keys()].sort();
  for (const url of sorted) {
    const result = externalResults.find((item) => item.url === url);
    let status = '';
    if (result) status = result.error ? `  problem: ${result.error}` : `  ${result.status}${result.status >= 400 ? ' problem' : ''}`;
    console.log(`  ${url}${status}   (${external.get(url).size} ${external.get(url).size === 1 ? 'page' : 'pages'})`);
  }
  console.log('');
}

const externalProblems = externalResults.filter((item) => item.error || item.status >= 400).length;
console.log('Summary');
console.log(`  ${'Broken internal links'.padEnd(28)}${broken.length}`);
console.log(`  ${'Warnings'.padEnd(28)}${warnings.length}`);
if (checkExternal) console.log(`  ${'External problems'.padEnd(28)}${externalProblems}`);
console.log('');

if (broken.length) {
  console.log('Link check failed.');
  process.exit(1);
}
console.log('Link check passed.');
