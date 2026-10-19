'use client';

/* eslint-disable react-hooks/immutability -- The animation controller owns the forwarded Three.js object refs. */

import { useEffect, useMemo } from 'react';
import {
  BoxGeometry, BufferGeometry, CanvasTexture, CircleGeometry, CylinderGeometry, DataTexture,
  Float32BufferAttribute, Group, InstancedMesh, Mesh, MeshBasicMaterial,
  LinearFilter, LinearMipmapLinearFilter, MeshPhysicalMaterial, MeshStandardMaterial, Object3D, PlaneGeometry, RepeatWrapping, SRGBColorSpace, Vector2, type Texture,
} from 'three';
import type { MutableRefObject } from 'react';
import { beveledPlate, keycapGeometry, keycapSurfaceHeight, roundedDisplay, taperedPlate } from './geometry';

/** Coordinates are world units. The hinge is on the actual rear edge, not the lid centre. */
export const LAPTOP = {
  baseWidth: 6.4, baseDepth: 4.16, baseTop: .201,
  hingeY: .237, hingeZ: -2.08,
  screenY: -.02, screenZ: 2.08,
  screenWidth: 6.14, screenHeight: 3.8375, screenRadius: .052,
  angle: -Math.PI * 108 / 180,
};

export interface ModelHandles {
  lid: Group | null;
  screen: MeshBasicMaterial | null;
  gap: MeshBasicMaterial | null;
  indicator: MeshBasicMaterial | null;
}

type Key = { x: number; z: number; width: number; depth: number; label: string };
type KeySpec = string | [string, number];
const KEY_Y = .191;
const KEY_WELL = { width: 5.43, depth: 2.08, z: -.63, radius: .078 };

/** Static contact occlusion calculated in the same physical coordinates as the
 * machined apertures. It lives in UV1, independent from the microfinish UVs. */
function contactOcclusion(width: number, depth: number, cutouts: { x: number; z: number; width: number; depth: number; radius: number; strength: number; softness: number }[]) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = Math.round(1024 * depth / width);
  const context = canvas.getContext('2d')!;
  const scale = canvas.width / width;
  context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
  for (const cutout of cutouts) {
    const x = (cutout.x + width / 2 - cutout.width / 2) * scale;
    const y = (cutout.z + depth / 2 - cutout.depth / 2) * scale;
    context.save();
    context.shadowColor = `rgba(0,0,0,${cutout.strength})`;
    context.shadowBlur = cutout.softness * scale;
    context.fillStyle = '#121212';
    context.beginPath(); context.roundRect(x, y, cutout.width * scale, cutout.depth * scale, cutout.radius * scale); context.fill();
    context.restore();
  }
  const texture = new CanvasTexture(canvas);
  texture.channel = 1; texture.anisotropy = 4;
  return texture;
}

function surfaceUv(geometry: BufferGeometry, width: number, depth: number) {
  const position = geometry.attributes.position;
  const uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) {
    uv[i * 2] = .5 + position.getX(i) / width;
    uv[i * 2 + 1] = .5 - position.getZ(i) / depth;
  }
  geometry.setAttribute('uv1', new Float32BufferAttribute(uv, 2));
  return geometry;
}

