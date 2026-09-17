// Dark mode toggle. The inline script in Base.astro picks the first theme before paint;
// this module wires the buttons, stores the choice and follows the system until a choice exists.
const KEY = 'viaclin-theme';
type Theme = 'light' | 'dark';

function stored(): Theme | null {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'dark' || value === 'light' ? value : null;
  } catch {
    return null;
  }
}

export function initTheme(): void {
  const root = document.documentElement;
  const buttons = document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]');

  const apply = (theme: Theme) => {
    root.setAttribute('data-theme', theme);
    buttons.forEach((button) => {
      button.setAttribute('aria-pressed', String(theme === 'dark'));
      button.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    });
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

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
    if (!stored()) apply(event.matches ? 'dark' : 'light');
  });
}
