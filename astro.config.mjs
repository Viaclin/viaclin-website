import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Pages that must stay out of the XML sitemap.
const hidden = ['/thanks', '/404', '/brand', '/search'];

export default defineConfig({
  site: 'https://viaclin.com',
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'file' },
  devToolbar: { enabled: false },
  // Static hosts have no server-side redirects, so Astro writes a small redirect page for the old address.
  redirects: {
    '/services/trial-close-out': '/services/supply-chain-consultancy',
    '/services/operations-excellence': '/services/optimised-operations',
  },
  integrations: [
    sitemap({
      filter: (page) => !hidden.some((path) => new URL(page).pathname.replace(/\/$/, '') === path),
    }),
  ],
});