/** A small, prefiltered satin finish. It modulates roughness only, never colour. */
function createSatinFinish() {
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  let seed = 572371;
  for (let i = 0; i < size * size; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    // Irregular, isotropic grain is mip-filtered so the finish remains quiet
    // at phone resolution; there are no repeating brushed-metal stripes.
    const value = Math.min(255, 214 + (seed >>> 27));
    data.set([value, value, value, 255], i * 4);
  }
  const texture = new DataTexture(data, size, size);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

/** Anodising is a microscopic, non-directional texture. Keeping its normals
 * independent from the roughness avoids turning a machined panel into plastic. */
function createAnodizedNormals() {
  const size = 128, data = new Uint8Array(size * size * 4);
  let seed = 93082;
  for (let i = 0; i < size * size; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const x = 113 + ((seed >>> 24) & 31), y = 113 + ((seed >>> 16) & 31);
    data.set([x, y, 254, 255], i * 4);
  }
  const texture = new DataTexture(data, size, size);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.minFilter = LinearMipmapLinearFilter; texture.magFilter = LinearFilter;
  texture.generateMipmaps = true; texture.anisotropy = 4; texture.needsUpdate = true;
  return texture;
}

/** A restrained screen reflection on the front palmrest, with no LED-like edge. */
function createScreenSpill() {
  const width = 128, height = 24;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const u = x / (width - 1), v = y / (height - 1);
    const end = Math.min(1, u / .14, (1 - u) / .14);
    const feather = end * end * (3 - 2 * end);
    const across = Math.exp(-(((v - .53) / .22) ** 2)) * Math.sin(Math.PI * v);
    data.set([255, 255, 255, Math.round(140 * feather * across)], (y * width + x) * 4);
  }
  const texture = new DataTexture(data, width, height);
  texture.minFilter = texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** A real compact keyboard layout: six rows, varied modifiers, an inverted-T arrow cluster. */
function keyboardLayout(): Key[] {
  const pitch = .355;
  const gutter = .028;
  const result: Key[] = [];
  const addRow = (specs: KeySpec[], z: number, depth = .31) => {
    let cursor = -15 * pitch / 2;
    for (const spec of specs) {
      const [label, units] = typeof spec === 'string' ? [spec, 1] : spec;
      const width = units * pitch;
      result.push({ x: cursor + width / 2, z, width: width - gutter, depth, label });
      cursor += width;
    }
  };
  addRow([['esc', 1.5], ...Array.from({ length: 12 }, (_, i) => [`F${i + 1}`, 11.5 / 12] as [string, number]), ['⏻', 2]], -1.52, .175);
  addRow(['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '−', '=', ['⌫', 2]], -1.22);
  addRow([['tab', 1.5], 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', ['\\', 1.5]], -.87);
  addRow([['caps', 1.75], 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'", ['enter', 2.25]], -.52);
  addRow([['shift', 2.25], 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', ['shift', 2.75]], -.17);
  addRow(['fn', ['ctrl', 1.25], ['alt', 1.25], ['ctrl', 1.25], ['', 5.5], ['alt', 1.25], ['ctrl', 1.25]], .18);
  const arrowStart = 15 * pitch / 2 - 2.25 * pitch;
  const arrowPitch = .75 * pitch;
  result.push(
    { x: arrowStart + arrowPitch * .5, z: .255, width: arrowPitch - .028, depth: .125, label: '←' },
    { x: arrowStart + arrowPitch * 1.5, z: .105, width: arrowPitch - .028, depth: .125, label: '↑' },
    { x: arrowStart + arrowPitch * 1.5, z: .255, width: arrowPitch - .028, depth: .125, label: '↓' },
    { x: arrowStart + arrowPitch * 2.5, z: .255, width: arrowPitch - .028, depth: .125, label: '→' },
  );
  return result;
}

function keyboardLegends(keys: Key[]) {
  // One local texture and one draw call for every legend, not 80 text meshes.
  const atlas = document.createElement('canvas');
  const cellWidth = 128, cellHeight = 128, columns = 16;
  atlas.width = cellWidth * columns;
  atlas.height = 1024;
  const context = atlas.getContext('2d')!;
  context.textAlign = 'center';
  context.textBaseline = 'alphabetic';
  context.fillStyle = '#d5d8db';
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  keys.forEach((key, i) => {
    if (!key.label) return;
    const column = i % columns, row = Math.floor(i / columns);
    context.font = `500 ${key.label.length > 2 ? 42 : key.label.length > 1 ? 56 : 72}px "Segoe UI", sans-serif`;
    const metrics = context.measureText(key.label);
    const ascent = metrics.actualBoundingBoxAscent;
    const descent = metrics.actualBoundingBoxDescent;
    const centreX = column * cellWidth + cellWidth / 2;
    const baselineY = row * cellHeight + cellHeight / 2 + (ascent - descent) / 2;
    context.fillText(key.label, centreX, baselineY);
    // Crop the atlas to the glyph's actual ink bounds. One physical scale is used
    // on both axes, so letters never become compressed horizontal bars.
    const left = centreX - metrics.actualBoundingBoxLeft - 2;
    const right = centreX + metrics.actualBoundingBoxRight + 2;
    const top = baselineY - ascent - 2;
    const bottom = baselineY + descent + 2;
    const pixelWidth = right - left, pixelHeight = bottom - top;
    const desiredHeight = key.depth < .2 ? .037 : key.label.length > 1 ? .046 : .061;
    const scale = Math.min(desiredHeight / pixelHeight, key.width * .76 / pixelWidth);
    const halfWidth = pixelWidth * scale / 2;
    const halfDepth = pixelHeight * scale / 2;
    const offset = positions.length / 3;
    const u0 = left / atlas.width, u1 = right / atlas.width;
    const v0 = 1 - top / atlas.height, v1 = 1 - bottom / atlas.height;
    // The printing follows the concave cap instead of hovering above a flat quad.
    for (let row = 0; row <= 2; row++) for (let column = 0; column <= 2; column++) {
      const x = -halfWidth + halfWidth * column;
      const z = -halfDepth + halfDepth * row;
      positions.push(key.x + x, KEY_Y + keycapSurfaceHeight(x, z, key.width, key.depth) + .0005, key.z + z);
      uvs.push(u0 + (u1 - u0) * column / 2, v0 + (v1 - v0) * row / 2);
    }
    for (let row = 0; row < 2; row++) for (let column = 0; column < 2; column++) {
      const a = offset + row * 3 + column;
      indices.push(a, a + 4, a + 1, a, a + 3, a + 4);
    }
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const texture = new CanvasTexture(atlas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  const material = new MeshStandardMaterial({ map: texture, color: '#e2e5e6', emissive: '#a2adb6', emissiveMap: texture, emissiveIntensity: .18, roughness: .85, metalness: 0, transparent: true, opacity: .86, alphaTest: .01, depthWrite: false });
  return { mesh: new Mesh(geometry, material), texture, geometry, material };
}

export function LaptopModel({ handles, screenTexture }: { handles: MutableRefObject<ModelHandles>; screenTexture: Texture }) {
  const resources = useMemo(() => {
    const satinFinish = createSatinFinish();
    const anodizedNormals = createAnodizedNormals();
    const screenSpill = createScreenSpill();
    const keys = keyboardLayout();
    const deckOcclusion = contactOcclusion(6.4, 4.16, [
      { x: 0, ...KEY_WELL, strength: .9, softness: .045 },
      { x: 0, z: 1.16, width: 2.37, depth: 1.17, radius: .09, strength: .8, softness: .025 },
      { x: 0, z: -2.02, width: 5.68, depth: .1, radius: .04, strength: .9, softness: .16 },
    ]);
    const wellOcclusion = contactOcclusion(KEY_WELL.width + .03, KEY_WELL.depth + .03, keys.map(key => ({ ...key, z: key.z - KEY_WELL.z, radius: .026, strength: .85, softness: .04 })));
    const metal = new MeshPhysicalMaterial({ color: '#505257', metalness: 1, roughness: .30, roughnessMap: satinFinish, normalMap: anodizedNormals, normalScale: new Vector2(.045, .045), aoMap: deckOcclusion, aoMapIntensity: .65, envMapIntensity: 1.18 });
    const underside = new MeshStandardMaterial({ color: '#303439', metalness: .98, roughness: .29, roughnessMap: satinFinish, normalMap: anodizedNormals, normalScale: new Vector2(.06, .06), envMapIntensity: 1.02 });
    const lidMetal = new MeshPhysicalMaterial({ color: '#494c51', metalness: 1, roughness: .30, roughnessMap: satinFinish, normalMap: anodizedNormals, normalScale: new Vector2(.045, .045), envMapIntensity: 1.18 });
    const bezelMaterial = new MeshPhysicalMaterial({ color: '#080a0d', metalness: .02, roughness: .21, clearcoat: .3, clearcoatRoughness: .15, envMapIntensity: .75 });
    const wellMaterial = new MeshStandardMaterial({ color: '#16191c', metalness: .18, roughness: .62, aoMap: wellOcclusion, aoMapIntensity: .65 });
    const keyboardFrameMaterial = metal.clone();
    keyboardFrameMaterial.aoMap = wellOcclusion;
    keyboardFrameMaterial.aoMapIntensity = .38;
    keyboardFrameMaterial.color.set('#41454a');
    const holeMaterial = new MeshStandardMaterial({ color: '#070a0d', metalness: .02, roughness: .9 });
    const keyMaterial = new MeshPhysicalMaterial({ color: '#26282b', metalness: 0, roughness: .39, specularIntensity: .65, ior: 1.46, vertexColors: true });
    // A fine etched glass palm-control surface has a softer reflection than
    // the anodised aluminium surrounding it; it is not a second metal slab.
    const trackMaterial = new MeshPhysicalMaterial({ color: '#292e33', metalness: .4, roughness: .36, clearcoat: .25, clearcoatRoughness: .2, roughnessMap: satinFinish, envMapIntensity: 1.05 });
    const rubberMaterial = new MeshStandardMaterial({ color: '#05080b', metalness: 0, roughness: .9 });
    const lensMaterial = new MeshPhysicalMaterial({ color: '#0c1725', metalness: .25, roughness: .08, clearcoat: 1, clearcoatRoughness: .04 });
    const precisionMetal = new MeshStandardMaterial({ color: '#48535c', metalness: .95, roughness: .3, envMapIntensity: .85 });
    const cutEdgeMaterial = new MeshStandardMaterial({ color: '#666d74', metalness: 1, roughness: .24, envMapIntensity: .9 });
    const base = taperedPlate(6.39, 4.15, .112, .21, .026, .08, .055);
    const deck = surfaceUv(beveledPlate(6.4, 4.16, .06, .2, .016, [
      { ...KEY_WELL, x: 0, edgeBevel: .0035 },
      { width: 2.37, depth: 1.17, radius: .09, x: 0, z: 1.16, edgeBevel: .0025 },
    ], { width: .78, depth: .085 }), 6.4, 4.16);
    const well = surfaceUv(beveledPlate(KEY_WELL.width + .03, KEY_WELL.depth + .03, .015, .085, .003), KEY_WELL.width + .03, KEY_WELL.depth + .03);
    // Individual milled apertures and continuous aluminium bridges make the
    // keyboard part of the unibody, rather than loose cubes in one dark pit.
    const keyboardFrame = surfaceUv(beveledPlate(KEY_WELL.width - .008, KEY_WELL.depth - .008, .009, .073, .0015,
      keys.map(key => ({ x: key.x, z: key.z - KEY_WELL.z, width: key.width + .012, depth: key.depth + .012, radius: .031 }))), KEY_WELL.width + .03, KEY_WELL.depth + .03);
    const trackpad = taperedPlate(2.36, 1.16, .04, .086, .0015, .006, .006);
    const trackWell = beveledPlate(2.4, 1.2, .012, .095, .003);
    const lid = beveledPlate(6.4, 4.16, .065, .21, .018);
    const bezel = beveledPlate(6.32, 4.08, .006, .15, .0015);
    const gasket = beveledPlate(6.345, 4.105, .007, .165, .0015, [
      { width: 6.27, depth: 4.03, radius: .13, x: 0, z: 0 },
    ]);
    // A sub-millimetre exposed aluminium cut between the shell and the rubber
    // seal. It reflects the studio; it has no emissive colour or outline shader.
    const lidCutEdge = beveledPlate(6.38, 4.14, .0035, .188, .001, [
      { width: 6.345, depth: 4.105, radius: .165, x: 0, z: 0 },
    ]);
    const hinge = new CylinderGeometry(.043, .043, 1.25, 24);
    const foot = beveledPlate(.56, .27, .028, .105, .008);
    const speakerHole = new CircleGeometry(.0075, 6);
    const port = beveledPlate(.045, .23, .009, .021, .003);
    const hingeBridge = beveledPlate(4.3, .13, .048, .045, .009);
    const screenGeometry = roundedDisplay(LAPTOP.screenWidth, LAPTOP.screenHeight, LAPTOP.screenRadius);
    const lensGeometry = new CircleGeometry(.019, 20);
    const lensRim = new CircleGeometry(.026, 24);
    const ventGeometry = beveledPlate(.047, .11, .002, .015, .0004);
    const keyGroups = new Map<string, Key[]>();
    for (const key of keys) {
      const groupKey = `${key.width.toFixed(4)}:${key.depth}`;
      const group = keyGroups.get(groupKey) || [];
      group.push(key);
      keyGroups.set(groupKey, group);
    }
    const keyGeometries: BufferGeometry[] = [];
    const keyInstances: InstancedMesh[] = [];
    const transform = new Object3D();
    for (const group of keyGroups.values()) {
      const key = group[0];
      const geometry = keycapGeometry(key.width, key.depth);
      keyGeometries.push(geometry);
      const instance = new InstancedMesh(geometry, keyMaterial, group.length);
      group.forEach((item, index) => {
        transform.position.set(item.x, KEY_Y, item.z);
        transform.rotation.set(0, 0, 0);
        transform.updateMatrix();
        instance.setMatrixAt(index, transform.matrix);
      });
      instance.instanceMatrix.needsUpdate = true;
      instance.castShadow = instance.receiveShadow = true;
      keyInstances.push(instance);
    }
    const speakerInstances = new InstancedMesh(speakerHole, holeMaterial, 224);
    let index = 0;
    for (const side of [-1, 1]) for (let column = 0; column < 4; column++) for (let row = 0; row < 28; row++) {
      transform.position.set(side * (2.86 + column * .054), .202, -1.48 + row * .064);
      transform.rotation.set(-Math.PI / 2, 0, 0);
      transform.updateMatrix();
      speakerInstances.setMatrixAt(index++, transform.matrix);
    }
    speakerInstances.instanceMatrix.needsUpdate = true;
    // Small recessed cooling slots live in the rear deck, directly ahead of
    // the hinge. One shared geometry / draw call, no ornamental edge strokes.
    const ventInstances = new InstancedMesh(ventGeometry, holeMaterial, 50);
    for (let i = 0; i < 50; i++) {
      transform.position.set((i - 24.5) * .092, .2016, -1.805);
      transform.rotation.set(0, 0, 0);
      transform.updateMatrix();
      ventInstances.setMatrixAt(i, transform.matrix);
    }
    ventInstances.instanceMatrix.needsUpdate = true;
    const legends = keyboardLegends(keys);
    const gapGeometry = new PlaneGeometry(5.9, .18);
    const indicatorGeometry = new BoxGeometry(.058, .006, .004);
    return {
      metal, underside, lidMetal, bezelMaterial, wellMaterial, keyboardFrameMaterial, holeMaterial, keyMaterial, trackMaterial, rubberMaterial, lensMaterial, precisionMetal, cutEdgeMaterial,
      base, deck, well, keyboardFrame, trackpad, trackWell, lid, bezel, gasket, lidCutEdge, hinge, hingeBridge, foot, port, screenGeometry, lensGeometry,
      keyInstances, speakerInstances, ventInstances, lensRim, legends, gapGeometry, indicatorGeometry, screenSpill,
      dispose() {
        [metal, underside, lidMetal, bezelMaterial, wellMaterial, keyboardFrameMaterial, holeMaterial, keyMaterial, trackMaterial, rubberMaterial, lensMaterial, precisionMetal, cutEdgeMaterial].forEach(material => material.dispose());
        [base, deck, well, keyboardFrame, trackpad, trackWell, lid, bezel, gasket, lidCutEdge, hinge, hingeBridge, foot, port, screenGeometry, lensGeometry, lensRim, ventGeometry, speakerHole, gapGeometry, indicatorGeometry, ...keyGeometries].forEach(geometry => geometry.dispose());
        satinFinish.dispose(); anodizedNormals.dispose();
        deckOcclusion.dispose(); wellOcclusion.dispose();
        screenSpill.dispose();
        keyInstances.forEach(instance => instance.dispose());
        speakerInstances.dispose();
        ventInstances.dispose();
        legends.geometry.dispose(); legends.material.dispose(); legends.texture.dispose();
      },
    };
  }, []);

  useEffect(() => {
    const { screen, gap, indicator } = handles.current;
    return () => {
      resources.dispose();
      screen?.dispose();
      gap?.dispose();
      indicator?.dispose();
    };
  }, [handles, resources]);

  return <group dispose={null}>
    {/* A milled top plate with two real apertures; the lower hull is visible in the recesses. */}
    <mesh geometry={resources.base} material={resources.underside} position={[0, .096, 0]} castShadow receiveShadow />
    <mesh geometry={resources.deck} material={resources.metal} position={[0, .171, 0]} castShadow receiveShadow />
    <mesh geometry={resources.well} material={resources.wellMaterial} position={[0, .159, KEY_WELL.z]} receiveShadow />
    <mesh geometry={resources.keyboardFrame} material={resources.keyboardFrameMaterial} position={[0, .1915, KEY_WELL.z]} castShadow receiveShadow />
    <mesh geometry={resources.trackWell} material={resources.underside} position={[0, .158, 1.16]} />
    <mesh geometry={resources.trackpad} material={resources.trackMaterial} position={[0, .181, 1.16]} receiveShadow />
    {resources.keyInstances.map((instance, i) => <primitive key={i} object={instance} />)}
    <primitive object={resources.speakerInstances} />
    <primitive object={resources.ventInstances} />
    <primitive object={resources.legends.mesh} />
    {[-2.63, 2.63].flatMap(x => [-1.6, 1.6].map(z => <mesh key={`${x}:${z}`} geometry={resources.foot} material={resources.rubberMaterial} position={[x, .026, z]} />))}
    {[-2.25, 2.25].map(x => <mesh key={x} geometry={resources.hinge} material={resources.precisionMetal} position={[x, LAPTOP.hingeY, LAPTOP.hingeZ]} rotation={[0, 0, Math.PI / 2]} />)}
    <mesh geometry={resources.hingeBridge} material={resources.rubberMaterial} position={[0, .182, -1.995]} />
    {[-1.28, -.86].map(z => <mesh key={z} geometry={resources.port} material={resources.holeMaterial} position={[-3.163, .105, z]} rotation={[0, 0, Math.PI / 2]} />)}
    <mesh geometry={resources.indicatorGeometry} position={[2.63, .105, 2.054]}>
      <meshBasicMaterial ref={value => { handles.current.indicator = value; }} color="#c7dce6" transparent opacity={0} toneMapped={false} />
    </mesh>
    <mesh geometry={resources.gapGeometry} position={[0, .2018, 1.88]} rotation={[-Math.PI / 2, 0, 0]}>
      <meshBasicMaterial ref={value => { handles.current.gap = value; }} map={resources.screenSpill} color="#a8bac8" transparent opacity={0} depthWrite={false} toneMapped={false} />
    </mesh>
    <group ref={value => { handles.current.lid = value; }} position={[0, LAPTOP.hingeY, LAPTOP.hingeZ]}>
      {/* Everything on the display belongs to this single physical hinge group. */}
      <mesh geometry={resources.lid} material={resources.lidMetal} position={[0, .017, 2.08]} castShadow receiveShadow />
      <mesh geometry={resources.bezel} material={resources.bezelMaterial} position={[0, -.016, 2.08]} />
      <mesh geometry={resources.gasket} material={resources.rubberMaterial} position={[0, -.0175, 2.08]} />
      <mesh geometry={resources.lidCutEdge} material={resources.cutEdgeMaterial} position={[0, -.0177, 2.08]} />
      <mesh geometry={resources.screenGeometry} position={[0, LAPTOP.screenY, LAPTOP.screenZ]} rotation={[Math.PI / 2, 0, 0]}>
        <meshBasicMaterial ref={value => { handles.current.screen = value; }} map={screenTexture} color="#000000" toneMapped={false} />
      </mesh>
      <mesh geometry={resources.lensRim} material={resources.precisionMetal} position={[0, -.0204, 4.035]} rotation={[Math.PI / 2, 0, 0]} />
      <mesh geometry={resources.lensGeometry} material={resources.lensMaterial} position={[0, -.0206, 4.035]} rotation={[Math.PI / 2, 0, 0]} />
    </group>
  </group>;
}

