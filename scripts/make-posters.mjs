// Writes a WebP beside every film poster in public/video, so the markup can offer the smaller
// format first and fall back to the JPEG. A poster whose WebP is newer than its JPEG is skipped.
// Run with: npm run posters
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const dir = path.join(process.cwd(), 'public', 'video');
const QUALITY = 72;

const size = (bytes) => `${(bytes / 1024).toFixed(1)} kB`;
const pad = (text, width) => String(text).padEnd(width);

const posters = (await readdir(dir)).filter((name) => name.endsWith('.jpg')).sort();
if (!posters.length) {
  console.log(`No posters found in ${dir}`);
  process.exit(0);
}

const rows = [];

for (const name of posters) {
  const from = path.join(dir, name);
  const to = from.replace(/\.jpg$/, '.webp');
  const source = await stat(from);

  let current = false;
  try {
    const target = await stat(to);
    current = target.mtimeMs >= source.mtimeMs;
  } catch {
    current = false;
  }

  if (!current) await sharp(from).webp({ quality: QUALITY }).toFile(to);
  const written = await stat(to);

  rows.push({
    poster: name.replace(/\.jpg$/, ''),
    jpg: source.size,
    webp: written.size,
    cut: 1 - written.size / source.size,
    state: current ? 'up to date' : 'written',
  });
}

const totals = rows.reduce((sum, row) => ({ jpg: sum.jpg + row.jpg, webp: sum.webp + row.webp }), { jpg: 0, webp: 0 });

console.log(`${pad('poster', 18)}${pad('jpg', 11)}${pad('webp', 11)}${pad('saved', 8)}state`);
for (const row of rows) {
  console.log(
    `${pad(row.poster, 18)}${pad(size(row.jpg), 11)}${pad(size(row.webp), 11)}${pad(`${Math.round(row.cut * 100)}%`, 8)}${row.state}`,
  );
}
console.log(
  `${pad('total', 18)}${pad(size(totals.jpg), 11)}${pad(size(totals.webp), 11)}${pad(
    `${Math.round((1 - totals.webp / totals.jpg) * 100)}%`,
    8,
  )}${rows.length} posters at quality ${QUALITY}`,
);
