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
  integrations: [
    sitemap({
      filter: (page) => !hidden.some((path) => new URL(page).pathname.replace(/\/$/, '') === path),
    }),
  ],
});
