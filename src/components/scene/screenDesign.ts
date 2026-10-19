/** Shared vector artwork keeps the WebGL display and HTML continuation identical. */
type Gradient = {
  id: string;
  from: readonly [number, number];
  to: readonly [number, number];
  stops: readonly (readonly [number, string])[];
};

export const screenArtwork = {
  gradients: [
    {
      id: 'rear-plane', from: [1036, 170], to: [619, 490],
      stops: [[0, '#142535'], [.5, '#0b1926'], [1, '#06101b']],
    },
    {
      id: 'fold-plane', from: [487, 268], to: [541, 325],
      stops: [[0, '#0a1722'], [.55, '#233746'], [.85, '#536975'], [1, '#a6b6bf']],
    },
    {
      id: 'near-plane', from: [519, 490], to: [1076, 188],
      stops: [[0, '#1b3343'], [.44, '#102230'], [1, '#07111c']],
    },
    {
      id: 'aperture', from: [229, 490], to: [752, 126],
      stops: [[0, '#93aebd'], [.33, '#e0e8eb'], [.72, '#f3f5f4'], [1, '#bacbd5']],
    },
    {
      id: 'top-bevel', from: [750, 126], to: [1247, 211],
      stops: [[0, '#546876'], [.4, '#253c4d'], [1, '#101f2b']],
    },
  ] satisfies Gradient[],
  paths: [
    { d: 'M750 126 1247 211 1068 490H229Z', fill: 'rear-plane' },
    { d: 'M168 490 685 126H750L229 490Z', fill: 'fold-plane' },
    { d: 'M750 126 1124 291 1068 490H229Z', fill: 'near-plane' },
    { d: 'M750 126 1247 211 1242 216 747 130Z', fill: 'top-bevel' },
    { d: 'M224 490 745 126H750L235 490Z', fill: 'aperture' },
  ],
} as const;

export const screenArtworkSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000"><defs>${screenArtwork.gradients.map(gradient => `<linearGradient id="${gradient.id}" gradientUnits="userSpaceOnUse" x1="${gradient.from[0]}" y1="${gradient.from[1]}" x2="${gradient.to[0]}" y2="${gradient.to[1]}">${gradient.stops.map(([offset, color]) => `<stop offset="${offset}" stop-color="${color}"/>`).join('')}</linearGradient>`).join('')}</defs>${screenArtwork.paths.map(path => `<path d="${path.d}" fill="url(#${path.fill})"/>`).join('')}</svg>`;

/** Design-space values shared by the WebGL display and its HTML continuation. */
export const screenDesign = {
  width: 1600,
  height: 1000,
  backgroundStart: '#07121e',
  backgroundEnd: '#030810',
  backgroundAngle: '122.005383deg',
  textLeft: 112,
  textTop: 574,
  fontSize: 100,
  lineHeight: 114,
  tracking: -4.2,
  firstLine: '#f1f3f5',
  secondLine: '#d5dfe5',
  lineLeft: 112,
  lineTop: 490,
  lineWidth: 1376,
  lineHeightPx: 1.5,
  lineStops: [
    [0, 'rgba(178,207,222,0)'],
    [.085, 'rgba(226,237,241,.74)'],
    [.28, 'rgba(178,207,222,.30)'],
    [.62, 'rgba(178,207,222,.15)'],
    [1, 'rgba(178,207,222,0)'],
  ] as const,
} as const;

/** CSS custom properties avoid two independent versions of the screen artwork. */
export const screenCssVariables = {
  '--screen-background': `url("data:image/svg+xml,${encodeURIComponent(screenArtworkSvg)}") 0 0 / 100% 100% no-repeat, linear-gradient(${screenDesign.backgroundAngle},${screenDesign.backgroundStart},${screenDesign.backgroundEnd})`,
  '--screen-text-left': `${screenDesign.textLeft}px`,
  '--screen-text-top': `${screenDesign.textTop}px`,
  '--screen-font-size': `${screenDesign.fontSize}px`,
  '--screen-line-height': `${screenDesign.lineHeight}px`,
  '--screen-tracking': `${screenDesign.tracking}px`,
  '--screen-first-line': screenDesign.firstLine,
  '--screen-second-line': screenDesign.secondLine,
  '--screen-line-left': `${screenDesign.lineLeft}px`,
  '--screen-line-top': `${screenDesign.lineTop}px`,
  '--screen-line-width': `${screenDesign.lineWidth}px`,
  '--screen-line-height-px': `${screenDesign.lineHeightPx}px`,
  '--screen-light-line': `linear-gradient(90deg,${screenDesign.lineStops.map(([at, color]) => `${color} ${at * 100}%`).join(',')})`,
};
