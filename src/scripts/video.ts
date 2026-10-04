// Background films. A film loads when its band nears the viewport, plays while in view,
// pauses out of view and always offers a pause button (WCAG 2.2.2).
// Reduced motion or Save-Data: the poster stays and the button offers "play" instead.
// A host may carry data-film-when, a media query: outside it the film is not drawn, so it never
// loads there and pauses if the window is resized across the line.
import { track } from './analytics';

interface Film {
  host: HTMLElement;
  video: HTMLVideoElement;
  toggle: HTMLButtonElement | null;
  name: string;
  userPaused: boolean;
  inView: boolean;
  when: MediaQueryList | null;
}

export function initVideos(): void {
  const hosts = Array.from(document.querySelectorAll<HTMLElement>('[data-film]'));
  if (!hosts.length || !('IntersectionObserver' in window)) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const small = window.matchMedia('(max-width: 760px)');
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  const calm = () => reduce.matches || connection?.saveData === true || document.documentElement.classList.contains('static');

  const films = new Map<Element, Film>();

  // The button keeps the name it was given in the markup ("Pause film: X"); aria-pressed carries
  // the state, so a screen reader never hears a name and a state that disagree.
  const label = (film: Film, paused: boolean) => {
    film.toggle?.setAttribute('aria-pressed', String(paused));
  };

  const load = (film: Film) => {
    if (film.video.src) return;
    // Pick by the box the film is drawn in, not by the viewport: a framed film sits at about
    // 570px on a 1440px screen, so the 1280 encode would be wasted. A box of 0 means the film
    // has no layout yet, and then the viewport is the best guide left.
    const box = film.video.getBoundingClientRect().width * Math.min(window.devicePixelRatio || 1, 2);
    const wantsLarge = box > 0 ? box > 860 : !small.matches;
    const src = wantsLarge ? film.video.dataset.srcLg : film.video.dataset.srcSm;
    if (src) film.video.src = src;
  };

  const sync = (film: Film) => {
    const drawn = !film.when || film.when.matches;
    const shouldPlay = drawn && film.inView && !film.userPaused && !document.hidden;
    if (shouldPlay) {
      load(film);
      film.video.play().catch((error: DOMException) => {
        // A refusal (battery saver, browser policy) is the one rejection that counts as a pause:
        // the poster stays and the button offers play. An AbortError means pause() cut short a
        // pending play as the film left view, so the film must stay free to play on the way back.
        if (error?.name !== 'NotAllowedError') return;
        film.userPaused = true;
        label(film, true);
      });
    } else if (!film.video.paused) {
      film.video.pause();
    }
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const film = films.get(entry.target);
        if (!film) continue;
        film.inView = entry.isIntersecting;
        sync(film);
      }
    },
    { threshold: 0.2, rootMargin: '10% 0px' },
  );

  for (const host of hosts) {
    const video = host.querySelector('video');
    if (!video) continue;
    const toggle = host.querySelector<HTMLButtonElement>('[data-film-toggle]');
    const film: Film = {
      host,
      video,
      toggle,
      name: toggle?.dataset.filmName ?? 'film',
      userPaused: calm(),
      inView: false,
      when: host.dataset.filmWhen ? window.matchMedia(host.dataset.filmWhen) : null,
    };
    films.set(host, film);
    label(film, film.userPaused);

    video.addEventListener('playing', () => video.classList.add('is-playing'));
    film.when?.addEventListener('change', () => sync(film));

    toggle?.addEventListener('click', () => {
      film.userPaused = !film.userPaused;
      label(film, film.userPaused);
      track('video_toggle', { film: film.name, state: film.userPaused ? 'paused' : 'playing' });
      sync(film);
    });

    observer.observe(host);
  }

  document.addEventListener('visibilitychange', () => films.forEach(sync));
  reduce.addEventListener('change', () => {
    films.forEach((film) => {
      if (reduce.matches) {
        film.userPaused = true;
        label(film, true);
      }
      sync(film);
    });
  });
}
