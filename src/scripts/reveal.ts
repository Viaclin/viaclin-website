// Scroll reveals. Elements with [data-reveal] gain .is-in once they enter the viewport.
export function initReveal(): void {
  const items = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
  if (!items.length) return;

  const still =
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    document.documentElement.classList.contains('static') ||
    !('IntersectionObserver' in window);

  if (still) {
    items.forEach((item) => item.classList.add('is-in'));
    // Motion is off: stop the SVG pulse and ring cycles too.
    document.querySelectorAll('animate, animateMotion').forEach((node) => node.remove());
    return;
  }

  const seen: IntersectionObserverCallback = (entries, self) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-in');
        self.unobserve(entry.target);
      }
    }
  };

  const observer = new IntersectionObserver(seen, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  // Tall drawings wait until half of the shape is in view.
  // Starting at the first edge would leave the drawing finished before the reader reaches it.
  const halfway = new IntersectionObserver(seen, { threshold: 0.5 });

  items.forEach((item) => {
    // An element taller than the viewport can never show half of itself, which would hold the
    // threshold shut for good, so anything that tall keeps the default watch.
    const wantsHalf = item.dataset.revealAt === 'half' && item.offsetHeight <= window.innerHeight * 0.9;
    (wantsHalf ? halfway : observer).observe(item);
  });

  // Anything still hidden after a print request is shown, so printouts are complete.
  window.addEventListener('beforeprint', () => items.forEach((item) => item.classList.add('is-in')));
}
