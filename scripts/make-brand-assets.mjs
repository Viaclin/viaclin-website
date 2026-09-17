// Builds the Viaclin brand material: icon set, web manifest, social images, logo PNG exports,
// email signature, letterhead and the logo pack.
// Run from the project root: node scripts/make-brand-assets.mjs
//
// Type is set in a browser (Playwright) so Noto Sans renders as it does on the site.
// Plain SVG to PNG work goes through sharp. Company facts and logo paths are read from src/data.
import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = (...parts) => path.join(root, 'public', ...parts);

/* ───────── sources of truth ───────── */

// site.ts reads import.meta.env, so it cannot be imported by Node. The facts are plain strings: read them as text.
const siteSource = await fs.readFile(path.join(root, 'src/data/site.ts'), 'utf8');
const fact = (key) => (siteSource.match(new RegExp(`\\b${key}:\\s*'([^']*)'`)) ?? [])[1] ?? '';
const site = {
  name: fact('name'),
  legalName: fact('legalName'),
  url: fact('url'),
  email: fact('email'),
  vat: fact('vat'),
  croNumber: fact('croNumber'),
  registeredOffice: fact('registeredOffice'),
  country: fact('country'),
  strapline: fact('strapline'),
  legalUpdated: fact('legalUpdated'),
};
const domain = site.url.replace(/^https?:\/\//, '');

// Same wording as the site footer. An empty value adds nothing to the line.
const companyLine = [
  `${site.legalName}, registered in ${site.country}${site.croNumber ? `, company number ${site.croNumber}` : ''}.`,
  site.registeredOffice ? `Registered office: ${site.registeredOffice}.` : '',
  site.vat ? `VAT number ${site.vat}.` : '',
].filter(Boolean).join(' ');

// logo.ts holds one object literal in JSON form.
const logoSource = await fs.readFile(path.join(root, 'src/data/logo.ts'), 'utf8');
const logo = JSON.parse(logoSource.slice(logoSource.indexOf('{'), logoSource.lastIndexOf('}') + 1));

// Palette, as in src/styles/tokens.css.
const c = {
  navy: '#0A2948',
  green: '#258253',
  greenDeep: '#1B6B43',
  greenLight: '#6ECB93',
  greenOnDark: '#2E9A64',
  slate: '#3D5166',
  quiet: '#5A6E83',
  mist: '#F2F6F9',
  line: '#D3DCE5',
  white: '#FFFFFF',
};

const colour = { ink: c.navy, green: c.green };
const reversed = { ink: c.white, green: c.greenOnDark };

/* ───────── SVG builders ───────── */

/** The logo as a standalone SVG string. `width` sets pixel dimensions for raster work. */
function logoSvg(variant, tones, width) {
  const art = logo[variant];
  const [, , w, h] = art.viewBox.split(' ').map(Number);
  const size = width ? ` width="${width}" height="${Math.round((width * h) / w)}"` : '';
  const ink = [art.word, art.desc].filter(Boolean).map((d) => `<path fill="${tones.ink}" d="${d}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${art.viewBox}"${size}><path fill="${tones.ink}" d="${art.navy}"/><path fill="${tones.green}" d="${art.green}"/>${ink}</svg>`;
}

// The mark spans x 1 to 346 and y 27 to 358 in logo units.
const markBox = { cx: 173.5, cy: 192.5 };

/** Square icon: the mark centred on a square of `unit` logo units. A larger unit means more padding. */
function iconSvg(size, unit, ground) {
  const x = markBox.cx - unit / 2;
  const y = markBox.cy - unit / 2;
  const plate = ground ? `<rect x="${x}" y="${y}" width="${unit}" height="${unit}" fill="${ground}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${x} ${y} ${unit} ${unit}">${plate}<path fill="${c.navy}" d="${logo.mark.navy}"/><path fill="${c.green}" d="${logo.mark.green}"/></svg>`;
}

/** Route motif: a line with nodes at equal spacing, and labels when given. Returns SVG markup of `width` by `height`. */
function routeSvg({ width, height, y, inset, nodes = 6, r = 9, stroke = 3, line, fill, ring, labels, labelTone, labelSize = 20 }) {
  const step = (width - inset * 2) / (nodes - 1);
  const xs = Array.from({ length: nodes }, (_, i) => inset + i * step);
  const dots = xs.map((x) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${ring}" stroke-width="${stroke}"/>`).join('');
  const text = labels
    ? xs.map((x, i) => {
        const anchor = i === 0 ? 'start' : i === nodes - 1 ? 'end' : 'middle';
        const dx = i === 0 ? -r : i === nodes - 1 ? r : 0;
        return `<text x="${x + dx}" y="${y + r + labelSize + 14}" text-anchor="${anchor}" font-family="Noto Sans" font-size="${labelSize}" font-weight="600" fill="${labelTone}">${labels[i]}</text>`;
      }).join('')
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><line x1="${inset}" y1="${y}" x2="${width - inset}" y2="${y}" stroke="${line}" stroke-width="${stroke}" stroke-linecap="round"/>${dots}${text}</svg>`;
}

const stops = ['Molecule', 'Manufacture', 'QP release', 'Depot', 'Site', 'Patient'];

/* ───────── HTML templates ───────── */

const fontFile = (weight) => path.join(root, `node_modules/@fontsource/noto-sans/files/noto-sans-latin-${weight}-normal.woff2`);
const fontFaces = (
  await Promise.all(
    [400, 600, 700].map(async (weight) => {
      const data = (await fs.readFile(fontFile(weight))).toString('base64');
      return `@font-face{font-family:"Noto Sans";font-weight:${weight};font-style:normal;src:url(data:font/woff2;base64,${data}) format("woff2");}`;
    }),
  )
).join('');

const shell = (title, css, body) => `<!doctype html><html lang="en-IE"><head><meta charset="utf-8"><title>${title}</title><style>${fontFaces}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision}
body{font-family:"Noto Sans",sans-serif;position:relative;overflow:hidden}
svg{display:block}
${css}</style></head><body>${body}</body></html>`;

// Open Graph image, 1200 by 630: lockup 520 px wide at 96 px margins, headline beneath, route along the bottom.
const ogHtml = shell(
  'Viaclin',
  `body{width:1200px;height:630px;background:${c.white}}
   .ghost{position:absolute;right:-190px;top:-70px;width:620px}
   .ghost svg{width:620px;height:auto}
   .lockup{position:absolute;left:96px;top:112px;width:520px}
   .lockup svg{width:520px;height:auto}
   h1{position:absolute;left:96px;top:296px;max-width:1008px;font-size:44px;font-weight:600;line-height:1.18;letter-spacing:-0.015em;color:${c.navy}}
   .route{position:absolute;left:0;bottom:84px}
   .edge{position:absolute;left:0;right:0;bottom:0;height:10px;background:${c.navy}}
   .edge::after{content:"";position:absolute;right:0;top:0;bottom:0;width:40%;background:${c.green}}`,
  `<div class="ghost">${logoSvg('mark', { ink: c.mist, green: c.mist })}</div>
   <div class="lockup">${logoSvg('lockup', colour)}</div>
   <h1>Supply chain ownership for life sciences.</h1>
   <div class="route">${routeSvg({ width: 1200, height: 40, y: 20, inset: 105, line: c.green, fill: c.green, ring: c.white })}</div>
   <div class="edge"></div>`,
);

// LinkedIn banner, 1584 by 396. The lower left stays clear: the profile picture sits there.
const bannerHtml = shell(
  'Viaclin',
  `body{width:1584px;height:396px;background:${c.navy};color:${c.white}}
   .glow{position:absolute;inset:0;background:radial-gradient(ellipse 46% 90% at 92% 0%,rgba(110,203,147,.22),transparent 62%),radial-gradient(ellipse 40% 70% at 30% 110%,rgba(37,130,83,.16),transparent 60%)}
   .lockup{position:absolute;right:96px;top:72px;width:270px}
   .lockup svg{width:270px;height:auto}
   h1{position:absolute;left:500px;top:64px;font-size:60px;font-weight:700;line-height:1.05;letter-spacing:-0.025em;white-space:nowrap}
   p{position:absolute;left:502px;top:146px;font-size:25px;font-weight:400;line-height:1.3;color:rgba(255,255,255,.84);white-space:nowrap}
   .route{position:absolute;left:491px;top:246px}`,
  `<div class="glow"></div>
   <div class="lockup">${logoSvg('lockup', reversed)}</div>
   <h1>${site.strapline}</h1>
   <p>Supply chain ownership for life sciences.</p>
   <div class="route">${routeSvg({ width: 1006, height: 110, y: 30, inset: 9, r: 9, line: 'rgba(255,255,255,.55)', fill: c.greenLight, ring: c.navy, labels: stops, labelTone: 'rgba(255,255,255,.8)', labelSize: 20 })}</div>`,
);

// Letterhead, A4. The same markup feeds the PDF and the PNG preview.
const letterheadHtml = shell(
  'Viaclin letterhead',
  `@page{size:A4;margin:0}
   body{width:210mm;height:297mm;background:${c.white};color:${c.slate}}
   .lockup{position:absolute;left:20mm;top:17mm;width:54mm}
   .lockup svg{width:54mm;height:auto}
   .foot{position:absolute;left:20mm;right:20mm;bottom:13mm}
   .foot svg{width:170mm;height:auto}
   .foot__row{display:flex;justify-content:space-between;align-items:baseline;gap:8mm;margin-top:2.6mm;font-size:8pt;line-height:1.5}
   .foot__row strong{font-weight:600;color:${c.navy}}
   .foot__row span + span{white-space:nowrap}`,
  `<div class="lockup">${logoSvg('lockup', colour)}</div>
   <div class="foot">
     ${routeSvg({ width: 1700, height: 60, y: 30, inset: 12, r: 10, stroke: 5, line: c.green, fill: c.green, ring: c.white })}
     <div class="foot__row"><span>${companyLine}</span><span><strong>${site.email}</strong>&nbsp;&nbsp;&nbsp;${domain}</span></div>
   </div>`,
);

// Email signature: tables, inline styles and a web-safe font stack, because mail apps drop everything else.
const sans = `'Segoe UI', Arial, Helvetica, sans-serif`;
const signatureHtml = `<!doctype html>
<html lang="en-IE">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Viaclin email signature</title>
</head>
<body style="margin:0;padding:32px 24px;background:${c.mist};font-family:${sans};color:${c.slate};">
<h1 style="margin:0 0 8px 0;font-size:22px;line-height:28px;color:${c.navy};">Viaclin email signature</h1>
<p style="margin:0 0 24px 0;max-width:560px;font-size:15px;line-height:23px;">Change the name and the role, select the signature inside the white panel, copy it, then paste it into the signature settings of your mail app. The logo loads from ${domain}.</p>
<div style="display:inline-block;padding:28px 32px;background:${c.white};border:1px solid ${c.line};border-radius:10px;">
<!-- signature starts -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:${sans};color:${c.slate};">
  <tr>
    <td valign="middle" bgcolor="${c.white}" style="padding:6px 20px 6px 0;background-color:${c.white};border-right:2px solid ${c.green};">
      <a href="${site.url}" style="text-decoration:none;"><img src="${site.url}/brand/logo/viaclin-lockup.png" width="168" height="35" alt="${site.name}" style="display:block;border:0;width:168px;height:35px;"></a>
    </td>
    <td valign="middle" style="padding:2px 0 2px 20px;">
      <p style="margin:0;font-size:16px;line-height:22px;font-weight:bold;color:${c.navy};">Your name</p>
      <p style="margin:0 0 6px 0;font-size:14px;line-height:20px;color:${c.slate};">Your role</p>
      <p style="margin:0;font-size:14px;line-height:20px;"><a href="mailto:${site.email}" style="color:${c.greenDeep};text-decoration:underline;">${site.email}</a></p>
      <p style="margin:0;font-size:14px;line-height:20px;"><a href="${site.url}" style="color:${c.greenDeep};text-decoration:underline;">${domain}</a></p>
    </td>
  </tr>
  <tr>
    <td colspan="2" style="padding:14px 0 0 0;font-size:11px;line-height:16px;color:${c.quiet};">${companyLine}</td>
  </tr>
</table>
<!-- signature ends -->
</div>
</body>
</html>
`;

/* ───────── output helpers ───────── */

const written = [];

async function save(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, data);
  written.push(file);
}

/** Flat artwork: an indexed palette keeps edges clean and files small. */
const flatPng = (input) => sharp(input).png({ palette: true, colours: 256, dither: 0, compressionLevel: 9, effort: 10 }).toBuffer();
/** Soft gradients band under a palette, so these keep full colour. */
const softPng = (input) => sharp(input).png({ compressionLevel: 9, adaptiveFiltering: true, effort: 10 }).toBuffer();

let browser;
async function openBrowser() {
  try {
    return await chromium.launch({ channel: 'msedge' });
  } catch {
    return chromium.launch();
  }
}

async function capture(html, width, height, scale = 1) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale });
  const page = await context.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const shot = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width, height } });
  await context.close();
  return shot;
}

/* ───────── zip (store and deflate, no extra dependency) ───────── */

function dosStamp(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return { date: ((y - 1980) << 9) | (m << 5) | d, time: 12 << 11 };
}

function zip(entries, iso) {
  const { date, time } = dosStamp(iso);
  const parts = [];
  const index = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const label = Buffer.from(name, 'utf8');
    const packed = zlib.deflateRawSync(data, { level: 9 });
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0);
    head.writeUInt16LE(20, 4);
    head.writeUInt16LE(0x0800, 6);
    head.writeUInt16LE(8, 8);
    head.writeUInt16LE(time, 10);
    head.writeUInt16LE(date, 12);
    head.writeUInt32LE(zlib.crc32(data), 14);
    head.writeUInt32LE(packed.length, 18);
    head.writeUInt32LE(data.length, 22);
    head.writeUInt16LE(label.length, 26);
    parts.push(head, label, packed);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    head.copy(entry, 8, 6, 30);
    entry.writeUInt32LE(offset, 42);
    index.push(entry, label);
    offset += head.length + label.length + packed.length;
  }
  const indexSize = index.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(indexSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, ...index, end]);
}

/* ───────── build ───────── */

async function build() {
  // 1. Favicon: the mark alone. The navy stroke turns white when the browser runs a dark scheme.
  const tight = 352;
  const fx = markBox.cx - tight / 2;
  const fy = markBox.cy - tight / 2;
  await save(
    pub('favicon.svg'),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${fx} ${fy} ${tight} ${tight}"><style>.i{fill:${c.navy}}.g{fill:${c.green}}@media (prefers-color-scheme:dark){.i{fill:${c.white}}.g{fill:${c.greenOnDark}}}</style><path class="i" d="${logo.mark.navy}"/><path class="g" d="${logo.mark.green}"/></svg>\n`,
  );

  // 2. Raster icons. 640 units keeps every corner of the mark inside the maskable safe zone (a circle of 40 per cent radius).
  await save(pub('favicon-32.png'), await flatPng(Buffer.from(iconSvg(32, tight, null))));
  await save(pub('apple-touch-icon.png'), await flatPng(Buffer.from(iconSvg(180, 580, c.white))));
  await save(pub('icon-192.png'), await flatPng(Buffer.from(iconSvg(192, 640, c.white))));
  await save(pub('icon-512.png'), await flatPng(Buffer.from(iconSvg(512, 640, c.white))));

  // 3. Web manifest.
  await save(
    pub('site.webmanifest'),
    `${JSON.stringify(
      {
        name: site.name,
        short_name: site.name,
        lang: 'en-IE',
        start_url: '/',
        display: 'browser',
        theme_color: c.navy,
        background_color: c.white,
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      null,
      2,
    )}\n`,
  );

  // 4. Open Graph image.
  await save(pub('og', 'viaclin-og.png'), await flatPng(await capture(ogHtml, 1200, 630)));

  // 5. Logo PNG exports: colour and reversed, 1x and 2x. Transparent grounds.
  const exportsList = [
    ['lockup', 880],
    ['compact', 880],
    ['mark', 256],
  ];
  for (const [variant, width] of exportsList) {
    for (const [suffix, tones] of [['', colour], ['-reversed', reversed]]) {
      for (const [scaleSuffix, scale] of [['', 1], ['-2x', 2]]) {
        const svg = Buffer.from(logoSvg(variant, tones, width * scale));
        await save(pub('brand', 'logo', `viaclin-${variant}${suffix}${scaleSuffix}.png`), await flatPng(svg));
      }
    }
  }

  // 6. LinkedIn banner.
  await save(pub('brand', 'viaclin-linkedin-banner.png'), await softPng(await capture(bannerHtml, 1584, 396)));

  // 7. Email signature, plus a preview image. The preview answers the live logo address from the local file.
  await save(pub('brand', 'viaclin-email-signature.html'), signatureHtml);
  {
    const context = await browser.newContext({ viewport: { width: 640, height: 300 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await page.route(`${site.url}/**`, (request) => request.fulfill({ path: pub('brand', 'logo', 'viaclin-lockup.png') }));
    const table = signatureHtml.slice(signatureHtml.indexOf('<table'), signatureHtml.indexOf('</table>') + 8);
    await page.setContent(`<body style="margin:0;padding:44px 48px;background:${c.white}">${table}</body>`, { waitUntil: 'networkidle' });
    const preview = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 640, height: 220 } });
    await save(pub('brand', 'viaclin-email-signature-preview.png'), await flatPng(preview));
    await context.close();
  }

  // 8. Letterhead: vector PDF, plus a PNG preview at 1.5 times screen scale.
  {
    const context = await browser.newContext({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 1.5 });
    const page = await context.newPage();
    await page.setContent(letterheadHtml, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await save(pub('brand', 'viaclin-letterhead.pdf'), await page.pdf({ format: 'A4', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } }));
    const preview = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 794, height: 1123 } });
    await save(pub('brand', 'viaclin-letterhead-preview.png'), await flatPng(preview));
    await context.close();
  }

  // 9. Logo pack: every SVG and PNG in public/brand/logo, zipped.
  {
    const folder = pub('brand', 'logo');
    const names = (await fs.readdir(folder)).filter((name) => /\.(svg|png)$/.test(name)).sort();
    const entries = await Promise.all(names.map(async (name) => ({ name: `viaclin-logo-pack/${name}`, data: await fs.readFile(path.join(folder, name)) })));
    await save(pub('brand', 'viaclin-logo-pack.zip'), zip(entries, site.legalUpdated || '2026-01-01'));
  }
}

// The browser closes whether the build passed or failed; a failure is thrown again once it has.
browser = await openBrowser();
let failure = null;
try {
  await build();
} catch (error) {
  failure = error;
}
await browser.close();
if (failure) throw failure;

/* ───────── report ───────── */

const rows = await Promise.all(
  written.map(async (file) => {
    const { size } = await fs.stat(file);
    return { file: path.relative(root, file).replaceAll('\\', '/'), size: size < 1024 ? `${size} B` : `${(size / 1024).toFixed(1)} KB` };
  }),
);
console.table(rows);
