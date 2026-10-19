import { PerspectiveCamera, Vector3 } from 'three';
import { LAPTOP } from './LaptopModel';

/** A fixed, long-lens product photograph. No orbit, model transform or pointer input. */
export function frameStillLaptop(camera: PerspectiveCamera, width: number, height: number) {
  const yaw = 8 * Math.PI / 180;
  const pitch = 18 * Math.PI / 180;
  const normal = new Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  const target = new Vector3(0, 1.5, -.6);
  const axis = new Vector3(1, 0, 0);
  const hinge = new Vector3(0, LAPTOP.hingeY, LAPTOP.hingeZ);
  const points: Vector3[] = [];
  for (const x of [-3.2, 3.2]) for (const z of [-2.08, 2.08]) for (const y of [0, LAPTOP.baseTop]) points.push(new Vector3(x, y, z));
  for (const x of [-3.2, 3.2]) for (const z of [0, 4.16]) for (const y of [-.02, .05]) points.push(new Vector3(x, y, z).applyAxisAngle(axis, LAPTOP.angle).add(hinge));
  const rect = width > 800
    ? { x: width * .365, y: height * .11, width: width * .60, height: height * .76 }
    : width > 480
      ? { x: width * .035, y: 206, width: width * .93, height: Math.min(445, height - 252) }
      : { x: width * .025, y: 275, width: width * .95, height: Math.min(342, height - 310) };
  camera.clearViewOffset();
  camera.fov = 18;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  const projected = new Vector3();
  const bounds = (distance: number) => {
    camera.position.copy(target).addScaledVector(normal, distance);
    camera.lookAt(target); camera.updateMatrixWorld();
    let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
    for (const point of points) {
      projected.copy(point).project(camera);
      const x = (projected.x + 1) * width / 2, y = (1 - projected.y) * height / 2;
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    return { left, right, top, bottom };
  };
  let low = 8, high = 100;
  for (let i = 0; i < 22; i++) {
    const distance = (low + high) / 2;
    const box = bounds(distance);
    if (box.right - box.left > rect.width || box.bottom - box.top > rect.height) low = distance;
    else high = distance;
  }
  const box = bounds(high);
  camera.setViewOffset(width, height, (box.left + box.right) / 2 - (rect.x + rect.width / 2), (box.top + box.bottom) / 2 - (rect.y + rect.height / 2), width, height);
  camera.updateProjectionMatrix();
}
