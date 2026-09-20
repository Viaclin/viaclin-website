// Descriptor docking, kept from the previous site: "Life science consultancy" starts in the hero
// and glides to a slot beside the header logo as the page scrolls. A fixed clone does the travelling.
export function initDock(): void {
  const hero = document.getElementById('hero-descriptor');
  const slot = document.getElementById('dock-slot');
  const fly = document.getElementById('dock-fly');
  if (!hero || !slot || !fly || document.body.dataset.docks !== 'true') return;

  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let start: { x: number; docY: number } | null = null;
  // The slot sits in a fixed header, so its box holds still between layout changes.
  let end: { x: number; y: number; distance: number } | null = null;
  // True while the frame last written was the resting docked state.
  let docked = false;
  let ticking = false;

  root.classList.add('dock-home');

  const smooth = (v: number) => v * v * (3 - 2 * v); // smoothstep: eases the glide at both ends

  const update = () => {
    ticking = false;
    // At rest in the slot, with that state already written: no read and no write left to make.
    if (docked && end && window.scrollY >= end.distance) return;

    const active = !reduce.matches && !root.classList.contains('static') && slot.offsetParent !== null;
    root.classList.toggle('dock-active', active);
    if (!active) {
      docked = false;
      slot.style.removeProperty('--dock-p');
      // Motion is off: no glide. The slot fills once the hero line has passed under the header.
      root.classList.toggle('dock-docked', hero.getBoundingClientRect().bottom < slot.getBoundingClientRect().bottom);
      return;
    }

    if (!start) {
      // Measure with the hero copy in its resting place, not mid-reveal.
      const rect = hero.getBoundingClientRect();
      const lift = hero.classList.contains('is-in') ? 0 : parseFloat(getComputedStyle(hero).transform.split(',')[5] ?? '0') || 0;
      start = { x: rect.left, docY: rect.top - lift + window.scrollY };
    }
    if (!end) {
      const box = slot.getBoundingClientRect();
      const y = box.top + (box.height - fly.offsetHeight) / 2;
      end = {
        x: box.left + parseFloat(getComputedStyle(slot).paddingLeft),
        y,
        distance: Math.max(60, start.docY - y),
      };
    }

    const t = Math.min(1, Math.max(0, window.scrollY / end.distance));
    const p = smooth(t);
    // Sideways travel finishes ahead of the drop, so the line clears the logo before it sinks
    // into the header band instead of crossing the mark on the way.
    const across = smooth(Math.min(1, t * 1.4));
    const naturalY = start.docY - window.scrollY;
    const x = start.x + (end.x - start.x) * across;
    const y = naturalY + (end.y - naturalY) * p;
    fly.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    // The slot's divider fades in with the same progress the drop uses.
    slot.style.setProperty('--dock-p', p.toFixed(3));
    docked = p === 1;
  };

  const request = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  };
  const remeasure = () => {
    start = null;
    end = null;
    docked = false;
    request();
  };

  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', remeasure, { passive: true });
  reduce.addEventListener('change', remeasure);
  document.fonts?.ready.then(remeasure);
  hero.addEventListener('transitionend', remeasure);
  update();
}
