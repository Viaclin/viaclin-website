# Viaclin website implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task by task. Each task owns the files listed under it and must not edit files owned by another task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static, multi-page Viaclin marketing site with a kept-V-mark brand system, six scroll-placed videos in liquid glass, dark mode, consent-gated analytics, site search and a full legal set.

**Architecture:** Astro static output. Vanilla CSS with custom properties, split into tokens, base, components and print. Small TypeScript client modules, one responsibility each, loaded from `Base.astro`. Content lives in `src/data/*.ts`; pages compose shared components. Pagefind indexes `dist` after the build.

**Tech stack:** Astro (current stable), `@astrojs/sitemap`, `@fontsource/noto-sans`, Pagefind, sharp, Playwright, `@axe-core/playwright`, ffmpeg (assets, one-off).

**Spec:** `docs/superpowers/specs/2026-09-17-viaclin-site-design.md` (the delta) and `../VIACLIN_WEBSITE_SPEC.md` (copy in section 8, voice rules in section 0). Executors read both.

## Global constraints

- Copy: no U+2014 or U+2013; no adverbs ending in -ly (exempt: supply, apply, family, assembly, anomaly, reply, July, daily, weekly, monthly, quarterly, yearly, Italy); no jargon from spec section 0 rule 3; British spelling; sentence case; no all-caps text; no middle-dot separators; no arrows appended to link text. These rules cover alt text, meta descriptions, error messages and code comments.
- Never mention the founder, prior employers of the founder, prices or day rates. Never invent a legal value. Empty config values render nothing.
- Use spec section 8 copy as written unless the design doc says otherwise.
- Colour through tokens alone. No raw hex in components except inside SVG artwork.
- Every interactive element: visible focus ring, hover state, 44 px minimum target.
- Every animation sits inside `@media (prefers-reduced-motion: no-preference)` or is switched off by the `reduce-motion` check in JS.
- Both themes pass WCAG 2.2 AA contrast.
- No external requests on page load before consent. Fonts, scripts and footage are self-hosted.
- `<html lang="en-IE">`. One H1 per page. No skipped heading levels.
- Email is `info@viaclin.com`. No phone number anywhere.

## File structure

```
viaclin-site/
  astro.config.mjs            site URL, sitemap, trailingSlash 'never', build.format 'file'
  vercel.json                 cleanUrls, security headers, redirects
  .env.example                PUBLIC_GA4_ID, PUBLIC_CLARITY_ID, PUBLIC_GSC_VERIFICATION, PUBLIC_WEB3FORMS_KEY
  public/
    favicon.svg favicon-32.png apple-touch-icon.png icon-192.png icon-512.png site.webmanifest
    robots.txt
    og/viaclin-og.png
    video/0N-name-1280.mp4, 0N-name-720.mp4, 0N-name.jpg
    logos/clients/*.svg
    brand/                    downloadable brand material
  src/
    assets/logo/              viaclin-lockup.svg, -wordmark.svg, -mark.svg (+ reversed)
    styles/tokens.css base.css components.css print.css global.css (imports the four)
    data/site.ts nav.ts videos.ts services.ts closeout.ts clients.ts experiments.ts
    layouts/Base.astro Legal.astro
    components/               see "Component contracts"
    scripts/                  client modules, see "Client module contracts"
    pages/                    routes
  scripts/                    copy-qa.mjs link-check.mjs visual-qa.mjs a11y-qa.mjs launch-check.mjs make-brand-assets.mjs
```

## Data contracts

`src/data/site.ts`

```ts
export const site = {
  name: 'Viaclin',
  legalName: 'Viaclin Limited',
  url: 'https://viaclin.com',
  email: 'info@viaclin.com',
  vat: 'IE4754731LH',
  croNumber: '',            // empty renders nothing
  registeredOffice: '',     // empty renders nothing
  linkedin: '',             // empty renders nothing
  descriptor: 'Life science consultancy',
  strapline: 'We push the project.',
  sisterBrand: { name: 'SupplyAI', url: 'https://supplyai.eu' },
  ga4: import.meta.env.PUBLIC_GA4_ID ?? '',
  clarity: import.meta.env.PUBLIC_CLARITY_ID ?? '',
  gsc: import.meta.env.PUBLIC_GSC_VERIFICATION ?? '',
  web3formsKey: import.meta.env.PUBLIC_WEB3FORMS_KEY ?? '',
  legalUpdated: '2026-09-17', // ISO date shown on legal pages
};
export const formatDate = (iso: string) => string; // "17 September 2026"
```

`src/data/videos.ts`: `videos: Record<VideoKey, { base: string; alt: string; chip: string }>` with keys `technician | pumps | labelling | robot | warehouse | driver`. `base` is `/video/01-technician` and so on; files are `${base}-1280.mp4`, `${base}-720.mp4`, `${base}.jpg`.

`src/data/nav.ts`: `services: { title, href, summary }[]`, `primary`, `company`, `legal` link arrays for the header, footer and 404.

## Component contracts

