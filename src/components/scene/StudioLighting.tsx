'use client';

/* eslint-disable react-hooks/immutability -- The renderer owns mutable Three.js scene resources. */
import { useLayoutEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { CanvasTexture, Color, Mesh, MeshBasicMaterial, PlaneGeometry, PMREMGenerator, RectAreaLight, Scene, SRGBColorSpace, Vector3 } from 'three';

type StudioPanel = {
  name: 'key' | 'edge' | 'fill' | 'top' | 'rim' | 'return' | 'low' | 'glint';
  position: [number, number, number];
  target: [number, number, number];
  width: number;
  height: number;
  intensity: number;
  reflection: number;
  color: string;
};

// One physical rig supplies both direct area lights and reflected softboxes.
// The two low rear cards sit in the deck's reflection angle: this gives the
// aluminium a continuous left / right roll-off instead of a grey ambient wash.
// The broad frontal fill reads the moulded ABS keys and etched glass trackpad.
// The narrow frontal strip catches the curved fillet, not a painted outline.
const STUDIO: readonly StudioPanel[] = [
  { name: 'key', position: [-3.6, 3.4, -8], target: [-.3, .3, -.1], width: 4.8, height: 4.4, intensity: 1.45, reflection: 1.7, color: '#f0eeeb' },
  { name: 'edge', position: [0, 2.2, 5], target: [0, .23, 1.95], width: 7.2, height: .22, intensity: 280, reflection: 2.5, color: '#c5d3df' },
  { name: 'fill', position: [3.2, 5.5, 4.4], target: [0, .2, -.1], width: 5, height: 3.2, intensity: 3.4, reflection: .7, color: '#e6e9ec' },
  { name: 'rim', position: [4.4, 2.8, -6.8], target: [1.7, .2, .4], width: 2.2, height: 3.8, intensity: 1.7, reflection: 1.7, color: '#d4dfe7' },
  { name: 'return', position: [3.9, 2.7, -7.2], target: [1.7, .2, .4], width: 3, height: 3.4, intensity: 1.2, reflection: 1.9, color: '#dce2e7' },
  { name: 'low', position: [1.7, .7, 5.5], target: [.5, .12, 2.05], width: 4.5, height: .45, intensity: 8.5, reflection: 1.4, color: '#d3e0e9' },
  { name: 'top', position: [-.5, 7, -1.5], target: [0, 0, 0], width: 5.8, height: .38, intensity: .65, reflection: .6, color: '#dfe5eb' },
];

// A close, small area source writes one short highlight on the physical front
// fillet. It is animated independently, then extinguished before the lid moves.
// It never enters the static PMREM, so the finished studio image is unchanged.
const GLINT: StudioPanel = {
  name: 'glint', position: [-1.65, .95, 3.1], target: [-1.65, .255, 2.06],
  width: .62, height: .04, intensity: 900, reflection: 0, color: '#d7e1e8',
};

/** A locally generated studio, not an HDRI request. Softboxes are visible only in reflections. */
export function StudioEnvironment() {
  const { gl, scene, invalidate } = useThree();
  useLayoutEffect(() => {
    const room = new Scene();
    room.background = new Color('#030508');
    const geometry = new PlaneGeometry(1, 1);
    const materials: MeshBasicMaterial[] = [];
    // A real diffusion panel has a hot centre and soft shoulders. Graduated
    // reflection cards produce a continuous metal roll-off instead of painted
    // rectangles on the palm rest. This tiny local map is baked once to PMREM.
    const diffuser = document.createElement('canvas');
    diffuser.width = diffuser.height = 128;
    const context = diffuser.getContext('2d')!;
    const gradient = context.createRadialGradient(64, 54, 8, 64, 64, 82);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(.45, '#d7d7d7');
    gradient.addColorStop(.78, '#747474');
    gradient.addColorStop(1, '#080808');
    context.fillStyle = gradient; context.fillRect(0, 0, 128, 128);
    const diffusion = new CanvasTexture(diffuser);
    diffusion.colorSpace = SRGBColorSpace;
    const panel = (source: StudioPanel) => {
      const material = new MeshBasicMaterial({ map: diffusion, color: new Color(source.color).multiplyScalar(source.reflection) });
      materials.push(material);
      const mesh = new Mesh(geometry, material);
      mesh.position.set(...source.position);
      mesh.scale.set(source.width, source.height, 1);
      mesh.lookAt(...source.target);
      room.add(mesh);
    };
    STUDIO.forEach(panel);
    const generator = new PMREMGenerator(gl);
    const environment = generator.fromScene(room, .025, .1, 50, { size: 256 });
    const previous = scene.environment;
    scene.environment = environment.texture;
    invalidate();
    return () => {
      scene.environment = previous;
      environment.dispose(); generator.dispose(); geometry.dispose(); diffusion.dispose();
      materials.forEach(material => material.dispose());
    };
  }, [gl, scene, invalidate]);
  return null;
}

function Softbox({ name, position, target, width, height, intensity, color }: StudioPanel) {
  const light = useRef<RectAreaLight>(null);
  useLayoutEffect(() => { light.current?.lookAt(new Vector3(...target)); }, [target]);
  return <rectAreaLight name={name} ref={light} position={position} width={width} height={height} intensity={intensity} color={color} />;
}

export function StudioLighting({ glintEnabled = false }: { glintEnabled?: boolean }) {
  return <>
    <StudioEnvironment />
    <ambientLight name="ambient" intensity={.025} color="#d7dfe7" />
    <directionalLight name="contact-key" position={[-4, 7, -3]} color="#dce4eb" intensity={.58} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-camera-left={-5} shadow-camera-right={5} shadow-camera-top={5} shadow-camera-bottom={-5} shadow-camera-near={.5} shadow-camera-far={18} shadow-bias={-.00015} shadow-normalBias={.004} shadow-radius={4.5} />
    {/* All seven cards remain in the reflections. Only the four shaping sources
        also need the per-fragment area-light calculation. */}
    {STUDIO.filter(panel => ['key', 'edge', 'rim', 'fill'].includes(panel.name)).map(panel => <Softbox key={panel.name} {...panel} />)}
    {glintEnabled && <Softbox {...GLINT} />}
  </>;
}
