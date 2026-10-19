import type { ScreenQuad } from './types';

/** Project the actual four screen corners, including perspective, into a CSS plane. */
export function displayMatrix(quad: ScreenQuad, width = 1600, height = 1000) {
  const [[x0,y0],[x1,y1],[x2,y2],[x3,y3]] = quad;
  const dx1=x1-x2, dx2=x3-x2, dx3=x0-x1+x2-x3;
  const dy1=y1-y2, dy2=y3-y2, dy3=y0-y1+y2-y3;
  const determinant=dx1*dy2-dx2*dy1;
  if(Math.abs(determinant)<.00001) return null;
  const g=(dx3*dy2-dx2*dy3)/determinant;
  const h=(dx1*dy3-dx3*dy1)/determinant;
  const a=x1-x0+g*x1, b=x3-x0+h*x3;
  const d=y1-y0+g*y1, e=y3-y0+h*y3;
  return `matrix3d(${a/width},${d/width},0,${g/width},${b/height},${e/height},0,${h/height},0,0,1,0,${x0},${y0},0,1)`;
}
