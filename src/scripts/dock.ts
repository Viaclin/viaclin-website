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
  let ticking = false;

  root.classList.add('dock-home');

  const update = () => {
    ticking = false;
    const active = !reduce.matches && !root.classList.contains('static') && slot.offsetParent !== null;
    root.classList.toggle('dock-active', active);
    if (!active) {
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

    const end = slot.getBoundingClientRect();
    const endX = end.left + parseFloat(getComputedStyle(slot).paddingLeft);
    const endY = end.top + (end.height - fly.offsetHeight) / 2;
    const distance = Math.max(60, start.docY - endY);
    let p = Math.min(1, Math.max(0, window.scrollY / distance));
    p = p * p * (3 - 2 * p); // smoothstep: eases the glide at both ends
    const naturalY = start.docY - window.scrollY;
    const x = start.x + (endX - start.x) * p;
    const y = naturalY + (endY - naturalY) * p;
    fly.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  };

  const request = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  };
  const remeasure = () => {
    start = null;
    request();
  };

  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', remeasure, { passive: true });
  reduce.addEventListener('change', remeasure);
  document.fonts?.ready.then(remeasure);
  hero.addEventListener('transitionend', remeasure);
  update();
}
