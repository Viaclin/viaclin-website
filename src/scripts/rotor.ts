// The statement band's turning word, ported from the previous site. A hidden probe measures the
// widest word in the heading's own type and the slot keeps that width, so the line never reflows.
// Every STEP the word lifts and fades, the next one is set below the line and eases up into place.
// The cycle runs while the line is in view, the tab is visible and the visitor has not paused it.
// Reduced motion or a static capture: the first word stays and nothing is reserved.
const STEP = 2400;

/** Longest transition on the element, in milliseconds, read from its computed style. */
function transitionMs(element: HTMLElement): number {
  const values = getComputedStyle(element).transitionDuration.split(',');
  return Math.max(0, ...values.map((value) => (parseFloat(value) || 0) * (value.trim().endsWith('ms') ? 1 : 1000)));
}

function readWords(slot: HTMLElement): string[] {
  try {
    const parsed: unknown = JSON.parse(slot.dataset.words ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((word): word is string => typeof word === 'string' && word !== '') : [];
  } catch {
    return [];
  }
}

export function initRotor(): void {
  const bands = Array.from(document.querySelectorAll<HTMLElement>('[data-rotor]'));
  if (!bands.length) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const still = () => reduce.matches || document.documentElement.classList.contains('static');

  for (const band of bands) {
    const slot = band.querySelector<HTMLElement>('[data-rotor-slot]');
    const word = band.querySelector<HTMLElement>('[data-rotor-word]');
    const text = band.querySelector<HTMLElement>('[data-rotor-text]');
    const probe = band.querySelector<HTMLElement>('[data-rotor-probe]');
    const toggle = band.querySelector<HTMLButtonElement>('[data-rotor-toggle]');
    const words = slot ? readWords(slot) : [];
    if (!slot || !word || !text || !probe || words.length < 2) {
      if (toggle) toggle.hidden = true;
      continue;
    }

    // Without an observer there is no way to rest the cycle off screen, so the first word stays.
    if (!('IntersectionObserver' in window)) {
      if (toggle) toggle.hidden = true;
      continue;
    }

    let index = 0;
    let cycle = 0;
    let swap = 0;
    let inView = false;
    let userPaused = false;

    // The width goes on in em, so it follows the heading down the --text-hero clamp between measures.
    const measure = () => {
      if (still()) {
        slot.style.removeProperty('width');
        return;
      }
      const size = parseFloat(getComputedStyle(slot).fontSize) || 16;
      let widest = 0;
      for (const entry of words) {
        probe.textContent = `${entry}.`;
        widest = Math.max(widest, probe.getBoundingClientRect().width);
      }
      probe.textContent = '';
      slot.style.width = `${(Math.ceil(widest) / size).toFixed(4)}em`;
    };

    const advance = () => {
      if (swap) return;
      word.classList.add('is-out');
      swap = window.setTimeout(() => {
        index = (index + 1) % words.length;
        text.textContent = words[index];
        word.classList.remove('is-out');
        word.classList.add('is-pre');
        // Force a reflow so the word is painted below the line before it eases up.
        void word.offsetWidth;
        word.classList.remove('is-pre');
        swap = 0;
      }, transitionMs(word));
    };

    // A change already under way finishes, so the word is never left faded out.
    const sync = () => {
      const run = inView && !userPaused && !document.hidden && !still();
      if (run && !cycle) cycle = window.setInterval(advance, STEP);
      if (!run && cycle) {
        window.clearInterval(cycle);
        cycle = 0;
      }
    };

    const reset = () => {
      window.clearTimeout(swap);
      swap = 0;
      index = 0;
      word.classList.remove('is-out', 'is-pre');
      text.textContent = words[0];
    };

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) inView = entry.isIntersecting;
      sync();
    });
    observer.observe(slot);

    // The button keeps the name it was given in the markup; aria-pressed carries the state.
    toggle?.addEventListener('click', () => {
      userPaused = !userPaused;
      toggle.setAttribute('aria-pressed', String(userPaused));
      sync();
    });

    document.addEventListener('visibilitychange', sync);

    reduce.addEventListener('change', () => {
      if (reduce.matches) reset();
      measure();
      sync();
    });

    let frame = 0;
    window.addEventListener(
      'resize',
      () => {
        window.cancelAnimationFrame(frame);
        frame = window.requestAnimationFrame(measure);
      },
      { passive: true },
    );

    measure();
    // The first measure may run in the fallback face; measure again once the web font is in.
    document.fonts?.ready.then(measure).catch(() => {});
    document.fonts?.addEventListener('loadingdone', measure);
  }
}
