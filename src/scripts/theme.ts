// Dark mode toggle. The site is light on every device; dark shows when the visitor picks it with the
// footer theme button, and the device setting plays no part. The inline script in Base.astro sets the
// stored theme before paint. This module wires the buttons, stores the choice and keeps two head metas
// in step with the active theme: the browser bar colour and the colour scheme (both in Seo.astro).
const KEY = 'viaclin-theme';
type Theme = 'light' | 'dark';

// The colour scheme meta for each theme. The light value matches the root rule in tokens.css: it keeps the
// page light and asks browsers that darken pages by themselves to leave it alone. Seo.astro renders these
// values; they live here because the copy check reads every string in an .astro file as page copy.
export const schemes: Record<Theme, string> = { light: 'only light', dark: 'dark' };

export function initTheme(): void {
  const root = document.documentElement;
  const buttons = document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]');
  const bar = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  const scheme = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');

  const apply = (theme: Theme) => {
    root.setAttribute('data-theme', theme);
    // The meta carries both colours; the bar takes the page ground of the active theme.
    const colour = bar?.getAttribute(theme === 'dark' ? 'data-dark' : 'data-light');
    if (bar && colour) bar.setAttribute('content', colour);
    scheme?.setAttribute('content', schemes[theme]);
    // The button keeps the name it was given in the markup ("Dark theme"); aria-pressed carries the state.
    buttons.forEach((button) => button.setAttribute('aria-pressed', String(theme === 'dark')));
    document.dispatchEvent(new CustomEvent('viaclin:theme', { detail: theme }));
  };

  apply(root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');

  buttons.forEach((button) =>
    button.addEventListener('click', () => {
      const next: Theme = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(KEY, next);
      } catch {
        // Storage can be blocked; the toggle still works for this page view.
      }
      apply(next);
    }),
  );
}
