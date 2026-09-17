// Background films. A film loads when its band nears the viewport, plays while in view,
// pauses out of view and always offers a pause button (WCAG 2.2.2).
// Reduced motion or Save-Data: the poster stays and the button offers "play" instead.
import { track } from './analytics';

interface Film {
  host: HTMLElement;
  video: HTMLVideoElement;
  toggle: HTMLButtonElement | null;
  name: string;
  userPaused: boolean;
  inView: boolean;
}

export function initVideos(): void {
  const hosts = Array.from(document.querySelectorAll<HTMLElement>('[data-film]'));
  if (!hosts.length || !('IntersectionObserver' in window)) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const small = window.matchMedia('(max-width: 760px)');
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  const calm = () => reduce.matches || connection?.saveData === true || document.documentElement.classList.contains('static');

  const films = new Map<Element, Film>();

  const label = (film: Film, paused: boolean) => {
    if (!film.toggle) return;
    film.toggle.setAttribute('aria-pressed', String(paused));
    film.toggle.setAttribute('aria-label', `${paused ? 'Play' : 'Pause'} background film: ${film.name}`);
  };

  const load = (film: Film) => {
    if (film.video.src) return;
    const src = small.matches ? film.video.dataset.srcSm : film.video.dataset.srcLg;
    if (src) film.video.src = src;
  };

  const sync = (film: Film) => {
    const shouldPlay = film.inView && !film.userPaused && !document.hidden;
    if (shouldPlay) {
      load(film);
      film.video.play().catch(() => {
        // Autoplay can be refused (battery saver, browser policy). The poster stays and the button offers play.
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
    };
    films.set(host, film);
    label(film, film.userPaused);

    video.addEventListener('playing', () => video.classList.add('is-playing'));

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
