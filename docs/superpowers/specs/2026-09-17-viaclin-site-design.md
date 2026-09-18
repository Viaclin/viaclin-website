# Viaclin website: design (delta to VIACLIN_WEBSITE_SPEC.md)

Date: 17 September 2026. Approved in chat by the owner on the same day.

This document records the decisions that change or extend `../../../../VIACLIN_WEBSITE_SPEC.md` (the "spec"). Where this document is silent, the spec stands.

## 1. Precedence

| Topic | Winner |
|---|---|
| Visual design, motion, footage, glass, dark mode, analytics, cookies, search | Owner's brief of 17 Sep (this document) |
| Page copy, voice rules, British spelling, no founder references, no prices | Spec sections 0 and 8 |
| Operations Excellence copy | Rewritten around "the operations evolution" and "next-gen ready" supply chains, inside the spec's voice rules |

Spec rules that are lifted: no gradients, no footage, no card shadows, no analytics, no cookie banner, light theme alone, "client JavaScript limited to three things", 300 KB home page budget (replaced by lazy-loaded video, see section 5).

Spec rules that stay: no em or en dashes, no adverbs ending in -ly, no jargon list, British spelling, sentence case, no all-caps text, no middle-dot separators, no arrows appended to link text, no founder references, no prices, never invent a legal value.

## 2. Owner inputs

- Legal name: Viaclin Limited. VAT number IE4754731LH (from the spec).
- Email: info@viaclin.com. No phone number anywhere (owner removed click to call).
- LinkedIn: not supplied. The config keeps an empty `linkedin` field; nothing renders until it has a value.
- CRO number and registered office: not supplied. Config fields stay empty, nothing renders, and `npm run launch-check` reports them as launch blockers.
- Shop items (payments, pricing disclosures, shipping, refunds, reviews, password toggle): skipped, owner's choice.

Rule for every optional value: an empty value renders nothing. No square-bracket placeholder ever reaches a page.

## 3. Brand system

- The V mark and the VIACLIN wordmark stay as artwork. They are vector-traced from the owner's 1760 px PNG into an SVG set: lockup (mark, wordmark, descriptor), wordmark (mark and VIACLIN without the descriptor, used in the header), mark alone, each in colour, reversed and mono.
- Light palette: spec section 3. Dark palette (new): ground `#061A2E`, raised `#0B2540`, text `#F2F6F9`, body `#B9C7D6`, rule `#1E3A57`, link and accent `#6ECB93`. The action colour stays `#258253` in both themes (white text holds 4.8:1); `#2E9A64` is used for the logo's green stroke on dark grounds alone. `src/styles/tokens.css` is the source of truth.
- Typeface: Noto Sans 400, 600, 700, self-hosted.
- Liquid glass: the owner's `.liquid-glass` CSS is the base. Brand version `.glass` adds a navy tint layer for text contrast over footage and a green-light top highlight. Used on: video caption cards, header once scrolled, modals, cookie banner, chips.
- Motion language, "the route": lines draw, nodes light, content rises 18 px and fades in. Durations 400 to 900 ms, ease `cubic-bezier(.2,.7,.2,1)`. Everything is off under `prefers-reduced-motion`.
- Associated material: `/brand` guidelines page (noindex), favicon set, web manifest, OG image, LinkedIn banner, email signature, letterhead.

## 4. Site map

Spec routes plus: `/terms`, `/cookies`, `/accessibility`, `/legal`, `/search`, `/brand` (noindex). `/thanks` and `/404` as in the spec.

## 5. Home page order and the six videos

The footage follows the product down the page, in the owner's order.

