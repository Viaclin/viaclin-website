// A/B helper. The exports are the contract.
// An assignment needs insights consent. Without it every visitor sees the control and nothing is stored.
// Markup contract: an element with data-ab="hero-cta" and data-ab-operator="Talk to a senior operator"
// has its text swapped when the visitor is assigned the "operator" variant.
import { experiments, type Experiment } from '../data/experiments';
import { getConsent, onConsent } from './consent';
import { track, tagSession } from './analytics';

const KEY = 'viaclin-ab';
const CONTROL = 'control';
const MAX_AGE = 90 * 24 * 60 * 60 * 1000;

type Assignments = Record<string, string | number> & { ts: number };

/** Experiments reported in this page view, so each one fires experiment_exposure a single time. */
const exposed = new Set<string>();

function readAssignments(): Assignments {
  const raw = localStorage.getItem(KEY);
  let data: unknown = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }
  if (data && typeof data === 'object') {
    const record = data as Assignments;
    const age = typeof record.ts === 'number' ? Date.now() - record.ts : Number.NaN;
    if (age >= 0 && age < MAX_AGE) return record;
  }
  // Nothing stored, unreadable or older than 90 days: start again.
  localStorage.removeItem(KEY);
  return { ts: Date.now() };
}

function pick(experiment: Experiment): string {
  const { variants, weights } = experiment;
  const usable =
    weights !== undefined &&
    weights.length === variants.length &&
    weights.every((weight) => Number.isFinite(weight) && weight >= 0) &&
    weights.some((weight) => weight > 0);
  const shares = usable && weights ? weights : variants.map(() => 1);
  let roll = Math.random() * shares.reduce((sum, share) => sum + share, 0);
  for (let i = 0; i < variants.length; i += 1) {
    roll -= shares[i];
    if (roll < 0) return variants[i];
  }
  return variants[0];
}

export function variant(key: string): string {
  const experiment = experiments.find((item) => item.key === key);
  if (!experiment || !experiment.active || experiment.variants.length === 0) return CONTROL;
  if (!getConsent().insights) return CONTROL;

  let assigned: string;
  try {
    const assignments = readAssignments();
    const kept = assignments[key];
    if (typeof kept === 'string' && experiment.variants.includes(kept)) {
      assigned = kept;
    } else {
      assigned = pick(experiment);
      assignments[key] = assigned;
      localStorage.setItem(KEY, JSON.stringify(assignments));
    }
  } catch {
    // Storage can be blocked: an assignment that cannot be kept would flip between pages.
    return CONTROL;
  }

  if (!exposed.has(key)) {
    exposed.add(key);
    track('experiment_exposure', { experiment: key, variant: assigned });
    tagSession(`experiment_${key}`, assigned);
  }
  return assigned;
}

function swapText(experiment: Experiment): void {
  const elements = document.querySelectorAll<HTMLElement>(`[data-ab="${experiment.key}"]`);
  // A page without the element is not part of the experiment, so no variant is resolved for it.
  if (!elements.length) return;
  const assigned = variant(experiment.key);
  if (assigned === CONTROL) return;
  elements.forEach((element) => {
    const text = element.getAttribute(`data-ab-${assigned}`);
    if (text) element.textContent = text;
  });
}

export function initExperiments(): void {
  experiments.filter((experiment) => experiment.active).forEach(swapText);

  // Consent granted part way through a page view: nothing on screen changes, the next page picks a variant.
  // Consent withdrawn: the stored assignments go.
  onConsent((consent) => {
    if (consent.insights) return;
    try {
      localStorage.removeItem(KEY);
    } catch {
      // Storage can be blocked; there is nothing to remove in that case.
    }
  });
}
