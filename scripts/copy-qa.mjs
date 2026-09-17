#!/usr/bin/env node
// Copy QA for the Viaclin site: checks 1 to 6 from section 12 of VIACLIN_WEBSITE_SPEC.md.
//
//   node scripts/copy-qa.mjs                  check the project; exit 1 when check 1, 2, 3 or 6 fails
//   node scripts/copy-qa.mjs --file <file>    check one file
//   node scripts/copy-qa.mjs --dump <file>    print the text the word checks see for one file
//
// How it reads a file:
//   .astro       frontmatter as code (string literals and comments), markup text, copy attributes,
//                string literals inside { } expressions, comments; <style> gives up its comments,
//                <script> gives up its comments and any string that reads as a sentence
//   .ts .js      string literals and comments (import paths, URLs, path data and hex values left out)
//   .css         comments
//   .md          prose, with code fences, inline code and link targets left out
//   .json        string values
//   .html        markup text, copy attributes, comments (public/, brand downloads included)
//   .txt         every line
// Check 1 (dashes) reads the raw file, so nothing hides from it.

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------------------------
// Word lists. To extend a list, add a lower-case entry with a comment that names the page or
// file where the word arose. Nothing else in this script needs to change.
// ---------------------------------------------------------------------------------------------

// Check 2. Words that end in "ly" and are allowed.
const ADVERB_EXEMPT = [
  // from the specification
  'supply', 'apply', 'family', 'assembly', 'anomaly', 'reply', 'july',
  'daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'italy',
  // verbs, nouns and adjectives that are not adverbs
  'imply', 'comply', 'rely', 'fly', 'ally', 'multiply', 'belly', 'bully', 'rally', 'tally',
  'jelly', 'holly', 'folly', 'lily', 'ugly',
  // forms of the exempt words above
  'resupply', 'oversupply', 'undersupply', 'reapply', 'misapply', 'subassembly',
];

// Check 2. Words the owner has ruled out by name. The script warns when one turns up in a list above.
const NEVER_EXEMPT = ['early', 'only'];

// Check 2. Proper nouns that end in "ly", such as a surname inside a company name.
// Name the page or data file beside each entry.
const PROPER_NOUNS = [];

// Check 2. Code terms tolerated inside comments and string literals. Never tolerated in page copy.
const TOLERATED_IN_CODE = [
  'sr-only', 'readonly', 'aria-readonly', 'only screen', 'only-child', 'only-of-type',
  'font-family', 'webassembly', 'currentcolor',
];

// Check 3. Jargon and filler, matched as substrings without regard to case.
const JARGON = [
  'leverage', 'navigat', 'unpack', 'landscape', 'deep dive', 'moving forward', 'lean into',
  'game-chang', 'game chang', 'double down', 'circle back', 'on the same page', 'take a step back',
  'seamless', 'cutting-edge', 'cutting edge', 'best-in-class', 'world-class', 'holistic', 'synerg',
  'robust', 'innovative', 'empower', 'journey', 'utilis', 'utiliz', 'unprecedented',
  "here's the", "it's worth noting", 'at the end of the day', 'when it comes to', "in today's",
  'the reality is', 'at its core', 'let that sink in', 'make no mistake', 'let me be clear',
  'the truth is',
  // house rule 3, last item: the plural noun that agencies use for services
  'solutions',
];

// Check 3. Phrases that contain a jargon stem and are allowed. They are blanked before the check runs.
//   'navigator' is the browser API name and turns up in comments about the clipboard and the network.
const JARGON_ALLOW = ['navigator'];

// Check 4. American spellings. Warnings, never failures.
const AMERICAN = [
  { re: /optimiz/gi }, { re: /organiz/gi }, { re: /serializ/gi }, { re: /randomiz/gi },
  { re: /labeling/gi }, { re: /modeling/gi }, { re: /analyz/gi }, { re: /prioritiz/gi },
  { re: /customiz/gi }, { re: /standardiz/gi }, { re: /minimiz/gi }, { re: /maximiz/gi },
  { re: /recogniz/gi }, { re: /color/gi }, { re: /center/gi }, { re: /favor/gi },
  { re: /behavior/gi }, { re: /catalog(?=\s)/gi }, { re: /fulfill(?!ed|ing)/gi },
  { re: /\blicenses?\b/gi, note: 'review: the noun is "licence", the verb is "license"' },
  { re: /\bprograms?\b/gi, note: 'review: "programme" in the business sense' },
];

