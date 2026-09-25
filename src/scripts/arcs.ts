// The perspective drawing on the Supply Chain Consultancy page: three views of one supply chain.
// The buttons set data-state on the root; the arcs draw and undraw in CSS.
// With motion welcome the views also advance on their own while the drawing is in view. The advance
// pauses while a visitor hovers the copy or focuses a button, and stops for good once a visitor
// picks a view. With motion off there is no advance and no transition: the network view shows
// complete and the buttons switch views at once.

type View = 'linear' | 'network' | 'value';

const ORDER: readonly View[] = ['linear', 'network', 'value'];
const STEP_MS = 5000;

const isView = (value: string | undefined): value is View => ORDER.includes(value as View);

export function initArcs(): void {
  document.querySelectorAll<HTMLElement>('[data-arcs]').forEach(setup);
}

function setup(root: HTMLElement): void {
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('button[data-arcs-view]'));
  const live = root.querySelector<HTMLElement>('[data-arcs-live]');
  const group = root.querySelector<HTMLElement>('[role="group"]');
  const art = root.querySelector<HTMLElement>('[data-arcs-art]') ?? root;
  const hold = root.querySelector<HTMLElement>('[data-arcs-hold]') ?? root;
  if (!buttons.length || !live || !group) return;

  // The text for each view sits in the markup, so the copy lives in one place.
  const texts = new Map<View, string>();
  root.querySelectorAll<HTMLElement>('[data-arcs-text]').forEach((node) => {
    const key = node.dataset.arcsText;
    if (isView(key)) texts.set(key, (node.textContent ?? '').trim());
  });

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const still = () =>
    reduce.matches || document.documentElement.classList.contains('static') || !('IntersectionObserver' in window);

  let view: View = isView(root.dataset.state) ? root.dataset.state : 'network';
  let drawn = true;
  let chosen = false;
  let inView = false;
  let hovered = false;
  let focused = false;
  let timer = 0;

  const render = () => {
    root.dataset.state = drawn ? view : 'none';
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.arcsView === view));
    const text = texts.get(view);
    if (!text || (live.textContent ?? '').trim() === text) return;
    live.textContent = text;
    if (!still()) {
      // restart the short entrance on the new text
      live.classList.remove('is-new');
      void live.offsetWidth;
      live.classList.add('is-new');
    }
  };

  const stop = () => {
    window.clearTimeout(timer);
    timer = 0;
    root.classList.remove('is-counting');
  };

  const schedule = () => {
    stop();
    if (chosen || !inView || hovered || focused || still()) return;
    // a fresh count each time: the bar in the pressed button starts again from nothing
    void root.offsetWidth;
    root.classList.add('is-counting');
    timer = window.setTimeout(() => {
      view = ORDER[(ORDER.indexOf(view) + 1) % ORDER.length];
      render();
      schedule();
    }, STEP_MS);
  };

  const choose = (next: View) => {
    chosen = true;
    stop();
    if (live.getAttribute('aria-live') !== 'polite') {
      // The region turns polite a frame before the text changes, so the first choice is announced too.
      live.setAttribute('aria-live', 'polite');
      requestAnimationFrame(() => {
        view = next;
        render();
      });
      return;
    }
    view = next;
    render();
  };

  for (const button of buttons) {
    button.addEventListener('click', () => {
      const next = button.dataset.arcsView;
      if (isView(next)) choose(next);
    });
  }

  // Motion off: the view in the markup stays drawn, the region stays polite, nothing advances.
  if (still()) return;

  // The count and the bar share one length.
  root.style.setProperty('--arcs-step', `${STEP_MS}ms`);

  // Changes the page makes on its own are not announced; a visitor's choice is.
  live.setAttribute('aria-live', 'off');
  drawn = false;
  view = 'linear';
  render();

  hold.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'touch') return;
    hovered = true;
    schedule();
  });
  hold.addEventListener('pointerleave', () => {
    if (!hovered) return;
    hovered = false;
    schedule();
  });
  group.addEventListener('focusin', () => {
    focused = true;
    schedule();
  });
  group.addEventListener('focusout', (event) => {
    if (group.contains(event.relatedTarget as Node | null)) return;
    focused = false;
    schedule();
  });
  reduce.addEventListener('change', schedule);

  // The first view draws in as the drawing arrives; the advance and the travelling dots rest while it is out of view.
  const watch = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        inView = entry.isIntersecting;
        root.classList.toggle('is-live', inView);
        if (inView && !drawn) {
          drawn = true;
          render();
        }
        schedule();
      }
    },
    { threshold: 0.4 },
  );
  watch.observe(art);
}
