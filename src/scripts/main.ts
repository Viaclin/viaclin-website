// Entry point: every client behaviour starts here, in dependency order.
import { initTheme } from './theme';
import { initNav } from './nav';
import { initReveal } from './reveal';
import { initDock } from './dock';
import { initSphere } from './sphere';
import { initVideos } from './video';
import { initContact } from './contact';
import { initCopy } from './copy';
import { initConsent } from './consent';
import { initAnalytics } from './analytics';
import { initUtm } from './utm';
import { initExperiments } from './ab';
import { initSearch } from './search';
import { initArcs } from './arcs';
import { initRotor } from './rotor';

const steps: Array<[string, () => void]> = [
  ['theme', initTheme],
  ['consent', initConsent],
  ['analytics', initAnalytics],
  ['utm', initUtm],
  ['experiments', initExperiments],
  ['nav', initNav],
  ['reveal', initReveal],
  ['dock', initDock],
  ['sphere', initSphere],
  ['videos', initVideos],
  ['contact', initContact],
  ['copy', initCopy],
  ['search', initSearch],
  ['arcs', initArcs],
  ['rotor', initRotor],
];

// One failing module must never take the rest of the page down with it.
for (const [name, run] of steps) {
  try {
    run();
  } catch (error) {
    console.error(`[viaclin] ${name} failed to start`, error);
  }
}

// Tells the head failsafe in Base.astro that the bundle arrived and the reveals are in hand.
document.documentElement.classList.add('is-ready');
