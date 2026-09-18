#!/usr/bin/env node
// Launch check: what the owner still has to supply or confirm before the site goes live.
//
//   npm run launch-check                 report; exit code 0
//   npm run launch-check -- --strict     exit code 1 while any blocker is open
//
// BLOCKER  the site should not launch until this is closed
// ADVICE   the site works without it; closing it is the owner's call
// The script reads src/data/site.ts as text, .env and the process environment, public/ and, when
// a build exists, dist/. It never writes a value and never invents one.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const strict = process.argv.includes('--strict');
const at = (...parts) => join(root, ...parts);
const isFile = (...parts) => existsSync(at(...parts)) && statSync(at(...parts)).isFile();
const isDir = (...parts) => existsSync(at(...parts)) && statSync(at(...parts)).isDirectory();

const items = [];
const blocker = (title, action) => items.push({ level: 'BLOCKER', title, action });
const advice = (title, action) => items.push({ level: 'ADVICE', title, action });
const ok = (title) => items.push({ level: 'OK', title });

// --- src/data/site.ts, read as text -----------------------------------------------------------

let siteSource = '';
try {
  siteSource = readFileSync(at('src', 'data', 'site.ts'), 'utf8');
} catch {
  blocker('src/data/site.ts is missing', 'Restore the file: every company fact on the site comes from it.');
}

/** The string value of a key in site.ts, or null when the key is not there. */
function siteValue(key) {
  const match = new RegExp(`\\b${key}\\s*:\\s*(['"\`])([\\s\\S]*?)\\1`).exec(siteSource);
  return match ? match[2].trim() : null;
}

/** The string value of a key inside an object literal in site.ts, such as sisterBrand.url, or null when it is not there. */
function siteNestedValue(parent, key) {
  const block = new RegExp(`\\b${parent}\\s*:\\s*\\{([\\s\\S]*?)\\}`).exec(siteSource);
  if (!block) return null;
  const match = new RegExp(`\\b${key}\\s*:\\s*(['"\`])([\\s\\S]*?)\\1`).exec(block[1]);
  return match ? match[2].trim() : null;
}

/** The value of a true or false key in site.ts, or null when the key is not there. */
function siteFlag(key) {
  const match = new RegExp(`\\b${key}\\s*:\\s*(true|false)\\b`).exec(siteSource);
  return match ? match[1] === 'true' : null;
}

