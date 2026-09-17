// Campaign capture. The exports are the contract.
// Campaign tags from the address bar are read into memory on every page. They are kept for the browser
// session (sessionStorage) once analytics consent exists, and the first touch in a session wins.
// contact.ts copies getUtm() into the hidden fields of the enquiry form.
import { getConsent, onConsent, type Consent } from './consent';

const KEY = 'viaclin-utm';
const PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'msclkid'] as const;
const FIELDS: string[] = [...PARAMS, 'landing_page'];
const MAX_LENGTH = 200;

let fromUrl: Record<string, string> = {};
let values: Record<string, string> = {};

function tidy(value: string): string {
  // Drop control characters and angle brackets, then cap the length.
  let kept = '';
  for (const char of value) {
    if (char.charCodeAt(0) >= 32 && char !== '<' && char !== '>') kept += char;
  }
  return kept.trim().slice(0, MAX_LENGTH);
}

function readUrl(): Record<string, string> {
  const found: Record<string, string> = {};
  const query = new URLSearchParams(window.location.search);
  for (const name of PARAMS) {
    const value = tidy(query.get(name) ?? '');
    if (value) found[name] = value;
  }
  found.landing_page = tidy(window.location.pathname) || '/';
  return found;
}

function readSession(): Record<string, string> {
  try {
    const data: unknown = JSON.parse(sessionStorage.getItem(KEY) ?? 'null');
    if (!data || typeof data !== 'object') return {};
    const kept: Record<string, string> = {};
    for (const [name, value] of Object.entries(data as Record<string, unknown>)) {
      if (FIELDS.includes(name) && typeof value === 'string' && value) kept[name] = tidy(value);
    }
    return kept;
  } catch {
    return {};
  }
}

function sync(consent: Consent): void {
  try {
    if (consent.analytics) {
      // First touch wins: a value kept from an earlier page in this session is never replaced.
      values = { ...fromUrl, ...readSession() };
      sessionStorage.setItem(KEY, JSON.stringify(values));
    } else {
      values = { ...fromUrl };
      sessionStorage.removeItem(KEY);
    }
  } catch {
    // Storage can be blocked; the values from this page still reach the form.
    values = { ...fromUrl };
  }
}

export function getUtm(): Record<string, string> {
  return { ...values };
}

export function initUtm(): void {
  fromUrl = readUrl();
  values = { ...fromUrl };
  sync(getConsent());
  onConsent(sync);
}
