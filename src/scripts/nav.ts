// Header behaviour: scrolled state, progress bar, services menu, mobile menu,
// back-to-top button and the sticky mobile call to action.
export function initNav(): void {
  const header = document.getElementById('site-header');
  const bar = document.getElementById('progress-bar');
  const toTop = document.getElementById('to-top');
  const mobileCta = document.getElementById('mobile-cta');
  const footer = document.querySelector<HTMLElement>('.site-footer');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  let ticking = false;
  const update = () => {
    ticking = false;
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (bar) bar.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
    header?.classList.toggle('is-scrolled', y > 16);
    toTop?.classList.toggle('is-on', y > 700);
    if (mobileCta) {
      const nearFooter = footer ? footer.getBoundingClientRect().top < window.innerHeight - 40 : false;
      const blocked = document.documentElement.classList.contains('consent-open') || document.querySelector('dialog[open]') !== null;
      mobileCta.classList.toggle('is-on', y > 480 && !nearFooter && !blocked);
    }
  };
  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  document.addEventListener('viaclin:layout', onScroll);
  update();

  toTop?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: reduce.matches ? 'auto' : 'smooth' });
    document.getElementById('main')?.focus({ preventScroll: true });
  });

  // services dropdown
  const servicesBtn = document.getElementById('services-btn');
  const servicesMenu = document.getElementById('services-menu');
  if (servicesBtn && servicesMenu) {
    const wrap = servicesBtn.parentElement as HTMLElement;
    let closeTimer = 0;
    const setOpen = (open: boolean) => {
      servicesBtn.setAttribute('aria-expanded', String(open));
      servicesMenu.classList.toggle('is-open', open);
    };
    const isOpen = () => servicesBtn.getAttribute('aria-expanded') === 'true';
    servicesBtn.addEventListener('click', () => setOpen(!isOpen()));
    wrap.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'mouse') {
        window.clearTimeout(closeTimer);
        setOpen(true);
      }
    });
    wrap.addEventListener('pointerleave', (event) => {
      if (event.pointerType === 'mouse') closeTimer = window.setTimeout(() => setOpen(false), 180);
    });
    wrap.addEventListener('focusout', (event) => {
      if (!wrap.contains(event.relatedTarget as Node | null)) setOpen(false);
    });
    document.addEventListener('click', (event) => {
      if (isOpen() && !wrap.contains(event.target as Node)) setOpen(false);
    });
    wrap.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && isOpen()) {
        setOpen(false);
        servicesBtn.focus();
      }
      if (event.key === 'ArrowDown' && document.activeElement === servicesBtn) {
        event.preventDefault();
        setOpen(true);
        servicesMenu.querySelector<HTMLElement>('a')?.focus();
      }
    });
  }

  // mobile menu
  const menuBtn = document.getElementById('menu-btn');
  const menu = document.getElementById('mobile-menu');
  if (menuBtn && menu) {
    const setMenu = (open: boolean) => {
      menuBtn.setAttribute('aria-expanded', String(open));
      menu.classList.toggle('is-open', open);
      header?.classList.toggle('is-open', open);
      document.documentElement.style.overflow = open ? 'hidden' : '';
      if (open) menu.querySelector<HTMLElement>('a')?.focus();
    };
    const isOpen = () => menuBtn.getAttribute('aria-expanded') === 'true';
    menuBtn.addEventListener('click', () => setMenu(!isOpen()));
    menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setMenu(false)));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && isOpen()) {
        setMenu(false);
        menuBtn.focus();
      }
    });
    window.matchMedia('(min-width: 1001px)').addEventListener('change', (event) => {
      if (event.matches && isOpen()) setMenu(false);
    });
  }
}
