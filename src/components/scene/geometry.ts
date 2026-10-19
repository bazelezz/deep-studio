import { BufferGeometry, ExtrudeGeometry, Float32BufferAttribute, Path, Shape, ShapeGeometry } from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

type Aperture = { width: number; depth: number; radius: number; x: number; z: number; edgeBevel?: number };
type FingerNotch = { width: number; depth: number };

function roundedPath<T extends Path>(path: T, width: number, depth: number, radius: number, x = 0, y = 0, notch?: FingerNotch): T {
  const a = width / 2, b = depth / 2, r = Math.min(radius, a, b);
  path.moveTo(x - a + r, y - b);
  if (notch) {
    // A shallow, continuous scoop in the front rail, not a painted black mark.
    const half = notch.width / 2;
    path.lineTo(x - half, y - b);
    path.bezierCurveTo(x - half * .68, y - b, x - half * .75, y - b + notch.depth, x, y - b + notch.depth);
    path.bezierCurveTo(x + half * .75, y - b + notch.depth, x + half * .68, y - b, x + half, y - b);
  }
  path.lineTo(x + a - r, y - b);
  path.quadraticCurveTo(x + a, y - b, x + a, y - b + r);
  path.lineTo(x + a, y + b - r);
  path.quadraticCurveTo(x + a, y + b, x + a - r, y + b);
  path.lineTo(x - a + r, y + b);
  path.quadraticCurveTo(x - a, y + b, x - a, y + b - r);
  path.lineTo(x - a, y - b + r);
  path.quadraticCurveTo(x - a, y - b, x - a + r, y - b);
  path.closePath();
  return path;
}

/** Horizontal machined plate. Requested dimensions include the small edge fillet. */
export function beveledPlate(width: number, depth: number, thickness: number, radius: number, bevel: number, apertures: Aperture[] = [], frontNotch?: FingerNotch) {
  const fillet = Math.min(bevel, thickness * .45);
  const shape = roundedPath(new Shape(), width - fillet * 2, depth - fillet * 2, Math.max(.001, radius - fillet), 0, 0, frontNotch);
  for (const hole of apertures) {
    shape.holes.push(roundedPath(new Path(), hole.width + fillet * 2, hole.depth + fillet * 2, hole.radius + fillet, hole.x, -hole.z));
  }
  const raw = new ExtrudeGeometry(shape, {
    depth: thickness - fillet * 2,
    steps: 1,
    bevelEnabled: true,
    bevelThickness: fillet,
    bevelSize: fillet,
    bevelSegments: 4,
    curveSegments: 16,
  });
  raw.translate(0, 0, -(thickness - fillet * 2) / 2);
  raw.rotateX(-Math.PI / 2);
  // Join the fillet vertices, then restore the exact normal of its circular profile.
  // Merely averaging adjacent triangles warps the reflection on a large flat cap.
  raw.deleteAttribute('normal');
  raw.deleteAttribute('uv');
  const geometry = mergeVertices(raw, .00001);
  geometry.computeVertexNormals();
  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  const coreHalfHeight = thickness / 2 - fillet;
  for (let i = 0; i < position.count; i++) {
    let y = position.getY(i);
    let localFillet = fillet;
    const x = normal.getX(i), z = normal.getZ(i);
    const horizontalLength = Math.hypot(x, z);
    // A precision trackpad cut has a much smaller tool radius than the outer
    // unibody edge. Preserve a real aperture while independently forming its
    // lip; sharing the large hull fillet made this joint look like a black moat.
    const hole = apertures.find(aperture => aperture.edgeBevel !== undefined
      && Math.abs(position.getX(i) - aperture.x) <= aperture.width / 2 + fillet + .0001
      && Math.abs(position.getZ(i) - aperture.z) <= aperture.depth / 2 + fillet + .0001);
    if (hole && hole.edgeBevel !== undefined && horizontalLength > .000001) {
      localFillet = Math.min(fillet, hole.edgeBevel);
      const axial = Math.max(0, Math.min(1, (Math.abs(y) - coreHalfHeight) / fillet));
      const radial = Math.sqrt(Math.max(0, 1 - axial * axial));
      const offset = (fillet - localFillet) * (1 - radial);
      position.setX(i, position.getX(i) + x / horizontalLength * offset);
      position.setZ(i, position.getZ(i) + z / horizontalLength * offset);
      if (Math.abs(y) >= coreHalfHeight - .00001) {
        y = Math.sign(y) * (thickness / 2 - localFillet + localFillet * axial);
        position.setY(i, y);
      }
    }
    const cap = Math.abs(y) >= thickness / 2 - .00001;
    const axial = cap ? 1 : Math.max(0, Math.min(1, (Math.abs(y) - (thickness / 2 - localFillet)) / localFillet));
    const radial = Math.sqrt(Math.max(0, 1 - axial * axial));
    normal.setXYZ(i,
      horizontalLength > .000001 ? x / horizontalLength * radial : 0,
      Math.sign(y) * axial,
      horizontalLength > .000001 ? z / horizontalLength * radial : 0,
    );
  }
  normal.needsUpdate = true;
  const uvs = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) {
    // Consistent physical scale for the satin microfinish, independent of panel size.
    uvs[i * 2] = position.getX(i) * 3;
    uvs[i * 2 + 1] = position.getZ(i) * 3;
  }
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  raw.dispose();
  return geometry;
}