// Check 6. Personal references, as listed in the specification.
const FOUNDER = [/\bsteve\b/gi, /\bquinn\b/gi, /founder/gi, /\b14 years\b/gi];
const LINKEDIN_PROFILE = /linkedin profile/gi;
const LINKEDIN_PROFILE_ALLOWED_IN = ['src/components/Footer.astro'];

// Check 7 (warning). Middle-dot separators and arrows, from house rule 10.
const SEPARATORS = /[\u00B7\u2022\u2190-\u21FF\u27F5-\u27FF\u2794\u279C\u27A1]/g;

// Attributes whose quoted value is copy. Component props that carry copy belong here too.
const COPY_ATTRS = new Set([
  'alt', 'title', 'aria-label', 'aria-description', 'aria-roledescription', 'aria-valuetext',
  'aria-placeholder', 'content', 'placeholder', 'label', 'value',
  'description', 'lead', 'eyebrow', 'intro', 'line', 'heading', 'subheading', 'text', 'caption',
  'summary', 'linklabel', 'note', 'hint', 'legend', 'message', 'kicker', 'strapline',
]);

// Attributes whose { } value is code, so the string literals inside are left alone.
const CODE_ATTRS = new Set([
  'class', 'class:list', 'style', 'href', 'src', 'srcset', 'id', 'for', 'name', 'type', 'rel',
  'target', 'role', 'd', 'viewbox', 'points', 'transform', 'key', 'slot', 'set:html', 'set:text',
  'define:vars', 'width', 'height', 'path', 'video', 'tone', 'variant',
]);

// Where to look. "copy" files get every check. "code" files get the dash check on the raw file
// and the word checks on comments (plus sentence strings where `strings` says so).
const TARGETS = [
  { mode: 'copy', dirs: ['src/pages', 'src/components', 'src/layouts', 'src/data'] },
  { mode: 'copy', dirs: ['public'], only: /\.(txt|html|webmanifest)$/i, files: ['README.md', '.env.example'] },
  { mode: 'code', strings: 'sentences', dirs: ['src/scripts', 'src/styles'] },
  { mode: 'code', strings: 'none', dirs: ['scripts'], files: ['astro.config.mjs'] },
];
const EXTENSIONS = new Set([
  '.astro', '.md', '.mdx', '.ts', '.tsx', '.js', '.mjs', '.cjs', '.html', '.css', '.json',
  '.txt', '.webmanifest', '.example',
]);

// ---------------------------------------------------------------------------------------------
// Masking: build a copy of the file, same length, where everything that is not copy is a space.
// Line numbers survive, and the word checks never see identifiers, class names or URLs.
// ---------------------------------------------------------------------------------------------

