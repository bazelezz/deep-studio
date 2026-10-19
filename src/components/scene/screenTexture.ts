import { CanvasTexture, SRGBColorSpace } from 'three';
import { siteConfig } from '@/config/site';
import { screenArtwork, screenDesign as design } from './screenDesign';

/** Quiet display artwork, with the exact same design coordinates as the HTML. */
export function createScreenTexture(blank = false) {
  const canvas = document.createElement('canvas');
  canvas.width = design.width;
  canvas.height = design.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D unavailable');

  const gradient = context.createLinearGradient(0, 0, design.width, design.height);
  gradient.addColorStop(0, design.backgroundStart);
  gradient.addColorStop(1, design.backgroundEnd);
  context.fillStyle = gradient;
  context.fillRect(0, 0, design.width, design.height);
  if (blank) {
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
  }

  // The HTML background is generated from these same paths and gradients.
  // Drawing them here is synchronous: no image request can delay the first frame.
  const artworkGradients = new Map<string, CanvasGradient>();
  screenArtwork.gradients.forEach(item => {
    const fill = context.createLinearGradient(...item.from, ...item.to);
    item.stops.forEach(([offset, color]) => fill.addColorStop(offset, color));
    artworkGradients.set(item.id, fill);
  });
  screenArtwork.paths.forEach(item => {
    context.fillStyle = artworkGradients.get(item.fill)!;
    context.fill(new Path2D(item.d));
  });

  context.font = `400 ${design.fontSize}px "Onest Variable", sans-serif`;
  context.letterSpacing = `${design.tracking}px`;
  siteConfig.screen.lines.forEach((text, index) => {
    // CSS centers the font's em box inside each line box. Use the actual loaded
    // font metrics so the Canvas baseline does not jump during the DOM handoff.
    const metrics = context.measureText(text);
    const ascent = metrics.fontBoundingBoxAscent ?? design.fontSize * .8;
    const descent = metrics.fontBoundingBoxDescent ?? design.fontSize * .2;
    const top = design.textTop + index * design.lineHeight;
    const baseline = top + (design.lineHeight - ascent - descent) / 2 + ascent;
    context.fillStyle = index === 0 ? design.firstLine : design.secondLine;
    context.fillText(text, design.textLeft, baseline);
  });

  const light = context.createLinearGradient(design.lineLeft, 0, design.lineLeft + design.lineWidth, 0);
  design.lineStops.forEach(([position, color]) => light.addColorStop(position, color));
  context.fillStyle = light;
  context.fillRect(design.lineLeft, design.lineTop, design.lineWidth, design.lineHeightPx);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 2;
  return texture;
}

/** A tight contact core and a low-density penumbra under the physical footprint. */
export function createContactTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D unavailable');
  const pixels = context.createImageData(size, size);
  const halfWidth = size * .366;
  const halfHeight = size * .365;
  const radius = size * .025;
  const contactSoftness = size * .017;
  const penumbraSoftness = size * .064;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const qx = Math.abs(x - size / 2) - halfWidth + radius;
      const qy = Math.abs(y - size / 2) - halfHeight + radius;
      const distance = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
      const outside = Math.max(distance, 0);
      // Most of the dark core sits below the hull. Only a short soft edge is
      // visible, with a broader, faint shadow that anchors it to the studio floor.
      const contact = .58 * Math.exp(-(outside * outside) / (2 * contactSoftness * contactSoftness));
      const penumbra = .22 * Math.exp(-(outside * outside) / (2 * penumbraSoftness * penumbraSoftness));
      const alpha = contact + penumbra;
      pixels.data[(y * size + x) * 4 + 3] = Math.round(alpha * 255);
    }
  }
  context.putImageData(pixels, 0, 0);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
