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

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
  );

  items.forEach((item) => observer.observe(item));

  // Anything still hidden after a print request is shown, so printouts are complete.
  window.addEventListener('beforeprint', () => items.forEach((item) => item.classList.add('is-in')));
}
