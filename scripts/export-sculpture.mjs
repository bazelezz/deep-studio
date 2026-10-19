import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import sharp from 'sharp';

// Export the exact current hero artwork, not the older raster sculpture asset.
// Reading the actual JSX keeps gradients, facets and the silhouette in sync.
const sourceUrl = new URL('../src/components/DisplaySite.tsx', import.meta.url);
const source = await fs.readFile(sourceUrl, 'utf8');
const parsed = ts.createSourceFile('DisplaySite.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const artwork = JSON.parse(await fs.readFile(new URL('../src/config/brandArtwork.json', import.meta.url), 'utf8'));
const matches = { defs: [], symbol: [] };
function visit(node) {
  if (ts.isJsxElement(node)) {
    const tag = node.openingElement.tagName.getText(parsed);
    if (tag === 'defs') matches.defs.push(node);
    if (tag === 'g') {
      const transform = node.openingElement.attributes.properties.find(attribute =>
        ts.isJsxAttribute(attribute) && attribute.name.getText(parsed) === 'transform');
      if (transform?.initializer && ts.isStringLiteral(transform.initializer) &&
        transform.initializer.text === 'translate(82 82) scale(9.1) skewY(-8)') matches.symbol.push(node);
    }
  }
  ts.forEachChild(node, visit);
}
visit(parsed);
if (matches.defs.length !== 1 || matches.symbol.length !== 1) {
  throw new Error('The hero artwork structure changed; select its current defs and symbol group before exporting.');
}
const jsx = `const element = <svg xmlns="http://www.w3.org/2000/svg" width="820" height="850" viewBox="0 0 820 850" fill="none">${matches.defs[0].getText(parsed)}${matches.symbol[0].getText(parsed)}</svg>;`;
const compiled = ts.transpileModule(jsx, {
  compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  fileName: 'sculpture-export.tsx',
}).outputText;
// Only local, project-owned JSX is evaluated, with its two explicit dependencies.
const element = new Function('React', 'artwork', `${compiled}\nreturn element;`)(React, artwork);
const svg = renderToStaticMarkup(element);
const output = new URL('../public/brand/', import.meta.url);
await fs.mkdir(output, { recursive: true });

const raster = await sharp(Buffer.from(svg), { density: 300 }).ensureAlpha().png().toBuffer();
const trimmed = await sharp(raster).trim({ threshold: 0 }).png().toBuffer();
const transparent = await sharp(trimmed)
  .resize(2160, 2160, { fit: 'contain', background: '#00000000' })
  .extend({ top: 120, bottom: 120, left: 120, right: 120, background: '#00000000' })
  .png({ compressionLevel: 9 }).toBuffer();
await fs.writeFile(new URL('deep-symbol-3d.png', output), transparent);
await sharp(transparent).flatten({ background: artwork.background }).png({ compressionLevel: 9 })
  .toFile(fileURLToPath(new URL('deep-symbol-3d-dark.png', output)));

for (const filename of ['deep-symbol-3d.png', 'deep-symbol-3d-dark.png']) {
  const metadata = await sharp(fileURLToPath(new URL(filename, output))).metadata();
  const stats = await sharp(fileURLToPath(new URL(filename, output))).stats();
  console.log(JSON.stringify({ filename, width: metadata.width, height: metadata.height,
    hasAlpha: metadata.hasAlpha, channels: metadata.channels, isOpaque: stats.isOpaque }));
}
