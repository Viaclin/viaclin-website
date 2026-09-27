// The perspective drawing on the Supply Chain Consultancy page: three views of one supply chain,
// driven by the page scroll. The section runs tall and its panel pins below the header (the layout
// sits in ArcDiagram.astro). As the page scrolls through, the share scrolled so far picks the view
// and sets --draw on the root, which the arcs follow in CSS with no transition, so the drawing scrubs
// back and forth with the scroll. The paragraph and the pressed button follow the view, and a button
// scrolls the page to the point where its view stands complete.
// Where the panel is too tall to pin, it scrolls with the page and the drawing follows the art across
// the viewport instead. With motion off, in a still capture or without an observer, nothing pins:
// the network view shows complete and the buttons switch views at once.

type View = 'linear' | 'network' | 'value';

const ORDER: readonly View[] = ['linear', 'network', 'value'];
// Where each view's share of the scroll begins. The last share runs to the end.
const STARTS: readonly number[] = [0, 0.34, 0.67];
// The part of each share spent drawing. For the rest the view holds complete and its dots travel.
const DRAW_SHARE = 0.7;
// A button lands a little past the point where its view completes, so rounding never leaves it short.
const LAND = 0.06;
// After a press the paragraph keeps the chosen view until the scroll reaches it or rests this long.
const SETTLE_MS = 240;
// The region stays polite this long after a press, so the choice is announced before it goes quiet.
const QUIET_MS = 1500;
// Air the panel needs around its content to count as a fit below the header.
const PIN_AIR = 32;

const clamp = (n: number) => Math.min(1, Math.max(0, n));
const isView = (value: string | undefined): value is View => ORDER.includes(value as View);

export function initArcs(): void {
  document.querySelectorAll<HTMLElement>('[data-arcs]').forEach(setup);
}