| Component | Props | Notes |
|---|---|---|
| `Base.astro` | `title, description, path, noindex?, schema?` | head, skip link, header, `<main id="main">`, footer, global dialogs and scripts |
| `Legal.astro` | `title, description, path, updated?` | narrow measure, last-updated line, print button, table of contents from H2s |
| `Logo.astro` | `variant: 'lockup' \| 'wordmark' \| 'mark', reversed?` | inline SVG, `currentColor` aware |
| `PageHero.astro` | `title, lead, eyebrow?, cta?: { label, topic? }, video?: VideoKey` | inner page hero; optional framed video |
| `Section.astro` | `id?, tone?: 'white' \| 'mist' \| 'navy', eyebrow?, title?, intro?, narrow?` | slot for content |
| `VideoBand.astro` | `video: VideoKey, id?, height?: 'tall' \| 'mid'` | full-bleed footage, overlay, slot for glass content |
| `VideoFrame.astro` | `video: VideoKey` | rounded framed footage for split sections |
| `Blocks.astro` | `items: { title, body, href?, linkLabel? }[], cols?: 2 \| 3 \| 4, glass?` | titled blocks grid |
| `Steps.astro` | `items: { title, body }[]` | numbered sequence |
| `ProofStrip.astro` | none | four facts |
| `RouteDiagram.astro` | none | hero route, desktop and mobile SVG |
| `NetworkVisual.astro` | none | lead-and-network diagram |
| `ContactBand.astro` | `title?, line?, label?, topic?, video?: boolean` | closing band on every page |
| `ContactForm.astro` | `idPrefix: string, topic?: string` | used in dialog and on `/contact` |
| `ContactModal.astro` | none | dialog opened by `.js-convo` |
| `ConsentBanner.astro` | none | banner and preferences dialog |
| `SearchModal.astro` | none | dialog opened by `[data-search-open]` |
| `LogoMarquee.astro` | none | consultant experience banner |

## CSS contracts

- Layout: `.container`, `.section`, `.section--mist`, `.section--navy`, `.section-head`, `.eyebrow`, `.display`, `.lead`, `.measure`, `.grid`, `.grid--2`, `.grid--3`, `.grid--4`, `.split`, `.split--flip`.
- Controls: `.btn`, `.btn--primary`, `.btn--secondary`, `.btn--glass`, `.btn--sm`, `.icon-btn`, `.text-link`, `.chip`.
- Surfaces: `.glass` (brand liquid glass), `.card`, `.rule-top`, `.rule-top--green`.
- Motion: attribute `data-reveal` (`up` default, `fade`, `left`, `right`, `scale`), optional `style="--d:120ms"`. `reveal.ts` adds `.is-in`.
- Behaviour hooks: `.js-convo` (+ `data-topic`), `[data-copy]`, `[data-search-open]`, `[data-consent-open]`, `[data-theme-toggle]`, `[data-track="event_name"]`.

## Client module contracts (`src/scripts`)

| Module | Exports | Role |
|---|---|---|
| `theme.ts` | `initTheme()` | toggle, stored choice, `data-theme` on `<html>` |
| `nav.ts` | `initNav()` | mobile menu, services dropdown, header scrolled state, progress bar, back-to-top, mobile CTA visibility |
| `reveal.ts` | `initReveal()` | IntersectionObserver reveals |
| `dock.ts` | `initDock()` | descriptor docking |
| `sphere.ts` | `initSphere()` | hero dot-sphere |
| `video.ts` | `initVideos()` | lazy source pick, play in view, pause button, parallax |
| `dialog.ts` | `openDialog(el, opener?)`, `closeDialog(el)` | shared focus trap, Escape, scroll lock |
| `contact.ts` | `initContact()` | `.js-convo`, validation, submit states |
| `consent.ts` | `initConsent()`, `getConsent()`, `onConsent(cb)` | banner, preferences, storage |
| `analytics.ts` | `initAnalytics()`, `track(name, params?)` | Consent Mode, GA4, Clarity loaders, `[data-track]` |
| `utm.ts` | `initUtm()`, `getUtm()` | campaign capture |
| `ab.ts` | `initExperiments()`, `variant(key)` | A/B helper |
| `search.ts` | `initSearch()` | Pagefind dialog and `/search` page |
| `copy.ts` | `initCopy()` | copy buttons |
| `main.ts` | none | imports and runs every `init*` |

---

## Tasks

### Task 1: Foundation (lead, inline)

**Files:** project scaffold, `astro.config.mjs`, `vercel.json`, `.env.example`, `src/styles/*`, `src/data/site.ts`, `nav.ts`, `videos.ts`, `src/layouts/Base.astro`, `Logo`, `Header`, `Footer`, `Seo`, `Section`, `Blocks`, `Steps`, `PageHero`, `VideoBand`, `VideoFrame`, `ContactBand`, `ContactForm`, `ContactModal`, stubs for `ConsentBanner`, `SearchModal`, `LogoMarquee`; scripts `theme`, `nav`, `reveal`, `dock`, `sphere`, `video`, `dialog`, `contact`, `copy`, `main`, stubs for `consent`, `analytics`, `utm`, `ab`, `search`.