/** Physical LCD corners with normalised UVs; the outer bezel stays separate. */
export function roundedDisplay(width: number, height: number, radius: number) {
  const geometry = new ShapeGeometry(roundedPath(new Shape(), width, height, radius), 12);
  const positions = geometry.attributes.position;
  const uvs = new Float32Array(positions.count * 2);
  for (let i = 0; i < positions.count; i++) {
    uvs[i * 2] = positions.getX(i) / width + .5;
    uvs[i * 2 + 1] = positions.getY(i) / height + .5;
  }
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  return geometry;
}

/** A continuous unibody taper; inverse-transpose normals retain exact planar caps. */
export function taperedPlate(width: number, depth: number, thickness: number, radius: number, bevel: number, insetX: number, insetZ: number) {
  const geometry = beveledPlate(width, depth, thickness, radius, bevel);
  const positions = geometry.attributes.position;
  const normals = geometry.attributes.normal;
  const dx = 2 * insetX / (width * thickness), dz = 2 * insetZ / (depth * thickness);
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const elevation = (y + thickness / 2) / thickness;
    const sx = 1 - 2 * insetX / width * (1 - elevation);
    const sz = 1 - 2 * insetZ / depth * (1 - elevation);
    const nx = normals.getX(i) / sx, nz = normals.getZ(i) / sz;
    const ny = normals.getY(i) - dx * x * nx - dz * z * nz;
    const length = Math.hypot(nx, ny, nz);
    positions.setXYZ(i, x * sx, y, z * sz);
    normals.setXYZ(i, nx / length, ny / length, nz / length);
  }
  positions.needsUpdate = normals.needsUpdate = true;
  return geometry;
}

const KEY_THICKNESS = .019;
const KEY_BEVEL = .0038;
const KEY_DISH = .0017;

/** Height of the quiet moulded concavity, shared with the printed legends. */
export function keycapSurfaceHeight(x: number, z: number, width: number, depth: number) {
  const a = width / 2 - KEY_BEVEL, b = depth / 2 - KEY_BEVEL;
  const fx = Math.max(0, 1 - (x / a) ** 2);
  const fz = Math.max(0, 1 - (z / b) ** 2);
  return KEY_THICKNESS / 2 - KEY_DISH * fx * fx * fz * fz;
}

/** A proper dished top surface, replacing the large flat polygon of a box key. */
export function keycapGeometry(width: number, depth: number) {
  const body = beveledPlate(width, depth, KEY_THICKNESS, .031, KEY_BEVEL);
  const p = body.attributes.position, n = body.attributes.normal, uv = body.attributes.uv;
  const positions = Array.from(p.array), normals = Array.from(n.array), uvs = Array.from(uv.array);
  const indices: number[] = [];
  const oldIndices = body.index!;
  const top = KEY_THICKNESS / 2;
  for (let i = 0; i < oldIndices.count; i += 3) {
    const a = oldIndices.getX(i), b = oldIndices.getX(i + 1), c = oldIndices.getX(i + 2);
    if ([a, b, c].every(index => Math.abs(p.getY(index) - top) < .00001)) continue;
    indices.push(a, b, c);
  }
  const outline: { x: number; z: number }[] = [];
  for (let i = 0; i < p.count; i++) {
    if (Math.abs(p.getY(i) - top) < .00001) outline.push({ x: p.getX(i), z: p.getZ(i) });
  }
  outline.sort((a, b) => Math.atan2(a.z, a.x) - Math.atan2(b.z, b.x));
  const centre = positions.length / 3;
  positions.push(0, top - KEY_DISH, 0); normals.push(0, 1, 0); uvs.push(0, 0);
  const rings = 4, count = outline.length;
  const a = width / 2 - KEY_BEVEL, b = depth / 2 - KEY_BEVEL;
  for (let ring = 1; ring <= rings; ring++) {
    const fraction = ring / rings;
    for (const point of outline) {
      const x = point.x * fraction, z = point.z * fraction;
      const fx = Math.max(0, 1 - (x / a) ** 2), fz = Math.max(0, 1 - (z / b) ** 2);
      const nx = ring === rings ? 0 : -4 * KEY_DISH * x / (a * a) * fx * fz * fz;
      const nz = ring === rings ? 0 : -4 * KEY_DISH * z / (b * b) * fz * fx * fx;
      const length = Math.hypot(nx, 1, nz);
      positions.push(x, ring === rings ? top : keycapSurfaceHeight(x, z, width, depth), z);
      normals.push(nx / length, 1 / length, nz / length);
      uvs.push(x * 3, z * 3);
    }
  }
  for (let i = 0; i < count; i++) {
    const next = (i + 1) % count;
    indices.push(centre, centre + 1 + next, centre + 1 + i);
    for (let ring = 0; ring < rings - 1; ring++) {
      const inner = centre + 1 + ring * count, outer = inner + count;
      indices.push(inner + i, outer + next, outer + i, inner + i, inner + next, outer + next);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  // The small downward-facing skirt is occluded by the switch socket. Bake
  // this local, stationary contact into vertex colour instead of giving every
  // key an unshadowed, uniformly grey bevel under the large studio lights.
  const colors: number[] = [];
  for (let i = 0; i < positions.length; i += 3) {
    const elevation = Math.max(0, Math.min(1, (positions[i + 1] + KEY_THICKNESS / 2) / KEY_THICKNESS));
    const visibility = .24 + .76 * elevation * elevation;
    colors.push(visibility, visibility, visibility);
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  body.dispose();
  return geometry;
}