if (siteSource) {
  const cro = siteValue('croNumber');
  if (cro) ok(`Company number set: ${cro}`);
  else blocker('Company number is empty (croNumber in src/data/site.ts)', 'Irish company law expects the registered number on the website. Add the number from the CRO certificate; the footer and the legal page pick it up.');

  const office = siteValue('registeredOffice');
  if (office) ok(`Registered office set: ${office}`);
  else blocker('Registered office is empty (registeredOffice in src/data/site.ts)', 'Irish company law expects the registered office on the website. Add the address as filed with the CRO, on one line.');

  const linkedin = siteValue('linkedin');
  if (linkedin && /^https:\/\/([a-z]+\.)?linkedin\.com\/company\//i.test(linkedin)) ok(`LinkedIn company page set: ${linkedin}`);
  else if (linkedin) advice(`LinkedIn value does not look like a company page: ${linkedin}`, 'Use the full company page URL, for example https://www.linkedin.com/company/your-page. A personal profile breaks the house rules.');
  else advice('LinkedIn company page is empty (linkedin in src/data/site.ts)', 'Nothing renders while it is empty. Add the company page URL when the page exists; the footer, the contact page and the structured data pick it up.');

  const email = siteValue('email');
  if (email === 'info@viaclin.com') ok('Contact email is info@viaclin.com');
  else blocker(`Contact email is "${email ?? ''}"`, 'Set email to info@viaclin.com in src/data/site.ts.');

  const legalName = siteValue('legalName');
  if (legalName) ok(`Legal name set: ${legalName}`);
  else blocker('Legal name is empty (legalName in src/data/site.ts)', 'Add the name as registered at the CRO.');

  const updated = siteValue('legalUpdated');
  if (updated) advice(`Legal pages carry the date ${updated}`, 'Move legalUpdated in src/data/site.ts forward whenever a legal page changes.');

  const retention = siteValue('enquiryRetention');
  if (retention) ok(`Enquiry retention period set: ${retention}`);
  else blocker('The privacy notice gives no retention period for enquiries', 'Set enquiryRetention in src/data/site.ts, for example 24 months.');

  const sisterName = siteNestedValue('sisterBrand', 'name') || 'The sister brand';
  const sisterUrl = siteNestedValue('sisterBrand', 'url');
  if (sisterUrl) ok(`${sisterName} web address set: ${sisterUrl}`);
  else advice(`${sisterName} has no web address in site.ts, so nothing links to it`, 'The address on the previous site now serves a parking page. Set sisterBrand.url in src/data/site.ts once the owner confirms an address.');

  const legalDraft = siteFlag('legalDraft');
  if (legalDraft) advice('Legal pages show a draft line', 'Set legalDraft to false in src/data/site.ts once a solicitor has reviewed them.');
  else if (legalDraft === false) ok('Legal pages show no draft line (legalDraft is false)');
}

// --- environment: .env and the process environment ----------------------------------------------

const env = {};
if (isFile('.env')) {
  for (const line of readFileSync(at('.env'), 'utf8').split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (match) env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2').trim();
  }
}
const envValue = (name) => (process.env[name] || env[name] || '').trim();

if (envValue('PUBLIC_WEB3FORMS_KEY')) ok('PUBLIC_WEB3FORMS_KEY is set: the contact form delivers through Web3Forms');
else blocker('PUBLIC_WEB3FORMS_KEY is empty', 'Create an access key for info@viaclin.com at web3forms.com and add it in Vercel (Project Settings, Environment Variables) and in .env for local work. Until then the form falls back to composing an email, which works but depends on the visitor having a mail app.');

const ga4 = envValue('PUBLIC_GA4_ID');
if (ga4 && /^G-[A-Z0-9]+$/i.test(ga4)) ok(`PUBLIC_GA4_ID is set: ${ga4}`);
else if (ga4) advice(`PUBLIC_GA4_ID does not look like a measurement ID: ${ga4}`, 'A GA4 measurement ID starts with G- followed by letters and digits.');
else advice('PUBLIC_GA4_ID is empty', 'No Google Analytics until it is set. Create a GA4 property, copy the G- measurement ID and add it in Vercel. The README has the steps.');
if (ga4) advice('GA4 data retention', 'Set GA4 data retention to 14 months (Admin, Data retention) to match /privacy.');

if (envValue('PUBLIC_CLARITY_ID')) ok('PUBLIC_CLARITY_ID is set');
else advice('PUBLIC_CLARITY_ID is empty', 'No heatmaps and no A/B tests until it is set. Create a Microsoft Clarity project and add its ID in Vercel.');

if (envValue('PUBLIC_GSC_VERIFICATION')) ok('PUBLIC_GSC_VERIFICATION is set');
else advice('PUBLIC_GSC_VERIFICATION is empty', 'Add the Search Console HTML tag code in Vercel, verify the property, then submit https://viaclin.com/sitemap-index.xml.');

// --- files in public/ ---------------------------------------------------------------------------

const publicFiles = [
  ['og/viaclin-og.png', 'the share image for LinkedIn and other previews'],
  ['favicon.svg', 'the browser tab icon'],
  ['favicon-32.png', 'the fallback tab icon'],
  ['apple-touch-icon.png', 'the iOS home screen icon'],
  ['icon-192.png', 'the Android icon named in the manifest'],
  ['icon-512.png', 'the large icon named in the manifest and in the structured data'],
  ['site.webmanifest', 'the web manifest'],
  ['robots.txt', 'the crawler rules and the sitemap address'],
];
for (const [file, role] of publicFiles) {
  if (isFile('public', ...file.split('/'))) ok(`public/${file} is in place`);
  else blocker(`public/${file} is missing (${role})`, 'Run npm run brand to regenerate the brand files, or restore the file from git.');
}
if (isFile('public', 'robots.txt') && !/Sitemap:\s*https:\/\/viaclin\.com\/sitemap-index\.xml/i.test(readFileSync(at('public', 'robots.txt'), 'utf8'))) {
  blocker('public/robots.txt does not name the sitemap', 'Add the line: Sitemap: https://viaclin.com/sitemap-index.xml');
}

// --- the build, when one exists -----------------------------------------------------------------

if (isDir('dist')) {
  if (isFile('dist', 'sitemap-index.xml')) ok('dist/sitemap-index.xml is in place');
  else blocker('dist/sitemap-index.xml is missing', 'Check the sitemap integration in astro.config.mjs, then run npm run build.');

  if (isFile('dist', '404.html')) ok('dist/404.html is in place');
  else blocker('dist/404.html is missing', 'The custom 404 page did not build. Check src/pages/404.astro, then run npm run build.');

  if (isDir('dist', 'pagefind')) ok('dist/pagefind/ is in place: site search has an index');
  else blocker('dist/pagefind/ is missing', 'Site search has no index. The build script must run "pagefind --site dist" after "astro build".');

  // No square-bracket placeholder may reach a page.
  const leaks = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'pagefind' && entry.name !== '_astro') walk(full);
      } else if (entry.name.endsWith('.html')) {
        const text = readFileSync(full, 'utf8').replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<style\b[\s\S]*?<\/style>/gi, '');
        const found = text.match(/\[[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\]/g);
        if (found) leaks.push(`${full.slice(root.length + 1).split('\\').join('/')}: ${[...new Set(found)].join(', ')}`);
      }
    }
  };
  walk(at('dist'));
  if (leaks.length) blocker(`Placeholders reached the built pages: ${leaks.join('; ')}`, 'Replace each one with a value from src/data/site.ts, or render nothing while the value is empty.');
  else ok('No square-bracket placeholder in the built pages');
} else {
  advice('No build to inspect (dist/ is missing)', 'Run npm run build, then run this check once more so the sitemap, the 404 page and the search index are covered.');
}

