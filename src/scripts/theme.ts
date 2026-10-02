// Dark mode toggle. The site is light on every device; dark shows when the visitor picks it with the
// footer theme button, and the device setting plays no part. The inline script in Base.astro sets the
// stored theme before paint. This module wires the buttons, stores the choice and keeps the browser bar
// colour (the theme colour meta in Seo.astro) in step with the active theme.
const KEY = 'viaclin-theme';
type Theme = 'light' | 'dark';

export function initTheme(): void {
  const root = document.documentElement;
  const buttons = document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]');
  const bar = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');

  const apply = (theme: Theme) => {
    root.setAttribute('data-theme', theme);
    // The meta carries both colours; the bar takes the page ground of the active theme.
    const colour = bar?.getAttribute(theme === 'dark' ? 'data-dark' : 'data-light');
    if (bar && colour) bar.setAttribute('content', colour);
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