1. Header: sticky, glass once scrolled, scroll progress bar.
2. Hero: descriptor "Life science consultancy" (docks into the header on scroll), H1, lead, two buttons, spinning dot-sphere (kept from the old site, recoloured), route diagram.
3. Proof strip.
4. Video 1, technician: full-bleed band. "Three service areas" with three glass cards.
5. Supply Chain Consultancy: split section with video 2, pumps.
6. Project Management: split section, mirrored, with video 3, labelling machine.
7. Video 4, robotic arm: full-bleed band. Operations Excellence, "the operations evolution", "next-gen ready".
8. Method: Diagnose, Embed, Deliver.
9. Principles.
10. Network, with the lead-and-network diagram from the old site, recoloured.
11. Close-out teaser with the temperature trace.
12. Video 5, automated warehouse: full-bleed band. Three regulatory jurisdictions as glass cards.
13. Consultant experience: slow logo marquee, monochrome, with a trademark and no-endorsement line.
14. Video 6, driver: full-bleed contact band, the last mile.
15. Footer.

Video rules: H.264 MP4 without audio, 1280 px and 720 px variants, poster image, `preload="none"`, `muted loop playsinline`, played by IntersectionObserver while in view, paused out of view, a visible pause and play button on each (WCAG 2.2.2), poster alone under reduced motion or Save-Data.

## 6. Kept from the old site

- Spinning dot-sphere (`index (1).html`): same Fibonacci-sphere canvas, brand colours per theme, paused off screen.
- Descriptor docking: the hero descriptor glides to a slot beside the header logo as the page scrolls. Works from 1240 px up; below that the header keeps the compact logo and the descriptor stays in the hero.
- Popup: `.js-convo` on any element opens the contact dialog. Upgraded to a real form.

## 7. Contact form

Spec section 10, with two changes: the form also lives in the dialog, and without a Web3Forms key the form composes an email to info@viaclin.com. States: empty (field hints), error (per field, prefixed with the field name, plus a summary), sending (disabled button, spinner, "Sending"), success (in place, focus moved), failure (one line, form kept filled). UTM values ride along as hidden fields.

## 8. Consent, analytics, tracking

- Banner on first visit: "Accept all", "Reject all", "Choose", equal weight. Preferences dialog with Necessary (locked on), Analytics (GA4), Insights (Microsoft Clarity heatmaps and A/B tests). Stored in localStorage as `viaclin-consent`, re-asked after 6 months. "Cookie settings" link in the footer.
- Google Consent Mode v2, all denied by default. GA4, Clarity and the A/B helper load after consent and when their ID exists: `PUBLIC_GA4_ID`, `PUBLIC_CLARITY_ID`. Search Console tag from `PUBLIC_GSC_VERIFICATION`.
- Events: `cta_click`, `modal_open`, `form_start`, `form_submit`, `generate_lead`, `video_toggle`, `search`, `experiment_exposure`.
- UTM: `utm_*`, `gclid`, `msclkid` read on landing, kept for the session after analytics consent, added to form submissions.

## 9. UX list

Site search (Pagefind, dialog plus `/search`), dark mode toggle (system default, stored choice, no flash), sticky header, back-to-top, scroll progress, sticky mobile CTA, mobile menu, copy buttons on the email address, print stylesheet, last-updated date on legal pages and in the footer, custom 404, thanks page, loading states (search skeleton, button spinner, video poster), hover and focus states on every control.

## 10. Quality gates

`npm run build` runs the copy QA first. `npm run qa:links`, `npm run qa:visual` (Playwright, 1440, 768 and 390 px, both themes, overflow and console errors), `npm run qa:a11y` (axe), `npm run launch-check`. Lighthouse targets: 95 on Accessibility, Best Practices and SEO; 90 or above on Performance for the home page with footage, 95 on a service page.

## 11. Caveats for the owner

- Legal pages are drafts written for an Irish limited company under GDPR and the ePrivacy Regulations. A solicitor should review them before launch.
- Irish company law expects the company number and registered office on the website. Both are open.
- Third-party logos are trademarks of their owners. The banner states that they show consultants' prior experience and imply no endorsement.
- Astro version: the spec names Astro 5; the build uses the current stable Astro because version 5 is two majors behind.
