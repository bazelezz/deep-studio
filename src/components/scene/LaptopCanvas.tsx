'use client';

/* eslint-disable react-hooks/immutability -- R3F owns these mutable GPU objects; frame callbacks deliberately update them without React state. */

import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { gsap } from 'gsap';
import { ACESFilmicToneMapping, CanvasTexture, Color, Group, Light, MeshBasicMaterial, PCFShadowMap, PerspectiveCamera, RectAreaLight, SRGBColorSpace, Vector3 } from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { LaptopModel, LAPTOP, type ModelHandles } from './LaptopModel';
import { createContactTexture, createScreenTexture } from './screenTexture';
import type { LaptopCanvasProps, SceneControls } from './types';
import { StudioLighting } from './StudioLighting';
import { frameStillLaptop } from './stillCamera';
import { frameCinematicLaptop } from './cinematicCamera';

RectAreaLightUniformsLib.init();
const smooth = (value: number) => value * value * (3 - 2 * value);
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const openingEase = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

function createFloorLight() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d')!;
  const gradient = context.createRadialGradient(64, 64, 4, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(20,29,38,.55)');
  gradient.addColorStop(.35, 'rgba(14,22,31,.32)');
  gradient.addColorStop(1, 'rgba(3,8,16,0)');
  context.fillStyle = gradient; context.fillRect(0, 0, 128, 128);
  const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace;
  return texture;
}

class CanvasBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