- [ ] Scaffold Astro, install dependencies, commit.
- [ ] Assets: six videos to `public/video` (two sizes, poster, no audio); trace the logo PNG into the SVG set.
- [ ] Tokens, base, components and print CSS in both themes.
- [ ] Layout, header, footer, shared components, client modules.
- [ ] `npm run build` passes. Commit.

### Task 2: Home page (lead, inline)

**Files:** `src/pages/index.astro`, `ProofStrip`, `RouteDiagram`, `NetworkVisual`, `src/data/services.ts`.

- [ ] Build the fifteen-part order from design doc section 5 with spec 8.1 copy.
- [ ] Verify in the browser at 1440, 768 and 390 px in both themes. Commit.

### Task 3: Service pages and How we work

**Files:** `src/pages/services/supply-chain-consultancy.astro`, `project-management.astro`, `operations-excellence.astro`, `trial-close-out.astro`, `src/pages/how-we-work.astro`, `src/data/closeout.ts`.

**Consumes:** `Base`, `PageHero`, `Section`, `Blocks`, `Steps`, `ContactBand`, `VideoFrame`. **Produces:** five routes.

- [ ] Copy from spec 8.2, 8.3, 8.5, 8.6 as written. Hero videos: pumps, labelling, robot, warehouse; How we work has none.
- [ ] Operations Excellence: keep spec 8.4 blocks and steps; rewrite hero, intro and add a section "The operations evolution" (four shifts) and "Next-gen ready" (what the term means for a supply chain, and the readiness assessment as the entry point).
- [ ] `npm run build` passes; pages checked at 390 and 1440 px.

### Task 4: Contact, thanks, 404

**Files:** `src/pages/contact.astro`, `thanks.astro`, `404.astro`.

- [ ] Spec 8.7, 8.8, 8.10. `/contact` reads `?topic=close-out`. LinkedIn block renders when `site.linkedin` has a value. Email has a copy button. `/thanks` and `/404` are noindex.

### Task 5: Legal set

**Files:** `src/layouts/Legal.astro`, `src/pages/privacy.astro`, `terms.astro`, `cookies.astro`, `accessibility.astro`, `legal.astro`.

- [ ] Privacy: spec 8.9 rewritten for GA4, Clarity, Web3Forms, Vercel, consent, retention of 24 months for enquiries, DPC complaint route, international transfers.
- [ ] Terms: site use, intellectual property and copyright, no professional advice, engagement terms sit in a signed contract, liability, governing law Ireland.
- [ ] Cookies: table of storage by category, how to change a choice (`data-consent-open` button).
- [ ] Accessibility statement: WCAG 2.2 AA target, known limits (footage has no audio and is decorative), feedback route.
- [ ] Legal and compliance: regulatory position (consultancy, not a licence holder; work runs inside the client's quality system), no medical or regulatory advice through the site, trademark notice for third-party names and logos, footage notice, company details block from `site`.

### Task 6: Consent, analytics, UTM, A/B

**Files:** `src/components/ConsentBanner.astro`, `src/scripts/consent.ts`, `analytics.ts`, `utm.ts`, `ab.ts`, `src/data/experiments.ts`.

- [ ] Behaviour per design doc section 8. Banner is a glass panel, keyboard reachable, does not trap focus; preferences is a dialog using `dialog.ts`.

### Task 7: Search

**Files:** `src/components/SearchModal.astro`, `src/scripts/search.ts`, `src/pages/search.astro`; `package.json` build script gains `pagefind --site dist`.

- [ ] States: idle hint, loading skeleton, results, no results, index unavailable (dev server). Opens with `/` and Ctrl or Cmd K. `data-pagefind-body` on `<main>`; legal boilerplate and the marquee carry `data-pagefind-ignore`.

### Task 8: Consultant experience marquee

**Files:** `src/components/LogoMarquee.astro`, `src/data/clients.ts`, `public/logos/clients/*.svg`.

- [ ] Source official SVG logos (Wikimedia Commons or press kits), convert to single-colour `currentColor`, optimise. Typeset fallback for any that cannot be sourced.
- [ ] Marquee: 90 s loop, pauses on hover and focus, pause button, static wrapped grid under reduced motion, each logo has its company name as accessible text, disclaimer line beneath.

### Task 9: Brand page and material

**Files:** `src/pages/brand.astro`, `scripts/make-brand-assets.mjs`, `public/brand/*`, `public/og/viaclin-og.png`, favicon set, `site.webmanifest`.

### Task 10: QA scripts and launch check

**Files:** `scripts/copy-qa.mjs`, `link-check.mjs`, `visual-qa.mjs`, `a11y-qa.mjs`, `launch-check.mjs`, `README.md`.

### Task 11: Review and fix loop

Independent reviewers per dimension (visual polish, responsiveness, accessibility, SEO and metadata, copy rules, performance, brief compliance line by line), adversarial verification of each finding, fixes, repeat until a round finds nothing new.
