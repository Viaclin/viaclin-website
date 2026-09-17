// Analytics: Consent Mode defaults, consent-gated GA4 and Clarity loading. The exports are the contract.
// With no IDs configured, or with no consent, this module makes no request to any other host.
import { getConsent, onConsent, type Consent } from './consent';

type Queue = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: Queue;
    clarity?: Queue & { q?: unknown[] };
    /** Development builds read fake IDs from here so the loaders can be tested. Ignored in production. */
    __viaclinTestIds?: { ga4?: string; clarity?: string };
  }
}

const GA_COOKIES = /^(_ga|_gid|_gat|_gac_|_gcl_)/;
const CLARITY_COOKIES = /^_cl/;

let gaLoaded = false;
let gaStopped = false;
let clarityLoaded = false;
let clarityStopped = false;

function cleanId(value: unknown): string {
  const id = typeof value === 'string' ? value.trim() : '';
  return /^[A-Za-z0-9_-]{4,40}$/.test(id) ? id : '';
}

function ids(): { ga4: string; clarity: string } {
  const test = import.meta.env.DEV ? window.__viaclinTestIds : undefined;
  return {
    ga4: cleanId(test?.ga4 ?? import.meta.env.PUBLIC_GA4_ID),
    clarity: cleanId(test?.clarity ?? import.meta.env.PUBLIC_CLARITY_ID),
  };
}

// gtag.js reads the arguments object itself, so a rest array will not do here.
function gtag(..._args: unknown[]): void {
  // eslint-disable-next-line prefer-rest-params
  window.dataLayer.push(arguments);
}

/** Google Consent Mode v2: everything denied until the visitor says otherwise. Runs before any loader. */
function setConsentDefaults(): void {
  window.dataLayer = window.dataLayer || [];
  window.gtag = gtag;
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    wait_for_update: 500,
  });
}

function addScript(src: string): void {
  const script = document.createElement('script');
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

function setGaDisabled(id: string, disabled: boolean): void {
  (window as unknown as Record<string, unknown>)[`ga-disable-${id}`] = disabled;
}

function startGa(id: string): void {
  setGaDisabled(id, false);
  gaStopped = false;
  if (gaLoaded) {
    gtag('consent', 'update', { analytics_storage: 'granted' });
    return;
  }
  gaLoaded = true;
  addScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`);
  gtag('consent', 'update', { analytics_storage: 'granted' });
  gtag('js', new Date());
  gtag('config', id, { allow_google_signals: false, allow_ad_personalization_signals: false });
}

function stopGa(id: string): void {
  if (gaLoaded && !gaStopped) {
    gtag('consent', 'update', { analytics_storage: 'denied' });
    gaStopped = true;
  }
  if (id) setGaDisabled(id, true);
  clearCookies(GA_COOKIES);
}

function startClarity(id: string): void {
  if (!clarityLoaded) {
    clarityLoaded = true;
    if (!window.clarity) {
      const queue = function () {
        // eslint-disable-next-line prefer-rest-params
        (queue.q = queue.q || []).push(arguments);
      } as Queue & { q?: unknown[] };
      window.clarity = queue;
    }
    addScript(`https://www.clarity.ms/tag/${encodeURIComponent(id)}`);
  } else if (clarityStopped) {
    window.clarity?.('start');
  }
  clarityStopped = false;
  window.clarity?.('consentv2', { ad_Storage: 'denied', analytics_Storage: 'granted' });
}

function stopClarity(): void {
  if (clarityLoaded && !clarityStopped) {
    window.clarity?.('consentv2', { ad_Storage: 'denied', analytics_Storage: 'denied' });
    window.clarity?.('consent', false);
    window.clarity?.('stop');
    clarityStopped = true;
  }
  clearCookies(CLARITY_COOKIES);
}

/** Best effort: expire matching first-party cookies on this host and on each parent domain. */
function clearCookies(pattern: RegExp): void {
  const names = document.cookie
    .split(';')
    .map((pair) => pair.split('=')[0].trim())
    .filter((name) => name !== '' && pattern.test(name));
  if (!names.length) return;

  const parts = window.location.hostname.split('.');
  const domains = [''];
  for (let i = 0; i < parts.length - 1; i += 1) {
    const domain = parts.slice(i).join('.');
    domains.push(domain, `.${domain}`);
  }
  for (const name of names) {
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain ? `; domain=${domain}` : ''}`;
    }
  }
}

function apply(consent: Consent): void {
  const { ga4, clarity } = ids();
  if (consent.analytics && ga4) startGa(ga4);
  else stopGa(ga4);
  if (consent.insights && clarity) startClarity(clarity);
  else stopClarity();
}

/** Sends a GA4 event when analytics consent is granted and GA has loaded. Otherwise it does nothing. */
export function track(name: string, params: Record<string, unknown> = {}): void {
  const consent = getConsent();
  const sent = gaLoaded && !gaStopped && consent.analytics;
  if (sent) gtag('event', name, params);
  if (clarityLoaded && !clarityStopped && consent.insights) window.clarity?.('event', name);
  if (import.meta.env.DEV) console.debug(`[viaclin] track ${name}`, params, sent ? 'sent to GA4' : 'not sent');
}

/** Labels the Clarity session, for example with an experiment variant, so heatmaps can be split by it. */
export function tagSession(key: string, value: string): void {
  if (clarityLoaded && !clarityStopped && getConsent().insights) window.clarity?.('set', key, value);
}

/** data-track-place="hero" becomes { place: 'hero' }; data-track-link-text becomes link_text. */
function paramsFrom(element: HTMLElement): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(element.dataset)) {
    if (key === 'track' || !key.startsWith('track') || value === undefined) continue;
    const param = key
      .slice('track'.length)
      .replace(/[A-Z]/g, (letter, index: number) => `${index > 0 ? '_' : ''}${letter.toLowerCase()}`);
    if (param) params[param] = value;
  }
  return params;
}

export function initAnalytics(): void {
  setConsentDefaults();
  apply(getConsent());
  onConsent(apply);

  // Any element with data-track="event_name" reports a click. The capture phase sees the click
  // even when another handler stops it from bubbling.
  document.addEventListener(
    'click',
    (event) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-track]') : null;
      const name = target?.dataset.track;
      if (target && name) track(name, paramsFrom(target));
    },
    { capture: true },
  );
}
