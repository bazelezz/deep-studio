import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// Canonical vector outlines feed both the inline website logo and these assets.
const artwork = JSON.parse(await fs.readFile(new URL('../src/config/brandArtwork.json', import.meta.url), 'utf8'));
const output = new URL('../public/brand/', import.meta.url);
await fs.mkdir(output, { recursive: true });
const symbolPaths = artwork.symbol.paths.map(d => `<path d="${d}"/>`).join('');
const wordmarkPaths = artwork.paths.map(d => `<path fill-rule="evenodd" d="${d}"/>`).join('');
const paths = `${symbolPaths}<g transform="${artwork.wordmarkTransform}">${wordmarkPaths}</g>`;
const svg = color => `<svg xmlns="http://www.w3.org/2000/svg" width="${artwork.width}" height="${artwork.height}" viewBox="0 0 ${artwork.width} ${artwork.height}" fill="${color}"><title>DEEP</title>${paths}</svg>`;

for (const [name, color] of [['light', artwork.light], ['dark', artwork.dark]]) {
  const source = svg(color);
  await fs.writeFile(new URL(name === 'light' ? 'deep-logo.svg' : 'deep-logo-dark.svg', output), source);
  await sharp(Buffer.from(source), { density: 1080 }).resize(2400, 960).png().toFile(fileURLToPath(new URL(`deep-logo-${name}.png`, output)));
  const symbolSource = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="${color}"><title>DEEP — Проём</title>${symbolPaths}</svg>`;
  await sharp(Buffer.from(symbolSource), { density: 1152 }).resize(1024, 1024).png().toFile(fileURLToPath(new URL(`deep-symbol-${name}.png`, output)));
}

const symbol = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="${artwork.light}"><title>DEEP — Проём</title>${symbolPaths}</svg>`;
await fs.writeFile(new URL('deep-symbol.svg', output), symbol);
const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="13" fill="${artwork.background}"/><g transform="translate(4 4) scale(.875)" fill="${artwork.light}">${symbolPaths}</g></svg>`;
await fs.writeFile(new URL('../src/app/icon.svg', import.meta.url), icon);

const presentation = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080"><rect width="1920" height="1080" fill="${artwork.background}"/><g transform="translate(560 380) scale(5)" fill="${artwork.light}">${paths}</g></svg>`;
await sharp(Buffer.from(presentation)).png().toFile(fileURLToPath(new URL('deep-logo-preview.png', output)));
console.log('Exported SVG, 2400×960 logo PNGs, 1024×1024 symbol PNGs, 1920×1080 presentation PNG and favicon.');
