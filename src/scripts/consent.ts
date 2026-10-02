// Consent: the banner, the preferences dialog and the stored choice. The exports are the contract.
// Nothing here loads a tracker. analytics.ts, utm.ts and ab.ts read the choice and listen for changes.
import { openDialog, closeDialog } from './dialog';

export interface Consent {
  analytics: boolean;
  insights: boolean;
}

interface StoredConsent extends Consent {
  v: number;
  ts: number;
}

const KEY = 'viaclin-consent';
const VERSION = 1;
const DAY = 24 * 60 * 60 * 1000;
/** Six months. After this the visitor is asked again. */
const MAX_AGE = 182 * DAY;

let current: Consent = { analytics: false, insights: false };
const listeners = new Set<(consent: Consent) => void>();

function storageWorks(): boolean {
  try {
    const probe = 'viaclin-probe';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/** The stored choice, or null when there is none, it is too old or the version has moved on. */
function readStored(): Consent | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  let data: Partial<StoredConsent> | null = null;
  try {
    data = JSON.parse(raw) as Partial<StoredConsent>;
  } catch {
    data = null;
  }

  const age = data && typeof data.ts === 'number' ? Date.now() - data.ts : Number.NaN;
  const valid =
    data !== null &&
    data.v === VERSION &&
    typeof data.analytics === 'boolean' &&
    typeof data.insights === 'boolean' &&
    age >= -DAY &&
    age < MAX_AGE;

  if (!valid || !data) {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // Storage can be blocked; the choice then lasts for this page view.
    }
    return null;
  }
  return { analytics: data.analytics === true, insights: data.insights === true };
}

function store(consent: Consent): void {
  const record: StoredConsent = { v: VERSION, analytics: consent.analytics, insights: consent.insights, ts: Date.now() };
  try {
    localStorage.setItem(KEY, JSON.stringify(record));
  } catch {
    // Storage can be blocked; the choice then lasts for this page view.
  }
}

export function getConsent(): Consent {
  return { ...current };
}

/** Runs the callback each time the visitor saves a choice. Read getConsent() for the state at start-up. */
export function onConsent(callback: (consent: Consent) => void): void {
  listeners.add(callback);
}

function announce(message: string): void {
  const live = document.getElementById('live-region');
  if (live) live.textContent = message;
}

export function initConsent(): void {
  const root = document.documentElement;
  const banner = document.getElementById('consent-banner');
  const dialog = document.getElementById('consent-dialog') as HTMLDialogElement | null;
  const analyticsSwitch = document.getElementById('consent-analytics') as HTMLInputElement | null;
  const insightsSwitch = document.getElementById('consent-insights') as HTMLInputElement | null;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const still = () => reduce.matches || root.classList.contains('static');

  const stored = readStored();
  if (stored) current = stored;

  let bannerOpen = false;
  let sizeWatch: ResizeObserver | null = null;

  const measure = () => {
    if (banner && bannerOpen) root.style.setProperty('--consent-h', `${Math.ceil(banner.getBoundingClientRect().height)}px`);
  };

  const layoutChanged = () => document.dispatchEvent(new CustomEvent('viaclin:layout'));

  const focusMain = () => document.getElementById('main')?.focus({ preventScroll: true });

  // The preferences dialog returns focus to its opener when its close event fires, a moment after the choice
  // is saved. When the opener is the banner's "Choose" button, the banner has begun to leave by then, so focus
  // that lands in a leaving banner goes on to the main element.
  banner?.addEventListener('focusin', () => {
    if (!bannerOpen) focusMain();
  });

  const showBanner = () => {
    if (!banner || bannerOpen) return;
    bannerOpen = true;
    // The banner is fixed, so its place in the markup has no visual effect. Moving it behind the
    // skip link puts the three buttons at the start of the tab order, not after the footer.
    const skip = document.querySelector('.skip-link');
    if (skip && skip.nextElementSibling !== banner) skip.after(banner);
    banner.hidden = false;
    root.classList.add('consent-open');
    measure();
    if ('ResizeObserver' in window) {
      sizeWatch = new ResizeObserver(measure);
      sizeWatch.observe(banner);
    }
    // Reading the height forces a style pass, so the slide starts from the off-screen position.
    void banner.offsetHeight;
    banner.classList.remove('is-out');
    layoutChanged();
  };

  const hideBanner = () => {
    if (!banner || !bannerOpen) return;
    bannerOpen = false;
    sizeWatch?.disconnect();
    sizeWatch = null;
    root.classList.remove('consent-open');
    root.style.removeProperty('--consent-h');
    layoutChanged();

    const finish = () => {
      if (!bannerOpen) banner.hidden = true;
    };
    // The button that was pressed is about to leave. Hand focus to the main element so it does not fall back to <body>.
    if (banner.contains(document.activeElement)) focusMain();
    banner.classList.add('is-out');
    if (still()) {
      finish();
      return;
    }
    // Matches the slide in ConsentBanner.astro (--dur-3, 700ms) with a small margin.
    window.setTimeout(finish, 740);
  };

  const choose = (consent: Consent) => {
    current = { ...consent };
    store(current);
    // Close the dialog first: focus returns to the button that opened it, then the banner leaves.
    if (dialog?.open) closeDialog(dialog);
    hideBanner();
    announce('Your cookie choice is saved.');
    listeners.forEach((listener) => {
      try {
        listener(getConsent());
      } catch (error) {
        console.error('[viaclin] a consent listener failed', error);
      }
    });
  };

  const openPreferences = (opener: HTMLElement) => {
    if (!dialog || typeof dialog.showModal !== 'function') return;
    if (analyticsSwitch) analyticsSwitch.checked = current.analytics;
    if (insightsSwitch) insightsSwitch.checked = current.insights;
    openDialog(dialog, opener);
  };

  // One listener serves the banner, the dialog, the footer button and the cookies page button.
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const opener = target.closest<HTMLElement>('[data-consent-open]');
    if (opener) {
      event.preventDefault();
      openPreferences(opener);
      return;
    }
    if (target.closest('[data-consent-accept]')) {
      choose({ analytics: true, insights: true });
      return;
    }
    if (target.closest('[data-consent-reject]')) {
      choose({ analytics: false, insights: false });
      return;
    }
    if (target.closest('[data-consent-save]')) {
      choose({ analytics: analyticsSwitch?.checked === true, insights: insightsSwitch?.checked === true });
    }
  });

  // Ask on the first visit, after six months and after a version change.
  // With storage blocked the answer cannot be kept, so the banner stays away and nothing is switched on;
  // the footer button still opens the preferences for this page view.
  // The banner asks about the cookies that Google Analytics and Microsoft Clarity set, and the preferences dialog
  // names the two. ConsentBanner.astro sets data-trackers to "true"
  // when one of the two has an ID in the site config. With neither configured there is nothing to ask about,
  // so the banner stays quiet, nothing is switched on, and [data-consent-open] still opens the preferences.
  const trackers = banner?.dataset.trackers === 'true';
  if (!stored && trackers && storageWorks()) showBanner();
}
