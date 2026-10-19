import { PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { LAPTOP } from './LaptopModel';

const axis = new Vector3(1, 0, 0);
const hinge = new Vector3(0, LAPTOP.hingeY, LAPTOP.hingeZ);
const screenCenter = new Vector3(0, LAPTOP.screenY, LAPTOP.screenZ)
  .applyAxisAngle(axis, LAPTOP.angle).add(hinge);
const screenCorners: Vector3[] = [];
for (const x of [-1, 1]) for (const z of [-1, 1]) {
  screenCorners.push(new Vector3(x * LAPTOP.screenWidth / 2, LAPTOP.screenY, LAPTOP.screenZ + z * LAPTOP.screenHeight / 2)
    .applyAxisAngle(axis, LAPTOP.angle).add(hinge));
}
const bodyCorners: Vector3[] = [];
for (const x of [-3.2, 3.2]) for (const z of [-2.08, 2.08]) for (const y of [0, LAPTOP.baseTop]) bodyCorners.push(new Vector3(x, y, z));
for (const x of [-3.2, 3.2]) for (const z of [0, 4.16]) for (const y of [-.02, .05]) bodyCorners.push(new Vector3(x, y, z).applyAxisAngle(axis, LAPTOP.angle).add(hinge));

// Open display normal and optical axis coincide. No skew, orbit or late correction.
const yaw = 0;
const pitch = 18 * Math.PI / 180;
const direction = new Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
const studioTarget = new Vector3(0, 1.5, -.6);
const point = new Vector3();
interface CameraFit {
  width: number;
  height: number;
  start: Vector3;
  end: Vector3;
  orientation: Quaternion;
  startOffset: [number, number];
  endOffset: [number, number];
}
const fits = new WeakMap<PerspectiveCamera, CameraFit>();

/** Fit once per viewport, then translate along a straight line with a fixed orientation. */
function createFit(camera: PerspectiveCamera, width: number, height: number): CameraFit {
  camera.clearViewOffset();
  camera.fov = 18;
  camera.aspect = width / height;
  camera.position.copy(studioTarget).add(direction);
  camera.lookAt(studioTarget);
  camera.updateProjectionMatrix();
  const orientation = camera.quaternion.clone();

  const bounds = (target: Vector3, corners: Vector3[], distance: number) => {
    camera.position.copy(target).addScaledVector(direction, distance);
    camera.updateMatrixWorld();
    let l = Infinity, r = -Infinity, t = Infinity, b = -Infinity;
    for (const corner of corners) {
      point.copy(corner).project(camera);
      const x = (point.x + 1) * width / 2, y = (1 - point.y) * height / 2;
      l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y);
    }
    return { l, r, t, b };
  };
  const fit = (target: Vector3, corners: Vector3[], wantedWidth: number, wantedHeight: number) => {
    // Every point remains in front of the near plane, including the tilted display's nearest corner.
    let low = camera.near + .25;
    for (const corner of corners) low = Math.max(low, point.copy(corner).sub(target).dot(direction) + camera.near + .25);
    let high = 150;
    for (let i = 0; i < 24; i++) {
      const distance = (low + high) / 2;
      const box = bounds(target, corners, distance);
      if (box.r - box.l > wantedWidth || box.b - box.t > wantedHeight) low = distance;
      else high = distance;
    }
    return bounds(target, corners, high);
  };

  const studio = fit(studioTarget, bodyCorners, width * (width < 680 ? .96 : .82), height * (width < 680 ? .70 : .76));
  const start = camera.position.clone();
  // Keep the whole physical display within Canvas. The common homography applied to
  // Canvas and HTML finishes the exact viewport fit without clipping sampled pixels.
  const display = fit(screenCenter, screenCorners, width * .995, height * .995);
  const end = camera.position.clone();
  return {
    width, height, start, end, orientation,
    startOffset: [(studio.l + studio.r) / 2 - width / 2, (studio.t + studio.b) / 2 - height * (width < 680 ? .49 : .48)],
    endOffset: [(display.l + display.r) / 2 - width / 2, (display.t + display.b) / 2 - height / 2],
  };
}

/** No orbit or device rotation: progress only dollies towards the open display. */
export function frameCinematicLaptop(camera: PerspectiveCamera, width: number, height: number, progress = 0) {
  let fit = fits.get(camera);
  if (!fit || fit.width !== width || fit.height !== height) {
    fit = createFit(camera, width, height);
    fits.set(camera, fit);
  }
  const travel = Math.max(0, Math.min(1, progress));
  camera.fov = 18;
  camera.aspect = width / height;
  camera.position.lerpVectors(fit.start, fit.end, travel);
  camera.quaternion.copy(fit.orientation);
  camera.setViewOffset(width, height,
    fit.startOffset[0] + (fit.endOffset[0] - fit.startOffset[0]) * travel,
    fit.startOffset[1] + (fit.endOffset[1] - fit.startOffset[1]) * travel,
    width, height);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}
