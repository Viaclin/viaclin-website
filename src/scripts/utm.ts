// Campaign capture. The exports are the contract.
// Campaign tags from the address bar are read into memory on every page. They are kept for the browser
// session (sessionStorage) once analytics consent exists, and the first touch in a session wins.
// landing_page means the first page of the visit. With analytics consent the first value kept in the
// session stands for the rest of the visit. Without consent nothing can be kept between pages, so the
// page in view is often not the first one: landing_page is then left out, not sent with a value that misleads.
// contact.ts copies getUtm() into the hidden fields of the enquiry form.
import { getConsent, onConsent, type Consent } from './consent';

const KEY = 'viaclin-utm';
const PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'msclkid'] as const;
const FIELDS: string[] = [...PARAMS, 'landing_page'];
const MAX_LENGTH = 200;

let fromUrl: Record<string, string> = {};
let landing = '/';
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

/** The same order every time: the tags, then landing_page. The email fallback in contact.ts lists them as found. */
function inOrder(found: Record<string, string>): Record<string, string> {
  const kept: Record<string, string> = {};
  for (const name of FIELDS) {
    if (found[name]) kept[name] = found[name];
  }
  return kept;
}

function sync(consent: Consent): void {
  try {
    if (consent.analytics) {
      // First touch wins: a value kept from an earlier page in this session is never replaced.
      // That holds for landing_page too, so it stays the first page the session recorded.
      values = inOrder({ ...fromUrl, landing_page: landing, ...readSession() });
      sessionStorage.setItem(KEY, JSON.stringify(values));
    } else {
      // No consent, no memory of earlier pages: the tags from this address go to the form, landing_page does not.
      values = { ...fromUrl };
      sessionStorage.removeItem(KEY);
    }
  } catch {
    // Storage can be blocked; the tags from this page still reach the form. The first page cannot be known.
    values = { ...fromUrl };
  }
}

export function getUtm(): Record<string, string> {
  return { ...values };
}

export function initUtm(): void {
  fromUrl = readUrl();
  landing = tidy(window.location.pathname) || '/';
  values = { ...fromUrl };
  sync(getConsent());
  onConsent(sync);
}