const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source',
  'track', 'wbr',
]);
const REGEX_AFTER = new Set(['', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^']);
const REGEX_AFTER_WORD = new Set(['return', 'typeof', 'case', 'in', 'of', 'delete', 'void', 'throw', 'new', 'do', 'else']);
const JSX_AFTER = new Set(['', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '>']);

function createContext(raw, expressions = true) {
  const out = new Array(raw.length);
  for (let k = 0; k < raw.length; k++) out[k] = raw[k] === '\n' || raw[k] === '\r' ? raw[k] : ' ';
  return { raw, out, regions: [], expressions };
}

function keep(ctx, start, end, kind) {
  if (end <= start) return;
  for (let k = start; k < end; k++) ctx.out[k] = ctx.raw[k];
  ctx.regions.push({ start, end, kind });
}

/** True when a string literal should be read as copy. */
function wantLiteral(text, strings, before = '') {
  if (strings === 'none') return false;
  const t = text.trim();
  if (!t) return false;
  if (/(?:\bfrom|\bimport|\brequire\s*\(|\bimport\s*\()\s*$/.test(before)) return false; // module paths
  if (/^(?:https?:|mailto:|tel:|data:|blob:|\/\S|\.{1,2}\/|\?|www\.)/i.test(t)) return false; // URLs and paths
  if (/^#\S*$/.test(t)) return false; // fragments and hex colours
  if (/^[Mm][\s\d,.+\-eEMmLlHhVvCcSsQqTtAaZz]+$/.test(t)) return false; // SVG path data
  if (/var\(--/.test(t) || /^(?:\s*-{0,2}[a-z][a-z-]*\s*:\s*[^;:]+;)+(?:\s*-{0,2}[a-z][a-z-]*\s*:\s*[^;:]+)?\s*$/i.test(t)) return false; // inline CSS
  if (!/\s/.test(t) && /[/\\_]|\.\w/.test(t)) return false; // file names, tokens, identifiers
  if (strings === 'sentences') return sentenceLike(t);
  return true;
}

/** A string in client code that a visitor could read: a label, a status line, an error message. */
function sentenceLike(t) {
  if (!/\s/.test(t)) return /^[A-Z][a-z]+[.!?]?$/.test(t);
  if (/[{}<>=;[\]\\]|\((?:min|max|prefers|hover|pointer|orientation)/.test(t)) return false;
  if (/^[A-Z]/.test(t)) return true;
  return (t.match(/\b[A-Za-z']{2,}\b/g) || []).length >= 3;
}

function stringEnd(raw, i, end) {
  const quote = raw[i];
  let j = i + 1;
  while (j < end) {
    if (raw[j] === '\\') { j += 2; continue; }
    if (raw[j] === quote || raw[j] === '\n') return j;
    j++;
  }
  return end;
}

function regexEnd(raw, i, end) {
  let j = i + 1;
  let inClass = false;
  while (j < end) {
    const c = raw[j];
    if (c === '\n') return -1;
    if (c === '\\') { j += 2; continue; }
    if (c === '[') inClass = true;
    else if (c === ']') inClass = false;
    else if (c === '/' && !inClass) {
      j++;
      while (j < end && /[a-z]/i.test(raw[j])) j++;
      return j;
    }
    j++;
  }
  return -1;
}

function scanTemplateLiteral(ctx, i, end, opts) {
  const { raw } = ctx;
  const before = raw.slice(Math.max(0, i - 24), i);
  const segments = [];
  let j = i + 1;
  let segStart = j;
  while (j < end) {
    const c = raw[j];
    if (c === '\\') { j += 2; continue; }
    if (c === '`') break;
    if (c === '$' && raw[j + 1] === '{') {
      segments.push([segStart, j]);
      j = scanCode(ctx, j + 2, end, { ...opts, stopAtBrace: true });
      segStart = j;
      continue;
    }
    j++;
  }
  const stop = Math.min(j, end);
  segments.push([segStart, stop]);
  const text = segments.map(([s, e]) => raw.slice(s, e)).join('X');
  if (wantLiteral(text, opts.strings, before)) for (const [s, e] of segments) keep(ctx, s, e, 'string');
  return Math.min(stop + 1, end);
}

/** JavaScript or TypeScript from i to end. With stopAtBrace, returns just past the closing brace. */
function scanCode(ctx, i, end, opts) {
  const { raw } = ctx;
  let depth = 0;
  let prev = '';
  let word = '';
  let spaced = false;
  while (i < end) {
    const ch = raw[i];
    const next = raw[i + 1] || '';
    if (ch === '/' && next === '/') {
      let stop = raw.indexOf('\n', i);
      if (stop === -1 || stop > end) stop = end;
      keep(ctx, i + 2, stop, 'comment');
      i = stop;
      continue;
    }
    if (ch === '/' && next === '*') {
      let stop = raw.indexOf('*/', i + 2);
      if (stop === -1 || stop > end) stop = end;
      keep(ctx, i + 2, stop, 'comment');
      i = Math.min(stop + 2, end);
      continue;
    }
    if (ch === '"' || ch === "'") {
      const stop = stringEnd(raw, i, end);
      if (wantLiteral(raw.slice(i + 1, stop), opts.strings, raw.slice(Math.max(0, i - 24), i))) keep(ctx, i + 1, stop, 'string');
      i = Math.min(stop + 1, end);
      prev = '"'; word = ''; spaced = false;
      continue;
    }
    if (ch === '`') {
      i = scanTemplateLiteral(ctx, i, end, opts);
      prev = '"'; word = ''; spaced = false;
      continue;
    }
    if (ch === '/' && (/\w/.test(prev) ? REGEX_AFTER_WORD.has(word) : REGEX_AFTER.has(prev))) {
      const stop = regexEnd(raw, i, end);
      if (stop !== -1) {
        i = stop;
        prev = '"'; word = ''; spaced = false;
        continue;
      }
    }
    if (opts.jsx && ch === '<' && /[A-Za-z>]/.test(next) && (/\w/.test(prev) ? word === 'return' : JSX_AFTER.has(prev))) {
      i = scanMarkup(ctx, i, end, true);
      prev = '"'; word = ''; spaced = false;
      continue;
    }
    if (ch === '{') depth++;
    if (ch === '}') {
      if (opts.stopAtBrace && depth === 0) return i + 1;
      depth--;
    }
    if (/\s/.test(ch)) {
      spaced = true;
    } else {
      if (/[\w$]/.test(ch)) word = /[\w$]/.test(prev) && !spaced ? word + ch : ch;
      else word = '';
      prev = ch;
      spaced = false;
    }
    i++;
  }
  return end;
}

function scanCss(ctx, i, end) {
  const { raw } = ctx;
  while (i < end) {
    const ch = raw[i];
    if (ch === '"' || ch === "'") { i = Math.min(stringEnd(raw, i, end) + 1, end); continue; }
    if (ch === '/' && raw[i + 1] === '*') {
      let stop = raw.indexOf('*/', i + 2);
      if (stop === -1 || stop > end) stop = end;
      keep(ctx, i + 2, stop, 'comment');
      i = Math.min(stop + 2, end);
      continue;
    }
    i++;
  }
}

function isCopyAttr(name) {
  const lower = name.toLowerCase();
  return COPY_ATTRS.has(lower) || lower.startsWith('data-ab-');
}

function isCodeAttr(name) {
  const lower = name.toLowerCase();
  if (isCopyAttr(lower)) return false;
  return CODE_ATTRS.has(lower) || lower.startsWith('data-') || lower.startsWith('on') || lower.startsWith('is:')
    || lower.startsWith('client:') || lower.startsWith('transition:');
}

/** One tag starting at "<". Copy attributes are kept; expression values are scanned for strings. */
function parseTag(ctx, i, end, strings) {
  const { raw } = ctx;
  let j = i + 1;
  let closing = false;
  let selfClosing = false;
  if (raw[j] === '/') { closing = true; j++; }
  const nameStart = j;
  while (j < end && /[^\s/>]/.test(raw[j])) j++;
  const name = raw.slice(nameStart, j);
  const attrs = {};
  while (j < end) {
    while (j < end && /\s/.test(raw[j])) j++;
    if (j >= end) break;
    if (raw[j] === '>') { j++; break; }
    if (raw[j] === '/' && raw[j + 1] === '>') { selfClosing = true; j += 2; break; }
    if (raw[j] === '/') { j++; continue; }
    if (raw[j] === '{' && ctx.expressions) {
      j = scanCode(ctx, j + 1, end, { strings, jsx: true, stopAtBrace: true });
      continue;
    }
    const attrStart = j;
    while (j < end && /[^\s=/>]/.test(raw[j])) j++;
    if (j === attrStart) { j++; continue; }
    const attr = raw.slice(attrStart, j);
    while (j < end && /\s/.test(raw[j])) j++;
    if (raw[j] !== '=') { attrs[attr.toLowerCase()] = ''; continue; }
    j++;
    while (j < end && /\s/.test(raw[j])) j++;
    const q = raw[j];
    if (q === '"' || q === "'" || (q === '`' && ctx.expressions)) {
      let stop = raw.indexOf(q, j + 1);
      if (stop === -1 || stop > end) stop = end;
      const value = raw.slice(j + 1, stop);
      attrs[attr.toLowerCase()] = value;
      if (isCopyAttr(attr) && wantLiteral(value, strings === 'none' ? 'none' : 'all')) keep(ctx, j + 1, stop, `attribute ${attr}`);
      j = Math.min(stop + 1, end);
    } else if (q === '{' && ctx.expressions) {
      j = scanCode(ctx, j + 1, end, { strings: isCodeAttr(attr) ? 'none' : strings, jsx: true, stopAtBrace: true });
    } else {
      const valueStart = j;
      while (j < end && /[^\s>]/.test(raw[j])) j++;
      attrs[attr.toLowerCase()] = raw.slice(valueStart, j);
    }
  }
  return { end: j, name, closing, selfClosing, attrs };
}

/** Markup from i to end. As a JSX child (inside an expression) it returns once its root tag closes. */
function scanMarkup(ctx, i, end, jsxChild = false) {
  const { raw } = ctx;
  let depth = 0;
  let textStart = i;
  const flush = (to) => keep(ctx, textStart, to, 'text');
  while (i < end) {
    if (raw.startsWith('<!--', i)) {
      flush(i);
      let stop = raw.indexOf('-->', i + 4);
      if (stop === -1 || stop > end) stop = end;
      keep(ctx, i + 4, stop, 'comment');
      i = Math.min(stop + 3, end);
      textStart = i;
      continue;
    }
    if (raw[i] === '<' && /[A-Za-z/>!]/.test(raw[i + 1] || '')) {
      flush(i);
      const tag = parseTag(ctx, i, end, 'all');
      const lower = tag.name.toLowerCase();
      i = tag.end;
      if (!tag.closing && !tag.selfClosing && (lower === 'script' || lower === 'style')) {
        const closer = new RegExp(`</${lower}\\s*>`, 'gi');
        closer.lastIndex = i;
        const match = closer.exec(raw);
        const stop = match && match.index <= end ? match.index : end;
        if (lower === 'style') scanCss(ctx, i, stop);
        else scanCode(ctx, i, stop, { strings: /json/i.test(tag.attrs.type || '') ? 'all' : 'sentences' });
        i = match && match.index <= end ? match.index + match[0].length : end;
        textStart = i;
        continue;
      }
      if (tag.closing) depth--;
      else if (!tag.selfClosing && !VOID_TAGS.has(lower) && !lower.startsWith('!')) depth++;
      textStart = i;
      if (jsxChild && depth <= 0) return i;
      continue;
    }
    if (raw[i] === '{' && ctx.expressions) {
      flush(i);
      i = scanCode(ctx, i + 1, end, { strings: 'all', jsx: true, stopAtBrace: true });
      textStart = i;
      continue;
    }
    if (raw[i] === '}' && jsxChild) {
      flush(i);
      return i;
    }
    i++;
  }
  flush(end);
  return end;
}

function maskAstro(ctx) {
  const { raw } = ctx;
  let bodyStart = 0;
  const open = /^\uFEFF?\s*---[ \t]*\r?\n/.exec(raw);
  if (open) {
    const closer = /^---[ \t]*$/m;
    const rest = raw.slice(open[0].length);
    const close = closer.exec(rest);
    if (close) {
      const fmEnd = open[0].length + close.index;
      scanCode(ctx, open[0].length, fmEnd, { strings: 'all' });
      bodyStart = fmEnd + close[0].length;
    }
  }
  scanMarkup(ctx, bodyStart, raw.length);
}

function maskMarkdown(ctx) {
  const blank = (s) => s.replace(/[^\n\r]/g, ' ');
  let text = ctx.raw;
  text = text.replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, blank); // code fences
  text = text.replace(/`[^`\n]+`/g, blank); // inline code
  text = text.replace(/\]\([^)\s]+/g, blank); // link targets
  ctx.out = text.split('');
  ctx.regions.push({ start: 0, end: ctx.raw.length, kind: 'text' });
}

function maskJson(ctx) {
  let data;
  try {
    data = JSON.parse(ctx.raw);
  } catch {
    keep(ctx, 0, ctx.raw.length, 'text');
    return;
  }
  let cursor = 0;
  const visit = (value) => {
    if (typeof value === 'string') {
      const encoded = JSON.stringify(value);
      const at = ctx.raw.indexOf(encoded, cursor);
      if (at === -1) return;
      if (wantLiteral(value, 'all')) keep(ctx, at + 1, at + encoded.length - 1, 'string');
      cursor = at + encoded.length;
    } else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') Object.values(value).forEach(visit);
  };
  visit(data);
}

function maskFile(file, raw, target) {
  const ext = extname(file).toLowerCase();
  const strings = target.mode === 'copy' ? 'all' : target.strings || 'none';
  const ctx = createContext(raw, ext !== '.html');
  if (ext === '.astro') maskAstro(ctx);
  else if (ext === '.html') scanMarkup(ctx, 0, raw.length);
  else if (ext === '.md' || ext === '.mdx') maskMarkdown(ctx);
  else if (['.ts', '.tsx', '.js', '.mjs', '.cjs'].includes(ext)) scanCode(ctx, 0, raw.length, { strings });
  else if (ext === '.css') scanCss(ctx, 0, raw.length);
  else if (ext === '.json' || ext === '.webmanifest') maskJson(ctx);
  else keep(ctx, 0, raw.length, 'text');

  ctx.regions.sort((a, b) => a.start - b.start);
  let masked = ctx.out.join('').replace(/\u2019/g, "'");
  const blank = (s) => s.replace(/[^\n\r]/g, ' ');
  masked = masked.replace(/\b(?:https?:\/\/|mailto:|www\.)[^\s"'<>)]+/gi, blank); // URLs
  masked = masked.replace(/\b[\w-]+(?:\.[\w-]+)*\.(?:com|ie|eu|org|net|io|dev|app|uk|gov|int|ly)\b(?:\/[^\s"'<>)]*)?/gi, blank); // bare domains
  masked = masked.replace(/#[0-9a-fA-F]{3,8}\b/g, blank); // hex values
  if (TOLERATED_IN_CODE.length) {
    const tolerated = new RegExp(TOLERATED_IN_CODE.map(escapeRegex).join('|'), 'gi');
    for (const region of ctx.regions) {
      if (region.kind !== 'string' && region.kind !== 'comment') continue;
      const part = masked.slice(region.start, region.end).replace(tolerated, blank);
      masked = masked.slice(0, region.start) + part + masked.slice(region.end);
    }
  }
  return { masked, regions: ctx.regions };
}

// ---------------------------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------------------------

const CHECKS = {
  1: { label: 'Dashes (U+2014, U+2013)', fails: true },
  2: { label: 'Adverbs ending in "ly"', fails: true },
  3: { label: 'Jargon and filler', fails: true },
  4: { label: 'American spellings', fails: false },
  5: { label: 'Placeholders in square brackets', fails: false, info: true },
  6: { label: 'Founder rule', fails: true },
  7: { label: 'Middle dots and arrows', fails: false },
};

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function lineStartsOf(raw) {
  const starts = [0];
  for (let k = 0; k < raw.length; k++) if (raw[k] === '\n') starts.push(k + 1);
  return starts;
}

function locate(starts, index) {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= index) lo = mid;
    else hi = mid - 1;
  }
  return { line: lo + 1, col: index - starts[lo] + 1 };
}

function kindAt(regions, index) {
  for (const region of regions) {
    if (index >= region.start && index < region.end) return region.kind;
    if (region.start > index) break;
  }
  return 'raw';
}

function wordAround(text, index, length) {
  let s = index;
  let e = index + length;
  while (s > 0 && /[A-Za-z'-]/.test(text[s - 1])) s--;
  while (e < text.length && /[A-Za-z'-]/.test(text[e])) e++;
  return text.slice(s, e);
}

const exempt = new Set([...ADVERB_EXEMPT, ...PROPER_NOUNS].map((w) => w.toLowerCase()));
for (const word of NEVER_EXEMPT) {
  if (exempt.delete(word)) console.warn(`Copy QA: "${word}" sits in an exemption list and is ruled out by name. It stays an offence.`);
}

function isExemptAdverb(word) {
  const lower = word.toLowerCase().replace(/^['-]+|['-]+$/g, '');
  if (exempt.has(lower)) return true;
  const last = lower.split('-').pop();
  return lower.includes('-') && exempt.has(last);
}

function checkFile(file, raw, target) {
  const hits = [];
  const starts = lineStartsOf(raw);
  const { masked, regions } = maskFile(file, raw, target);
  const add = (check, index, offence, kind, note) => {
    const { line, col } = locate(starts, index);
    hits.push({ file, line, col, check, offence, kind, note });
  };
  const each = (re, text, fn) => {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      fn(m);
      if (m[0].length === 0) re.lastIndex++;
    }
  };

  // 1. Dashes, on the raw file.
  each(/[\u2013\u2014]/g, raw, (m) => add(1, m.index, m[0] === '\u2014' ? 'em dash U+2014' : 'en dash U+2013', kindAt(regions, m.index)));

  // 2. Adverbs.
  each(/\b[A-Za-z][A-Za-z'-]*ly\b/gi, masked, (m) => {
    if (!isExemptAdverb(m[0])) add(2, m.index, m[0], kindAt(regions, m.index));
  });

  // 3. Jargon and filler. Spaces in a phrase match any run of white space, so a line break cannot hide one.
  let jargonText = masked;
  for (const phrase of JARGON_ALLOW) {
    jargonText = jargonText.replace(new RegExp(escapeRegex(phrase), 'gi'), (s) => ' '.repeat(s.length));
  }
  for (const term of JARGON) {
    const re = new RegExp(escapeRegex(term).replace(/ /g, '\\s+'), 'gi');
    each(re, jargonText, (m) => {
      const whole = wordAround(jargonText, m.index, m[0].length).replace(/\s+/g, ' ');
      add(3, m.index, whole.toLowerCase() === term ? term : `${term} (in "${whole}")`, kindAt(regions, m.index));
    });
  }

  // 4. American spellings.
  for (const { re, note } of AMERICAN) {
    each(re, masked, (m) => add(4, m.index, wordAround(masked, m.index, m[0].length), kindAt(regions, m.index), note));
  }

  // 5. Placeholders, on the raw file of copy targets. Information, not failure.
  if (target.mode === 'copy') {
    each(/(?<![\w.\])])\[[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*\]/g, raw, (m) => {
      if (m[0].length >= 5) add(5, m.index, m[0], kindAt(regions, m.index));
    });
  }

  // 6. Personal references. Copy targets are read raw (URLs and attributes included); code targets through the mask.
  const founderText = target.mode === 'copy' ? raw : masked;
  for (const re of FOUNDER) each(re, founderText, (m) => add(6, m.index, m[0], kindAt(regions, m.index)));
  if (!LINKEDIN_PROFILE_ALLOWED_IN.includes(file)) {
    each(LINKEDIN_PROFILE, founderText, (m) => add(6, m.index, m[0], kindAt(regions, m.index), 'allowed in the footer link alone'));
  }

  // 7. Middle dots and arrows in copy.
  each(SEPARATORS, masked, (m) => {
    const kind = kindAt(regions, m.index);
    if (kind !== 'comment') add(7, m.index, `U+${m[0].codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`, kind);
  });

  return { hits, masked };
}

// ---------------------------------------------------------------------------------------------
// Walk, report, exit
// ---------------------------------------------------------------------------------------------

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const toPosix = (p) => p.split('\\').join('/');

function walk(dir) {
  const found = [];
  if (!existsSync(dir)) return found;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.git')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walk(full));
    else if (EXTENSIONS.has(extname(entry.name).toLowerCase())) found.push(full);
  }
  return found;
}

function collect() {
  const list = [];
  const seen = new Set();
  const push = (full, target) => {
    const file = toPosix(relative(root, full));
    if (seen.has(file)) return;
    seen.add(file);
    list.push({ file, full, target });
  };
  for (const target of TARGETS) {
    for (const dir of target.dirs || []) {
      for (const full of walk(join(root, dir))) if (!target.only || target.only.test(full)) push(full, target);
    }
    for (const name of target.files || []) {
      const full = join(root, name);
      if (existsSync(full)) push(full, target);
    }
  }
  return list;
}

function snippet(raw, line) {
  const text = (raw.split(/\r?\n/)[line - 1] || '').trim().replace(/\s+/g, ' ');
  return text.length > 96 ? `${text.slice(0, 93)}...` : text;
}

function dump(path) {
  const full = resolve(process.cwd(), path);
  if (!existsSync(full)) {
    console.error(`No file at ${path}`);
    process.exit(1);
  }
  const file = toPosix(relative(root, full));
  const target = collect().find((item) => item.file === file)?.target || { mode: 'copy' };
  const { masked } = maskFile(file, readFileSync(full, 'utf8'), target);
  masked.split(/\r?\n/).forEach((text, index) => {
    if (text.trim()) console.log(`${String(index + 1).padStart(5)}  ${text.replace(/\s+/g, ' ').trim()}`);
  });
}

function main() {
  const args = process.argv.slice(2);
  const dumpAt = args.indexOf('--dump');
  if (dumpAt !== -1) {
    dump(args[dumpAt + 1] || '');
    return;
  }

  // --file <path> checks one file, in or out of the project, with the rules for page copy
  // unless the file belongs to a code target.
  let files = collect();
  const fileAt = args.indexOf('--file');
  if (fileAt !== -1) {
    const full = resolve(process.cwd(), args[fileAt + 1] || '');
    if (!existsSync(full) || !statSync(full).isFile()) {
      console.error(`No file at ${args[fileAt + 1] || '(no path given)'}`);
      process.exit(1);
    }
    const file = toPosix(relative(root, full));
    files = [files.find((item) => item.file === file) || { file, full, target: { mode: 'copy' } }];
  }

  const all = [];
  for (const { file, full, target } of files) {
    const raw = readFileSync(full, 'utf8');
    const { hits } = checkFile(file, raw, target);
    for (const hit of hits) hit.snippet = snippet(raw, hit.line);
    all.push(...hits);
  }

  console.log(`Copy QA: ${files.length} ${files.length === 1 ? 'file' : 'files'} read\n`);

  const byFile = new Map();
  for (const hit of all) {
    if (!byFile.has(hit.file)) byFile.set(hit.file, []);
    byFile.get(hit.file).push(hit);
  }
  for (const [file, hits] of byFile) {
    console.log(file);
    hits.sort((a, b) => a.line - b.line || a.col - b.col);
    for (const hit of hits) {
      const level = CHECKS[hit.check].fails ? 'fail' : CHECKS[hit.check].info ? 'info' : 'warn';
      const note = hit.note ? ` [${hit.note}]` : '';
      console.log(`  ${String(hit.line).padStart(4)}:${String(hit.col).padEnd(4)} ${level}  check ${hit.check}  ${hit.offence}  (${hit.kind})${note}`);
      console.log(`            ${hit.snippet}`);
    }
    console.log('');
  }

  console.log('Summary');
  console.log(`  ${'Check'.padEnd(38)}${'Result'.padEnd(10)}Hits`);
  let failed = false;
  for (const [id, check] of Object.entries(CHECKS)) {
    const count = all.filter((hit) => hit.check === Number(id)).length;
    let result = 'pass';
    if (count && check.fails) { result = 'fail'; failed = true; }
    else if (count) result = check.info ? 'info' : 'warn';
    console.log(`  ${`${id}. ${check.label}`.padEnd(38)}${result.padEnd(10)}${count}`);
  }
  console.log('');
  if (failed) {
    console.log('Copy QA failed. Fix every line marked "fail" above, then run npm run qa once more.');
    process.exit(1);
  }
  console.log('Copy QA passed.');
}

main();
