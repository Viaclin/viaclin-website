# Viaclin website

The marketing site for Viaclin Limited, a life sciences supply chain consultancy. It is a static, multi-page site: every page is plain HTML at build time, so it loads fast, costs next to nothing to host and has no server to look after.

| Part | Choice |
| --- | --- |
| Framework | Astro, static output |
| Styles | Vanilla CSS with custom properties: `src/styles/tokens.css`, `base.css`, `components.css`, `print.css` |
| Behaviour | Small TypeScript modules in `src/scripts`, one job each, loaded from `src/layouts/Base.astro` |
| Content | Page copy in `src/pages`, shared facts in `src/data` |
| Search | Pagefind, indexed from `dist` after each build |
| Analytics | Google Analytics 4 and Microsoft Clarity, both off until the visitor consents |
| Contact form | Web3Forms, with an email fallback |
| Hosting | Vercel |

The contract for copy, voice and structure is `../VIACLIN_WEBSITE_SPEC.md`. The design decisions that extend it are in `docs/superpowers/specs/2026-09-17-viaclin-site-design.md`.

## Contents

1. [Commands](#commands)
2. [Project layout](#project-layout)
3. [Environment variables](#environment-variables)
4. [Set up Google Analytics 4](#set-up-google-analytics-4)
5. [Set up Google Search Console](#set-up-google-search-console)
6. [Set up Microsoft Clarity heatmaps](#set-up-microsoft-clarity-heatmaps)
7. [Set up the Web3Forms key](#set-up-the-web3forms-key)
8. [How consent gates each tool](#how-consent-gates-each-tool)
9. [Conversion events](#conversion-events)
10. [Campaign links: the UTM naming convention](#campaign-links-the-utm-naming-convention)
11. [Run an A/B test](#run-an-ab-test)
12. [Company details in site.ts](#company-details-in-sitets)
13. [Add a genuine client quote](#add-a-genuine-client-quote)
14. [House rules for copy](#house-rules-for-copy)
15. [Speed testing](#speed-testing)
16. [QA commands](#qa-commands)
17. [Deploy to Vercel](#deploy-to-vercel)
18. [Launch checklist](#launch-checklist)

## Commands

Node 22 or newer. Run `npm install` once after cloning.

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload at `http://localhost:4321` |
| `npm run qa` | Copy QA: the house rules, checked across pages, components, data and comments |
| `npm run build` | Builds the site into `dist`, then writes the Pagefind search index |
| `npm run preview` | Serves `dist` at `http://localhost:4321`, the way Vercel will |
| `npm run qa:links` | Link check on `dist`: internal links, fragments, email links |
| `npm run qa:visual` | Screenshots of every route at three widths in both themes; fails on sideways overflow or a console error |
| `npm run qa:a11y` | axe-core on every route in both themes; fails on a serious or critical violation |
| `npm run launch-check` | Lists what the owner still has to supply before launch |
| `npm run brand` | Regenerates the favicon set, the share image and the brand downloads |

Run `npm run qa` before every build. A failing copy check blocks a release.

## Project layout

```
public/            files served as they are: films, favicons, robots.txt, share image, brand downloads
src/assets/        the logo set and client logos, inlined at build time
src/styles/        tokens, base, components, print
src/data/          site.ts (company facts), nav.ts, services.ts, videos.ts, clients.ts, experiments.ts
src/layouts/       Base.astro (every page), Legal.astro (legal pages)
src/components/    shared building blocks
src/scripts/       client modules: theme, nav, reveal, video, contact, consent, analytics, utm, ab, search
src/pages/         one file per route
scripts/           QA and launch scripts, brand asset generator
docs/              design document and build plan
```

Site search has no index on the dev server, because Pagefind reads the built pages. The search dialog says so and works after `npm run build` with `npm run preview`.

## Environment variables

Four values, all optional. An empty value switches that feature off and nothing breaks. Copy `.env.example` to `.env` for local work. In Vercel they live under Project Settings, Environment Variables.

| Name | What it holds | While empty |
| --- | --- | --- |
| `PUBLIC_GA4_ID` | Google Analytics 4 measurement ID, such as `G-XXXXXXXXXX` | No Google Analytics |
| `PUBLIC_CLARITY_ID` | Microsoft Clarity project ID | No heatmaps, no session insight |
| `PUBLIC_GSC_VERIFICATION` | The `content` value from the Search Console HTML tag | No verification tag in the page head |
| `PUBLIC_WEB3FORMS_KEY` | Web3Forms access key for info@viaclin.com | The form composes an email in the visitor's mail app |

Astro reads these at build time and writes them into the pages. After a change in Vercel, redeploy so the new value reaches the site. Never commit `.env`; the `.gitignore` file keeps it out.

## Set up Google Analytics 4

1. Open `https://analytics.google.com` and sign in with the company Google account.
2. Go to Admin, then Create, then Property. Name it "Viaclin website". Set the reporting time zone to Ireland and the currency to euro.
3. Choose Web as the platform. Enter `https://viaclin.com` as the website URL and "viaclin.com" as the stream name. Leave enhanced measurement on.
4. Copy the measurement ID from the stream details. It starts with `G-`.
5. In Vercel, open the project, then Settings, then Environment Variables. Add `PUBLIC_GA4_ID` with the ID as its value, for the Production environment. Redeploy.
6. Prove it: open the live site in a private window, choose "Accept all" in the cookie banner, click around, and watch the Realtime report in GA4. A visit shows within a minute.
7. Once the first enquiry has come through, open Admin, then Key events, and mark `generate_lead` as a key event. That makes it the conversion in every report.
8. For A/B tests, open Admin, then Custom definitions, and register two event-scoped custom dimensions: `experiment` and `variant`.
9. Open Admin, then Data retention, and set data retention to 14 months for user and event data. The privacy notice states 14 months, so the two must match.

Google signals and ad personalisation are switched off in the site code. The site never sends advertising consent.

## Set up Google Search Console

1. Open `https://search.google.com/search-console` and choose Add property.
2. Pick the URL prefix type and enter `https://viaclin.com`.
3. Choose the HTML tag method. Google shows a tag like `<meta name="google-site-verification" content="abc123" />`. Copy the `content` value alone, here `abc123`.
4. In Vercel, add `PUBLIC_GSC_VERIFICATION` with that value. Redeploy.
5. Back in Search Console, press Verify.
6. Open Sitemaps in the left menu, enter `sitemap-index.xml` and press Submit. The full address is `https://viaclin.com/sitemap-index.xml`.
7. Keep the variable in place. Google looks for the tag again from time to time and drops the verification when it has gone.

The sitemap leaves out `/thanks`, `/404`, `/brand` and `/search`. Each of the four also carries a noindex tag.

## Set up Microsoft Clarity heatmaps

1. Open `https://clarity.microsoft.com`, sign in and create a project. Name it "Viaclin website" and enter `https://viaclin.com`.
2. Skip the install step that offers a code snippet. The site loads Clarity itself, after consent.
3. Open Settings, then Overview, and copy the project ID: a short string of letters and digits.
4. In Vercel, add `PUBLIC_CLARITY_ID` with that value. Redeploy.
5. Prove it: open the live site in a private window, choose "Accept all", visit a few pages. Recordings and heatmaps show in Clarity within a couple of hours.
6. In Clarity, open Settings, then Masking, and keep the default that masks text typed into forms.

Clarity receives the visitor's choice through its consent API and is stopped, with its cookies cleared, when a visitor withdraws consent.

## Set up the Web3Forms key

1. Open `https://web3forms.com` and create an access key for info@viaclin.com. Confirm the address from the email Web3Forms sends.
2. In Vercel, add `PUBLIC_WEB3FORMS_KEY` with the key as its value. Redeploy. For local work, put the same line in `.env`.
3. Send one enquiry from the live site. It should arrive at info@viaclin.com, and the form should swap to its thanks message in place.

Until the key exists the form still works: it composes an email to info@viaclin.com in the visitor's mail app, with every field filled in. That depends on the visitor having a mail app, so `npm run launch-check` lists the missing key as a blocker.

The key is public by design (it sits in the page source) and can send to the one confirmed address alone. If it is ever abused, create a new key and replace the value in Vercel.

## How consent gates each tool

The cookie banner appears once `PUBLIC_GA4_ID` or `PUBLIC_CLARITY_ID` has a value. While both are empty there is nothing to ask about, so no banner shows. On a first visit the banner offers three buttons of equal weight: "Accept all", "Reject all" and "Choose". "Choose" opens a dialog with three categories. The choice is stored in the browser under `viaclin-consent` and asked again after six months. The "Cookie settings" link in the footer opens the dialog at any time, banner or no banner.

To preview the banner on the dev server, put a test value in `.env`, such as `PUBLIC_GA4_ID=G-XXXXXXXXXX`, restart the dev server and open the site in a private window. Take the test value out when you have finished.

| Category | Covers | Default |
| --- | --- | --- |
| Necessary | The stored consent choice and the stored theme choice | On, cannot be switched off |
| Analytics | Google Analytics 4; campaign tags kept for the browser session | Off |
| Insights | Microsoft Clarity heatmaps; A/B tests | Off |

What that means for each tool:

| Tool | Loads when | Before that |
| --- | --- | --- |
| Google Analytics 4 | Analytics consent is given and `PUBLIC_GA4_ID` has a value | No request to Google. Consent Mode v2 starts with every signal denied |
| Microsoft Clarity | Insights consent is given and `PUBLIC_CLARITY_ID` has a value | No request to Microsoft |
| A/B tests | Insights consent is given and the experiment is active | Every visitor sees the control text; nothing is stored |
| Campaign tags | Read from the address on every page; kept for the session after Analytics consent | Values from the current address still travel with an enquiry sent from that page; nothing is stored |
| Search Console tag | Whenever `PUBLIC_GSC_VERIFICATION` has a value | It is a meta tag; it stores nothing and contacts nobody |
| Web3Forms | The moment a visitor sends the form | No request. The privacy notice covers the transfer |

Before consent the site makes no request to any other host. Fonts, scripts and films are all served from the site itself. When a visitor withdraws consent, Google Analytics and Clarity are stopped, their cookies are cleared and stored A/B assignments are removed.

To prove the gate after a deploy: open the live site in a private window with DevTools on the Network tab, leave the banner unanswered and reload. Every request in the list should go to `viaclin.com`.

## Conversion events

Every event goes to GA4 when Analytics consent exists. Clarity receives the event name when Insights consent exists.

| Event | Fires when | Parameters |
| --- | --- | --- |
| `cta_click` | A visitor clicks any element that carries `data-track="cta_click"` | `place` |
| `modal_open` | The contact dialog or the search dialog opens | `place`, `topic` |
| `form_start` | First keystroke in a contact form | `form`: `dialog` or `page` |
| `form_submit` | A form passes validation and is sent | `form`, `stage` |
| `generate_lead` | The form service confirms delivery. This is the conversion | `stage` |
| `video_toggle` | A visitor pauses or plays a film | `film`, `state` |
| `search` | A site search returns | `search_term`, `results` |
| `experiment_exposure` | A visitor is shown a variant of an active experiment | `experiment`, `variant` |

To track a new element, add two attributes. Any `data-track-*` attribute becomes an event parameter:

```html
<a class="btn btn--primary js-convo" href="/contact" data-track="cta_click" data-track-place="method-band">Start a conversation</a>
```

From script, import the helper:

```ts
import { track } from '../scripts/analytics';
track('cta_click', { place: 'method-band' });
```

The funnel to watch in GA4 is `cta_click`, `modal_open`, `form_start`, `form_submit`, `generate_lead`. A large drop between two steps shows where the form loses people.

## Campaign links: the UTM naming convention

Tag every link that the company places somewhere else: LinkedIn posts, email signatures, newsletters, partner sites, event pages. Never tag a link inside the site itself, because that restarts the session in GA4 and breaks attribution.

Rules: lower case, hyphens between words, no spaces, no capitals, no underscores inside a value. Three tags are required.

| Tag | Answers | Examples |
| --- | --- | --- |
| `utm_source` | Where the link sits | `linkedin`, `newsletter`, `email-signature`, `partner-name`, `google` |
| `utm_medium` | What kind of channel it is | `social`, `email`, `referral`, `cpc`, `event` |
| `utm_campaign` | Which push it belongs to: year, quarter or month, topic | `2026-q4-close-out`, `2026-11-launch`, `always-on` |
| `utm_content` (optional) | Which version of the creative | `carousel`, `text-post`, `footer-link` |
| `utm_term` (optional) | The paid search keyword | `clinical-supply-consultancy` |

```
https://viaclin.com/services/trial-close-out?utm_source=linkedin&utm_medium=social&utm_campaign=2026-q4-close-out&utm_content=carousel
```

The site also reads `gclid` and `msclkid` from paid clicks, and records the landing page. The first set of values in a session wins. They travel with the enquiry as hidden fields, so each email from the form shows which campaign brought the visitor. Keep one shared sheet of campaign names so that two people never invent two spellings for the same push.

## Run an A/B test

The helper swaps the text of an element. It suits headlines, button labels and short lines. One test per page at a time.

1. Write down the hypothesis and the measure before starting. For most tests the measure is `generate_lead`.
2. In the markup, mark the element with the experiment key and give each variant its text. The text already in the markup is the control:

   ```html
   <a class="btn btn--primary js-convo" href="/contact" data-ab="hero-cta" data-ab-operator="Talk to a senior operator">Start a conversation</a>
   ```

3. In `src/data/experiments.ts`, add the experiment or switch it on. The first variant is the control. `weights` is optional; leave it out for an even split:

   ```ts
   { key: 'hero-cta', active: true, variants: ['control', 'operator'] }
   ```

4. Run `npm run qa`. The copy QA reads every `data-ab-*` value, so variant text obeys the house rules too. Build and deploy.
5. A visitor is assigned a variant once Insights consent exists. The assignment is kept in the browser under `viaclin-ab` for 90 days, so the same person sees the same text on every visit. Without consent the visitor sees the control.
6. Each assignment sends `experiment_exposure` with `experiment` and `variant` to GA4, and labels the Clarity session as `experiment_hero-cta`, so heatmaps and recordings can be filtered by variant.
7. Read the result in GA4 under Explore: a free-form exploration with `variant` as the row, users who triggered `experiment_exposure` as one column and `generate_lead` as the other. Let the test run until each variant has a few hundred exposed visitors; with business-to-business traffic that can take weeks. A small difference on a small sample is noise.
8. To finish, set `active: false`, put the winning text into the markup and remove the `data-ab` attributes.

## Company details in site.ts

Every company fact on the site comes from `src/data/site.ts`. Three values are waiting for the owner:

```ts
croNumber: '',          // company number from the CRO certificate, for example '123456'
registeredOffice: '',   // registered office as filed with the CRO, on one line
linkedin: '',           // full URL of the company page: 'https://www.linkedin.com/company/...'
```

- An empty value renders nothing. No placeholder text ever reaches a page, so the site is safe to deploy while a value is open.
- `croNumber` and `registeredOffice` show in the footer, on `/legal`, `/privacy` and `/terms`, and in the structured data. Irish company law expects both on a company website, so `npm run launch-check` lists them as blockers.
- `linkedin` shows in the footer, on `/contact` and in the structured data. Use the company page, never a personal profile.
- Never type a guess. Copy each value from the CRO record.
- The same file holds `enquiryRetention`, `sisterBrand.url` and the `legalDraft` flag. "Before launch", under the launch checklist, covers all three.
- When a legal page changes, move `legalUpdated` in the same file to the new date.

After an edit, run `npm run launch-check` and `npm run build`.

## Add a genuine client quote

The site carries no testimonials at launch, and it never carries an invented one. A made-up, paraphrased or merged quote is a false claim, and EU consumer law treats fake reviews as an unfair commercial practice. When a client offers real words:

1. Get permission in writing. An email that approves the exact wording and the attribution is enough. File it.
2. Agree the attribution with the client: name, role and company, or a description such as "Head of Clinical Supply, European biotech" when the client cannot be named.
3. Use the client's own words. Trim for length with their sign-off; do not rewrite. If the wording trips the copy QA, ask the client to approve a version that passes.
4. Add the quote as data, for example `src/data/quotes.ts` with `quote`, `name`, `role`, `company` and `approvedOn`, and render it with a `<figure>`, `<blockquote>` and `<figcaption>` on the service page it relates to.
5. No star ratings and no review markup in the structured data. Google does not accept review markup that a company publishes about itself.
6. If the client withdraws permission, remove the quote the same day.

## House rules for copy

These apply to every line: page copy, alt text, meta descriptions, error messages and code comments. `npm run qa` enforces the first three and the personal-reference rule; section 0 of the specification has the full list.

- No em dash and no en dash. Use a comma, a colon, a full stop, or the word "to" for ranges.
- No adverbs ending in "ly". The exemption list sits at the top of `scripts/copy-qa.mjs`.
- No business jargon. The banned list sits at the top of `scripts/copy-qa.mjs`.
- British spelling, sentence case, no all-caps text, no middle-dot separators, no arrows on link text.
- The site speaks as the company. No personal background or past employers of anyone behind it.
- No prices, no day rates.
- No phone number. The contact address is info@viaclin.com.
- Never invent a legal or company value.

## Speed testing

Before a deploy:

1. `npm run build`, then `npm run preview`.
2. Open `http://localhost:4321` in a private Chrome window, so extensions cannot distort the result.
3. Open DevTools, then the Lighthouse panel. Pick Mobile and all four categories, then run the report. Run it three times and take the middle score.
4. Test `/` and one service page, such as `/services/supply-chain-consultancy`. Test once with the cookie banner unanswered and once after "Accept all", because analytics scripts add weight.

After a deploy, run the live URL through `https://pagespeed.web.dev`. Once the site has enough traffic, the same page shows field data from real visits, which matters more than any lab score.

| Measure | Target |
| --- | --- |
| Accessibility, Best Practices, SEO | 95 or above on every page |
| Performance, home page with footage | 90 or above |
| Performance, a service page | 95 or above |
| Largest Contentful Paint, throttled mobile | under 2.0 seconds |
| Cumulative Layout Shift | 0 |

If a score drops, look here first: a poster image in `public/video` that has grown, a film that lost `preload="none"`, a font that is no longer preloaded, an image without `width` and `height`, or a third-party script that loads before consent.

## QA commands

**`npm run qa`** reads `src/pages`, `src/components`, `src/layouts`, `src/data`, the text, HTML and manifest files in `public`, this README and `.env.example`. In `src/scripts` it reads comments and any string a visitor could see, such as an error message; in `src/styles` and `scripts` it reads comments. The dash check covers every one of those files in full. Dashes, adverbs ending in "ly", jargon and filler, and personal references all fail the run. American spellings, square-bracket placeholders, middle dots and arrows print as warnings. Each hit shows the file, the line, the offence and where it sat (text, attribute, string or comment). To allow a new proper noun or code term, add it to the right list at the top of `scripts/copy-qa.mjs` with a comment that names the page. To check one file, or to see what the script reads from it:

```
node scripts/copy-qa.mjs --file src/pages/index.astro
node scripts/copy-qa.mjs --dump src/pages/index.astro
```

**`npm run qa:links`** needs a build. It reads every HTML file in `dist`, resolves each `href`, `src`, `poster`, `srcset`, `data-src-lg` and `data-src-sm` with the clean URL rules Vercel uses, checks that each `#fragment` matches an id in the target page, checks email links, and treats the redirect sources in `vercel.json` as valid. A broken internal link fails the run. External links are listed; add `-- --external` to request each one.

**`npm run qa:visual`** needs a running server: `npm run dev`, or better, `npm run preview` after a build. It visits every route at 1440, 768 and 390 px in both themes, scrolls each page so lazy media loads, and fails on sideways overflow, a console error, a page error or a missing page. Full-page screenshots land in `qa/`, which git ignores. Routes come from `dist` when a build exists, otherwise from the list inside the script.

**`npm run qa:a11y`** needs a running server too. It runs axe-core with the WCAG 2.0, 2.1 and 2.2 A and AA rule sets on every route, at 1440 and 390 px, in both themes. Serious and critical violations fail the run; each one prints with its rule id, impact, node count and first three targets. axe cannot judge contrast for text over footage or glass, so it reports a count of such nodes to check by eye.

Flags for both browser scripts, after `--`:

| Flag | Effect |
| --- | --- |
| `--all` | Use the route list inside the script even when `dist` exists |
| `--routes=home,contact,services/trial-close-out` | Test chosen routes; `home` means `/` |
| `--verbose` | Print each view as it finishes |
| `--motion` | Visual QA alone: leave animation on |
| `--no-banner` | Visual QA alone: store a "reject all" choice first, so the cookie banner stays out of the screenshots |

Both read the server address from `BASE`, with `http://127.0.0.1:4321` as the default. In PowerShell: `$env:BASE = 'http://localhost:4321'; npm run qa:visual`.

**`npm run launch-check`** reads `src/data/site.ts`, `.env`, the process environment, `public` and `dist`, and sorts what it finds into blockers, advice and items in place. It exits with code 0 unless `-- --strict` is passed while a blocker is open.

A sound order before a release: `npm run qa`, `npm run build`, `npm run qa:links`, `npm run preview` in a second terminal, `npm run qa:visual`, `npm run qa:a11y`, `npm run launch-check`.

## Deploy to Vercel

The owner carries out these steps; the repository is ready for them.

1. Push the repository to GitHub under the owner's account.
2. In Vercel choose New Project and import the repository. Framework preset: Astro. Build command: `npm run build`. Output directory: `dist`. Add the four environment variables from the table above; any of them can wait.
3. Deploy. Check the preview URL against the launch checklist below.
4. Add the domains `viaclin.com` and `www.viaclin.com` in Vercel. Set `www` to redirect to the apex.
5. At the registrar, add the DNS records Vercel shows: an A record for the apex and a CNAME for `www`. Leave the MX, SPF, DKIM and DMARC records for Google Workspace untouched, or email stops.
6. Wait for the certificate to issue, then load `https://viaclin.com` and run Lighthouse once more.
7. Retire the old single-file site. Do not share the old-identity video after this point.

`vercel.json` already sets clean URLs, security headers, a long cache life for `/_astro`, a one-day cache for `/video` (those file names carry no content hash), a noindex header for the files under `/brand`, and a redirect from `/services` to the services section of the home page. Vercel picks the Node version from `engines` in `package.json`.

## Launch checklist

### Before launch

`npm run launch-check` reports five confirmations that the owner alone can give:

- The retention period for enquiries: set `enquiryRetention` in `src/data/site.ts`, for example `'24 months'`. While it is empty the privacy notice gives no period, so the check lists it as a blocker.
- The SupplyAI web address: set `sisterBrand.url` in `src/data/site.ts`. While it is empty nothing links to SupplyAI. The address on the previous site now serves a parking page.
- The legal draft flag: legal pages show the line "Draft for solicitor review" while `legalDraft` is `true`. Set it to `false` once a solicitor has reviewed them.
- The regulatory position: confirm that the paragraph on `/legal` matches the company's licences and partners.
- The form provider agreement: confirm a data processing agreement with Web3Forms, or the form provider you choose, and note which transfer safeguard it relies on.

### Checks

- [ ] `npm run qa` passes
- [ ] `npm run build` passes
- [ ] `npm run qa:links`, `npm run qa:visual` and `npm run qa:a11y` pass against `npm run preview`
- [ ] `npm run launch-check` shows no blocker: company number, registered office, enquiry retention period and Web3Forms key are in
- [ ] The five owner confirmations under "Before launch" are closed
- [ ] LinkedIn company page URL is in `site.ts`, or the owner accepts launching without it
- [ ] A solicitor has read `/privacy`, `/terms`, `/cookies`, `/accessibility` and `/legal`, and `legalUpdated` carries the right date
- [ ] Professional indemnity insurance is in place
- [ ] A test enquiry from the live site arrives at info@viaclin.com and the thanks message shows
- [ ] With the banner unanswered, the Network tab shows requests to `viaclin.com` alone
- [ ] "Accept all", "Reject all" and "Choose" each work, and "Cookie settings" in the footer reopens the dialog
- [ ] After "Accept all", the GA4 Realtime report shows the visit
- [ ] Search Console is verified and `sitemap-index.xml` is submitted
- [ ] The share image previews well in the LinkedIn Post Inspector
- [ ] An unknown address such as `/nothing-here` shows the custom 404 page
- [ ] Lighthouse meets the targets on `/` and on one service page
- [ ] Both themes look right on a phone and on a laptop