// --- package.json -------------------------------------------------------------------------------

try {
  const pkg = JSON.parse(readFileSync(at('package.json'), 'utf8'));
  const build = pkg.scripts?.build || '';
  if (/copy-qa|npm run qa\b/.test(build)) ok('The build runs the copy QA first');
  else advice('The build does not run the copy QA', 'The design document asks for it. Set the build script to: npm run qa && astro build && pagefind --site dist');
} catch {
  advice('package.json could not be read', 'Check that the file holds valid JSON.');
}

// --- reminders that a script cannot close -------------------------------------------------------

advice('Legal pages are drafts until a solicitor has read them', 'Send /privacy, /terms, /cookies, /accessibility and /legal to a solicitor who knows Irish company law, GDPR and the ePrivacy Regulations. Update legalUpdated after any change.');
advice('Regulatory position on /legal', "Confirm the regulatory position paragraph on /legal matches the company's licences and partners.");
advice('Data processing agreement with the form provider', 'Confirm a data processing agreement with Web3Forms (or the form provider you choose) and note which transfer safeguard it relies on.');
advice('Professional indemnity insurance','Confirm that cover is in place before the site invites enquiries. A consultancy that advises on regulated supply chains should not trade without it.');
advice('Test the contact form after deploy', 'Send one enquiry from the live site and confirm that it arrives at info@viaclin.com and that /thanks renders.');

// --- report -------------------------------------------------------------------------------------

function wrap(text, indent, width = 100) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    if (line && (line + ' ' + word).length > width - indent.length) {
      lines.push(indent + line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(indent + line);
  return lines.join('\n');
}

console.log('Viaclin launch check\n');
for (const level of ['BLOCKER', 'ADVICE', 'OK']) {
  const group = items.filter((item) => item.level === level);
  if (!group.length) continue;
  console.log(`${level} (${group.length})`);
  for (const item of group) {
    console.log(`  ${level === 'OK' ? '+' : '*'} ${item.title}`);
    if (item.action) console.log(wrap(item.action, '      '));
  }
  console.log('');
}

const blockers = items.filter((item) => item.level === 'BLOCKER').length;
const advices = items.filter((item) => item.level === 'ADVICE').length;
console.log(`Summary: ${blockers} ${blockers === 1 ? 'blocker' : 'blockers'}, ${advices} advice ${advices === 1 ? 'note' : 'notes'}, ${items.length - blockers - advices} in place.`);
if (blockers && strict) {
  console.log('Strict mode: blockers are open, so the exit code is 1.');
  process.exit(1);
}
if (blockers) console.log('Blockers are open. Pass --strict to make this an error in a pipeline.');