function Scene(props: LaptopCanvasProps & { onSlowRenderer: () => void }) {
  const { gl, camera, size, invalidate, setDpr } = useThree();
  const latest = useRef(props);
  useEffect(() => { latest.current = props; }, [props]);
  const handles = useRef<ModelHandles>({ lid: null, screen: null, gap: null, indicator: null });
  const fill = useRef<RectAreaLight>(null);
  const floor = useRef<MeshBasicMaterial>(null);
  const studio = useRef<Group>(null);
  const firstFrame = useRef(false);
  const mounted = useRef(true);
  const isVisible = useRef(true);
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const pendingResume = useRef<gsap.core.Timeline | null>(null);
  const resumeFrame = useRef<number | null>(null);
  const frames = useRef({ count: 0, slow: 0, adapted: false });
  const values = useMemo(() => ({ opening: 0, brightness: 0, indicator: 0, gap: 0, progress: 0, reveal: 0, glint: 0, glintTravel: 0 }), []);
  const texture = useMemo(() => createScreenTexture(props.cinematic), [props.cinematic]);
  const shadow = useMemo(() => createContactTexture(), []);
  const floorLight = useMemo(() => createFloorLight(), []);
  const math = useMemo(() => {
    const axis = new Vector3(1, 0, 0);
    const center = new Vector3(0, LAPTOP.screenY, LAPTOP.screenZ).applyAxisAngle(axis, LAPTOP.angle).add(new Vector3(0, LAPTOP.hingeY, LAPTOP.hingeZ));
    return { center, normal: new Vector3(0, -1, 0).applyAxisAngle(axis, LAPTOP.angle), up: new Vector3(0, 0, 1).applyAxisAngle(axis, LAPTOP.angle), target: new Vector3(), a: new Vector3(), b: new Vector3(), light: new Vector3() };
  }, []);

  const cancelPendingResume = useCallback(() => {
    pendingResume.current = null;
    if (resumeFrame.current !== null) {
      cancelAnimationFrame(resumeFrame.current);
      resumeFrame.current = null;
    }
  }, []);

  const controls = useMemo<SceneControls>(() => ({
    open(done) {
      cancelPendingResume();
      timeline.current?.kill();
      invalidate();
      const nextTimeline = gsap.timeline({ paused: true, onUpdate: () => { if (isVisible.current) invalidate(); }, onComplete: done });
      const paintThenContinue = () => {
        if (!mounted.current || timeline.current !== nextTimeline) return;
        pendingResume.current = nextTimeline;
        invalidate();
      };
      nextTimeline
        .to(values, { glint: 1, duration: .24, ease: 'power2.out' }, .10)
        .to(values, { glintTravel: 1, duration: .8, ease: 'power1.inOut' }, .10)
        .to(values, { glint: 0, duration: .54, ease: 'power2.inOut' }, .36)
        .to(values, { reveal: 1, duration: .8, ease: 'power2.inOut' }, .8)
        .to(values, { indicator: .65, duration: .45, ease: 'power1.out' }, 1.15)
        .to(values, { opening: 1, duration: 3.4, ease: openingEase }, 1.8)
        // These are render barriers, not timed loading delays: a slow renderer
        // must actually paint the glint and full edge before the lid can move.
        .addPause(.34, paintThenContinue)
        .addPause(1.6, paintThenContinue);
      timeline.current = nextTimeline;
      nextTimeline.play(0);
    },
    replay(done) { Object.assign(values, {opening:0, brightness:0, indicator:0, reveal:0, progress:0, glint:0, glintTravel:0}); this.open(done); },
    finish() {
      cancelPendingResume();
      timeline.current?.kill();
      Object.assign(values, { opening: 1, brightness: 1, indicator: 1, gap: 0, reveal: 1, glint: 0, glintTravel: 1 });
      invalidate();
    },
    enter(progress) {
      values.progress = Math.max(0, Math.min(1, progress));
      if (progress > 0 && values.opening < 1) this.finish();
      if (isVisible.current) invalidate();
    },
    visible(visible) { isVisible.current = visible; if (visible) invalidate(); },
  }), [cancelPendingResume, invalidate, values]);

  useEffect(() => {
    mounted.current = true;
    const lost = (event: Event) => { event.preventDefault(); latest.current.onError(); };
    gl.domElement.addEventListener('webglcontextlost', lost, false);
    if (props.debug) {
      const dark = props.debug === 'closed' || props.debug === 'glint';
      const opening = dark || props.debug === 'edge' ? 0 : props.debug === 'gap' ? .08 : props.debug === 'half' ? .52 : 1;
      Object.assign(values, { opening, indicator: dark ? 0 : .65, gap: 0, reveal: dark ? 0 : 1, glint: props.debug === 'glint' ? 1 : 0, glintTravel: props.debug === 'glint' ? .45 : 1 });
    }
    invalidate();
    return () => {
      mounted.current = false;
      cancelPendingResume();
      timeline.current?.kill();
      gl.domElement.removeEventListener('webglcontextlost', lost);
      texture.dispose(); shadow.dispose(); floorLight.dispose();
    };
  }, [cancelPendingResume, gl, invalidate, props.debug, shadow, texture, floorLight, values]);

  useFrame((_, delta) => {
    if (!isVisible.current || gl.getContext().isContextLost()) return;
    const model = handles.current;
    if (!model.lid || !model.screen) return;
    model.lid.rotation.x = LAPTOP.angle * values.opening;
    model.lid.updateWorldMatrix(true, true);
    values.brightness = smooth(clamp((values.opening - .45) / .48));
    model.screen.color.setScalar(values.brightness);
    if (props.cinematic) {
      const bodyReveal = smooth(values.opening);
      _.scene.environmentIntensity = .008 + values.reveal * (.07 + .72 * bodyReveal);
      studio.current?.traverse(object => {
        if (!(object instanceof Light)) return;
        object.userData.baseIntensity ??= object.intensity;
        if (object.name === 'glint') {
          object.position.x = -1.65 + values.glintTravel * 1.1;
          object.lookAt(object.position.x, .255, 2.06);
          object.intensity = object.userData.baseIntensity * values.glint;
          return;
        }
        const factor = object.name === 'edge'
          ? (.01 + values.reveal * .55) * (1 - .97 * bodyReveal)
          : .005 + values.reveal * (.015 + .98 * bodyReveal);
        object.intensity = object.userData.baseIntensity * factor;
      });
    }
    if (model.indicator) model.indicator.opacity = values.indicator;
    // Light follows the physical opening, with a short glow at the first gap.
    const gap = smooth(clamp(values.opening / .045)) * (1 - smooth(clamp((values.opening - .10) / .20))) * .42;
    if (model.gap) model.gap.opacity = gap;
    if (fill.current) {
      math.light.set(0, LAPTOP.screenY - .08, LAPTOP.screenZ);
      model.lid.localToWorld(math.light);
      fill.current.position.copy(math.light);
      // RectAreaLight emits along local -Z; its plane must remain parallel to the lid.
      fill.current.rotation.set(model.lid.rotation.x - Math.PI / 2, 0, 0);
      // The near-black cover emits a restrained fill; the studio softbox must
      // retain the metal's directional reflection instead of washing out the deck.
      fill.current.intensity = values.brightness * .42 + Math.sin(values.opening * Math.PI) * .8;
    }
    if (floor.current) floor.current.opacity = .015 + values.reveal * .12 + values.brightness * .36 + gap * .08;
    // Read-only QA hooks expose the lighting sequence without causing React
    // renders or coupling the physical scene to page-level intro state.
    gl.domElement.dataset.introStage = values.progress > 0 ? 'entering'
      : values.opening >= 1 ? 'ready'
      : values.opening > 0 ? 'opening'
      : values.reveal > .01 ? 'edge'
      : values.glint > .01 ? 'glint' : 'dark';
    gl.domElement.dataset.glint = values.glint.toFixed(3);
    gl.domElement.dataset.edgeReveal = values.reveal.toFixed(3);
    gl.domElement.dataset.lidOpening = values.opening.toFixed(3);
    const aspect = size.width / size.height;
    const tan = Math.tan(28 * Math.PI / 360);
    const initialDistance = Math.max(size.width < 800 ? 14.3 : 13.9, 4 + 3.2 / (tan * aspect * .89));
    const fitWidth = LAPTOP.screenWidth / (2 * tan * aspect);
    const fitHeight = LAPTOP.screenHeight / (2 * tan);
    // A phone uses a shorter dissolve with the whole display readable; desktop fills the stage.
    const finalDistance = (size.width < 680 ? Math.max(fitWidth, fitHeight) : Math.min(fitWidth, fitHeight)) * .996;
    const travel = smooth(values.progress);
    camera.position.copy(math.center).addScaledVector(math.normal, initialDistance + (finalDistance - initialDistance) * travel).addScaledVector(math.up, -1.2 * (1 - travel));
    math.target.copy(camera.position).sub(math.normal);
    camera.lookAt(math.target);
    if (camera instanceof PerspectiveCamera) { camera.aspect = aspect; camera.updateProjectionMatrix(); }
    if (props.stillFrame && camera instanceof PerspectiveCamera) frameStillLaptop(camera, size.width, size.height);
    if (props.cinematic && camera instanceof PerspectiveCamera) frameCinematicLaptop(camera, size.width, size.height, values.progress);
    camera.updateMatrixWorld();
    if (props.onDisplay) {
      const corners: [number,number][] = [];
      for (const [x,z] of [[-1,1],[1,1],[1,-1],[-1,-1]]) {
        math.a.set(x*LAPTOP.screenWidth/2,LAPTOP.screenY-.001,LAPTOP.screenZ+z*LAPTOP.screenHeight/2);
        model.lid.localToWorld(math.a).project(camera);
        corners.push([(math.a.x+1)*size.width/2,(1-math.a.y)*size.height/2]);
      }
      latest.current.onDisplay?.(corners, values.brightness, values.opening);
    }
    math.a.set(-LAPTOP.screenWidth / 2, LAPTOP.screenY, LAPTOP.screenZ + LAPTOP.screenHeight / 2);
    math.b.set(LAPTOP.screenWidth / 2, LAPTOP.screenY, LAPTOP.screenZ - LAPTOP.screenHeight / 2);
    model.lid.localToWorld(math.a).project(camera);
    model.lid.localToWorld(math.b).project(camera);
    latest.current.onBounds({ left: (math.a.x + 1) * size.width / 2, top: (1 - math.a.y) * size.height / 2, width: (math.b.x - math.a.x) * size.width / 2, height: (math.a.y - math.b.y) * size.height / 2 }, values.progress);
    gl.render(_.scene, camera);
    const pausedTimeline = pendingResume.current;
    if (pausedTimeline && resumeFrame.current === null) {
      pendingResume.current = null;
      // Resume on the following browser frame, after this rendered image has
      // had an opportunity to composite. Cancellation invalidates both guards.
      resumeFrame.current = requestAnimationFrame(() => {
        resumeFrame.current = null;
        if (!mounted.current || timeline.current !== pausedTimeline || gl.getContext().isContextLost()) return;
        if (!isVisible.current) { pendingResume.current = pausedTimeline; return; }
        pausedTimeline.resume();
        invalidate();
      });
    }
    if (!firstFrame.current) {
      firstFrame.current = true;
      requestAnimationFrame(() => { if (mounted.current && !gl.getContext().isContextLost()) latest.current.onReady(controls); });
    }
    if (!props.debug && !frames.current.adapted) {
      frames.current.count++;
      if (delta > .08) frames.current.slow++;
      if (frames.current.count >= 3 && frames.current.slow >= 2) {
        frames.current.adapted = true;
        setDpr(1);
        latest.current.onSlowRenderer();
      }
    }
  }, 1);

  return <>
    <group ref={studio}><StudioLighting glintEnabled={props.cinematic} /></group>
    <rectAreaLight ref={fill} width={5.2} height={2.5} color="#dce4eb" intensity={0} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.015, 0]}>
      <planeGeometry args={[200, 200]} />
      <meshBasicMaterial color="#030810" toneMapped={false} />
    </mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.012, -.5]}>
      <planeGeometry args={[16, 12]} />
      <meshBasicMaterial ref={floor} map={floorLight} transparent opacity={.3} depthWrite={false} toneMapped={false} />
    </mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .001, 0]}>
      <planeGeometry args={[8.7, 5.7]} />
      <meshBasicMaterial map={shadow} transparent opacity={.88} depthWrite={false} toneMapped={false} />
    </mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .002, 0]} receiveShadow>
      <planeGeometry args={[16, 12]} />
      <shadowMaterial transparent opacity={.32} depthWrite={false} />
    </mesh>
    <LaptopModel handles={handles} screenTexture={texture} />
  </>;
}

export default function LaptopCanvas(props: LaptopCanvasProps) {
  // Persist the one-way quality decision across opening/ready/entering renders.
  // A literal dpr prop would silently restore 1.5 after R3F's setDpr(1).
  const [quality, setQuality] = useState(1.5);
  const lowerQuality = useCallback(() => setQuality(1), []);
  return <CanvasBoundary onError={props.onError}>
    <Canvas shadows={{ type: PCFShadowMap }} camera={{ fov: 28, near: .1, far: 250 }} dpr={quality} frameloop="demand" gl={{ alpha: true, antialias: true, powerPreference: 'high-performance', toneMapping: ACESFilmicToneMapping }} onCreated={({ gl }) => { gl.setClearColor(new Color('#030810'), 0); gl.toneMappingExposure = .95; }} fallback={null} aria-hidden="true" style={{ pointerEvents: 'none' }}>
      <Scene {...props} onSlowRenderer={lowerQuality} />
    </Canvas>
  </CanvasBoundary>;
}