function setup(root: HTMLElement): void {
  const pin = root.querySelector<HTMLElement>('[data-arcs-pin]') ?? root;
  const grid = root.querySelector<HTMLElement>('[data-arcs-grid]') ?? pin;
  const art = root.querySelector<HTMLElement>('[data-arcs-art]') ?? root;
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('button[data-arcs-view]'));
  const live = root.querySelector<HTMLElement>('[data-arcs-live]');
  if (!buttons.length || !live) return;
  // The phone call to action rides along the foot of the viewport, so the pinned panel keeps clear of it.
  const cta = document.getElementById('mobile-cta');

  // The text for each view sits in the markup, so the copy lives in one place.
  const texts = new Map<View, string>();
  root.querySelectorAll<HTMLElement>('[data-arcs-text]').forEach((node) => {
    const key = node.dataset.arcsText;
    if (isView(key)) texts.set(key, (node.textContent ?? '').trim());
  });

  const observes = 'IntersectionObserver' in window;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const still = () => reduce.matches || document.documentElement.classList.contains('static') || !observes;

  let view: View = isView(root.dataset.state) ? root.dataset.state : 'network';
  let shown: View | null = view;
  let target: View | null = null;
  let scrub = false;
  let pinned = false;
  let frame = 0;
  let sizing = 0;
  let settle = 0;
  let quiet = 0;
  let header = 0;
  let room = 0;
  let pinTop = 0;
  let padTop = 0;
  let padBottom = 0;

  // The paragraph and the pressed button name one view.
  const say = (next: View) => {
    if (next === shown) return;
    shown = next;
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.arcsView === next));
    const text = texts.get(next);
    if (!text || (live.textContent ?? '').trim() === text) return;
    live.textContent = text;
    if (scrub) {
      // restart the short entrance on the new text
      live.classList.remove('is-new');
      void live.offsetWidth;
      live.classList.add('is-new');
    }
  };

  // Geometry, read again whenever the viewport changes: the header, the phone bar and whether the
  // panel fits between them. The small viewport height is the one a pinned panel must fit. The
  // pinned panel sits centred in that space, so the drawing holds in the middle of the view.
  const measure = () => {
    header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 0;
    room = cta && getComputedStyle(cta).display !== 'none' ? cta.offsetHeight : 0;
    const space = document.documentElement.clientHeight - header - room;
    root.classList.toggle('is-flat', grid.offsetHeight + PIN_AIR > space);
    // The two layouts space the copy in their own ways, so the height is read again once the class is set.
    pinTop = Math.round(header + Math.max(0, (space - grid.offsetHeight) / 2));
    root.style.setProperty('--pin-top', `${pinTop}px`);
    const style = getComputedStyle(root);
    padTop = parseFloat(style.paddingTop) || 0;
    padBottom = parseFloat(style.paddingBottom) || 0;
    pinned = getComputedStyle(pin).position === 'sticky';
  };

  // Progress through the sequence, 0 to 1. Pinned: the share of the panel's run through the section
  // scrolled so far, from the moment it pins to the moment it lets go.
  // Flat: how far the drawing has crossed the band of the viewport where it shows whole.
  const band = (box: DOMRect) => {
    const floor = window.innerHeight - room;
    return { floor, travel: floor - header - box.height };
  };

  const run = (box: DOMRect) => box.height - padTop - padBottom - pin.offsetHeight;

  const progress = (): number => {
    if (pinned) {
      const box = root.getBoundingClientRect();
      const length = run(box);
      return length > 0 ? clamp((pinTop - box.top - padTop) / length) : 0;
    }
    const box = art.getBoundingClientRect();
    const { floor, travel } = band(box);
    return travel > 0 ? clamp((floor - box.bottom) / travel) : clamp((floor - box.top) / Math.max(1, floor - header));
  };

  // The scroll position where a view has just completed.
  const scrollFor = (next: View): number => {
    const index = ORDER.indexOf(next);
    const start = STARTS[index];
    const end = STARTS[index + 1] ?? 1;
    const p = Math.min(end - 0.005, start + (end - start) * (DRAW_SHARE + LAND));
    if (pinned) {
      const box = root.getBoundingClientRect();
      return box.top + window.scrollY + padTop - pinTop + p * Math.max(0, run(box));
    }
    const box = art.getBoundingClientRect();
    const { floor, travel } = band(box);
    return box.bottom + window.scrollY - floor + p * Math.max(0, travel);
  };

  const release = () => {
    window.clearTimeout(settle);
    target = null;
    say(view);
    window.clearTimeout(quiet);
    quiet = window.setTimeout(() => {
      if (!target && scrub) live.setAttribute('aria-live', 'off');
    }, QUIET_MS);
  };

  const hold = () => {
    window.clearTimeout(settle);
    settle = window.setTimeout(release, SETTLE_MS);
  };

  const update = () => {
    frame = 0;
    if (!scrub) return;
    const p = progress();
    let index = 0;
    while (index < ORDER.length - 1 && p >= STARTS[index + 1]) index++;
    const start = STARTS[index];
    const end = STARTS[index + 1] ?? 1;
    root.style.setProperty('--draw', clamp((p - start) / (end - start) / DRAW_SHARE).toFixed(3));
    view = ORDER[index];
    if (root.dataset.state !== view) root.dataset.state = view;
    if (!target) say(view);
    else if (view === target) release();
    else hold();
  };

  const schedule = () => {
    if (scrub && !frame) frame = requestAnimationFrame(update);
  };

  const choose = (next: View) => {
    if (!scrub) {
      view = next;
      root.dataset.state = next;
      say(next);
      return;
    }
    target = next;
    window.clearTimeout(quiet);
    // The region turns polite a frame before the text changes, so the choice is announced.
    live.setAttribute('aria-live', 'polite');
    requestAnimationFrame(() => {
      if (target === next) say(next);
    });
    hold();
    window.scrollTo({ top: Math.round(scrollFor(next)), behavior: 'smooth' });
  };

  for (const button of buttons) {
    button.addEventListener('click', () => {
      const next = button.dataset.arcsView;
      if (isView(next)) choose(next);
    });
  }

  const mode = () => {
    scrub = !still();
    root.classList.toggle('is-scrub', scrub);
    if (!scrub) {
      // Motion off: nothing pins, the view in hand stays complete and every choice is announced.
      window.clearTimeout(settle);
      target = null;
      root.classList.toggle('is-flat', !observes);
      root.style.removeProperty('--draw');
      live.setAttribute('aria-live', 'polite');
      return;
    }
    // Changes the scroll makes are not announced; a visitor's choice is.
    live.setAttribute('aria-live', 'off');
    measure();
    update();
  };

  mode();
  reduce.addEventListener('change', mode);

  window.addEventListener(
    'resize',
    () => {
      if (!scrub || sizing) return;
      sizing = requestAnimationFrame(() => {
        sizing = 0;
        measure();
        update();
      });
    },
    { passive: true },
  );

  // The first measure may run in the fallback face; measure again once the web font is in.
  document.fonts?.ready
    .then(() => {
      if (!scrub) return;
      measure();
      update();
    })
    .catch(() => {});

  // A printout shows the view in hand complete.
  window.addEventListener('beforeprint', () => root.style.setProperty('--draw', '1'));
  window.addEventListener('afterprint', schedule);

  if (!observes) return;

  // The scroll is read while the section is near the viewport; the dots rest while it is away.
  const watch = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        root.classList.toggle('is-live', entry.isIntersecting);
        if (entry.isIntersecting) {
          window.addEventListener('scroll', schedule, { passive: true });
          schedule();
        } else {
          window.removeEventListener('scroll', schedule);
        }
      }
    },
    { rootMargin: '50% 0px' },
  );
  watch.observe(root);
}
