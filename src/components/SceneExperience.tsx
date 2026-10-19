'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { gsap } from 'gsap';
import { assetPath } from '@/config/assetPath';
import type { LaptopCanvasProps, SceneControls, SceneDebug, ScenePhase, ScreenQuad } from './scene/types';
import { displayMatrix } from './scene/projectDisplay';
import { lockIntroViewport } from './scene/introViewport';
import styles from './SceneExperience.module.css';

type FinishReason = 'entered' | 'skip' | 'reduced-motion' | 'fallback';

export default function SceneExperience({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<ScenePhase>('poster');
  const [reason, setReason] = useState<FinishReason>('entered');
  const [Scene, setScene] = useState<ComponentType<LaptopCanvasProps> | null>(null);
  const [prepared, setPrepared] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [debug, setDebug] = useState<SceneDebug>(null);
  const root = useRef<HTMLElement>(null), display = useRef<HTMLDivElement>(null), cameraWarp = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null), pendingAnchor = useRef('');
  const controls = useRef<SceneControls | null>(null), phaseRef = useRef<ScenePhase>('poster');
  const alive = useRef(false), reduced = useRef(false), completed = useRef(false);
  const debugRef = useRef<SceneDebug>(null), deadline = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const expansion = useRef({ progress: 0 });
  const change = useCallback((next: ScenePhase) => { phaseRef.current = next; setPhase(next); }, []);

  const complete = useCallback((why: FinishReason = 'entered') => {
    if (!alive.current || completed.current) return;
    completed.current = true;
    timeline.current?.kill();
    if (deadline.current) clearTimeout(deadline.current);
    controls.current?.finish(); controls.current?.visible(false); controls.current = null;
    setReason(why); change('content');
    if (display.current) {
      Object.assign(display.current.style, { transform: 'none', opacity: '1', width: '100%', height: '100%', borderRadius: '0px' });
      display.current.style.setProperty('--reveal-progress', '1');
    }
    if (root.current) root.current.dataset.enterProgress = '1.000';
    const anchor = pendingAnchor.current;
    pendingAnchor.current = '';
    if (anchor) requestAnimationFrame(() => {
      if (!alive.current || !completed.current) return;
      try { document.getElementById(decodeURIComponent(anchor.slice(1)))?.scrollIntoView({ behavior: 'instant', block: 'start' }); }
      catch { /* A malformed fragment cannot block the intro or the website. */ }
    });
  }, [change]);
  const fail = useCallback(() => complete('fallback'), [complete]);
  const finish = useCallback(() => complete('skip'), [complete]);

  const beginEntry = useCallback(() => {
    if (!alive.current || completed.current || !controls.current) return;
    timeline.current?.kill();
    timeline.current = gsap.timeline()
      .to({}, { duration: .65 })
      .call(() => change('entering'))
      .to(expansion.current, {
        progress: 1, duration: 1.65, ease: 'power2.inOut',
        onUpdate: () => controls.current?.enter(expansion.current.progress),
        onComplete: () => {
          // Paint the final projected frame before releasing the same DOM node.
          requestAnimationFrame(() => { if (alive.current && !completed.current) complete(); });
        },
      });
  }, [change, complete]);

  useEffect(() => {
    let active = true;
    // Keep the short intro on wall-clock time even when a device drops frames.
    // GSAP's default lag compensation otherwise turns a 1.65s entry into a long wait.
    gsap.ticker.lagSmoothing(0);
    alive.current = true; completed.current = false;
    const query = new URLSearchParams(location.search), debugValue = query.get('scene');
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    reduced.current = media.matches;
    const chosen: SceneDebug = ['closed', 'glint', 'edge', 'gap', 'half', 'ready', 'entering'].includes(debugValue ?? '') ? debugValue as SceneDebug : null;
    debugRef.current = chosen;
    pendingAnchor.current = chosen ? '' : location.hash;
    const preference = () => { reduced.current = media.matches; if (media.matches) complete('reduced-motion'); };
    media.addEventListener('change', preference);
    queueMicrotask(() => {
      if (!active) return;
      setHydrated(true); setDebug(chosen);
      if (debugValue === 'poster') { complete('fallback'); return; }
      if (!chosen && media.matches) { complete('reduced-motion'); return; }
      change('preparing');
      deadline.current = setTimeout(() => { if (active) fail(); }, 3000);
      Promise.all([import('./scene/LaptopCanvas'), document.fonts.ready]).then(([module]) => {
        if (active && !completed.current) setScene(() => module.default);
      }).catch(() => { if (active) fail(); });
    });
    return () => {
      active = false; alive.current = false; controls.current = null;
      timeline.current?.kill(); if (deadline.current) clearTimeout(deadline.current);
      gsap.ticker.lagSmoothing(500, 33);
      media.removeEventListener('change', preference);
    };
  }, [change, complete, fail]);

  const content = phase === 'content';
  useLayoutEffect(() => {
    if (!hydrated || content || !root.current) return;
    return lockIntroViewport(root.current, finish);
  }, [hydrated, content, finish]);

  const onReady = useCallback((engine: SceneControls) => {
    if (!alive.current || completed.current) return;
    if (deadline.current) clearTimeout(deadline.current);
    controls.current = engine; setPrepared(true);
    if (debugRef.current) {
      if (debugRef.current === 'entering') { engine.finish(); expansion.current.progress = .5; engine.enter(.5); change('entering'); }
      else change('ready');
      return;
    }
    if (reduced.current) { complete('reduced-motion'); return; }
    change('opening');
    engine.open(() => {
      if (alive.current && !completed.current) { change('ready'); beginEntry(); }
    });
  }, [beginEntry, change, complete]);

  const onDisplay = useCallback((corners: ScreenQuad, brightness: number, opening: number) => {
    if (!display.current || !root.current || !stage.current || completed.current) return;
    const p = expansion.current.progress;
    const width = stage.current.clientWidth, height = stage.current.clientHeight;
    const viewport: ScreenQuad = [[0, 0], [width, 0], [width, height], [0, height]];
    // Use the real four screen corners, correcting the whole device image too.
    const target: ScreenQuad = corners.map(([x, y], i) => [x + (viewport[i][0] - x) * p, y + (viewport[i][1] - y) * p]);
    const sourceMatrix = displayMatrix(corners), targetMatrix = displayMatrix(target);
    if (sourceMatrix && targetMatrix && cameraWarp.current) {
      cameraWarp.current.style.transform = p === 0 ? 'none' : new DOMMatrix(targetMatrix).multiply(new DOMMatrix(sourceMatrix).inverse()).toString();
      // Portrait composition grows beyond the physical 16:10 display. Retire the
      // hardware early, while the same HTML keeps expanding, rather than elongating it.
      cameraWarp.current.style.opacity = String(width < 700 ? Math.max(0, 1 - p * 1.65) : 1);
    }
    const planeWidth = 1600 + (width - 1600) * p;
    const edge = (a: number, b: number) => Math.hypot(target[a][0] - target[b][0], target[a][1] - target[b][1]);
    const targetAspect = (edge(0, 3) + edge(1, 2)) / (edge(0, 1) + edge(3, 2));
    const aspectMix = Math.min(1, p * 4);
    // Reflow the HTML to the expanding plane's aspect, rather than stretching letters.
    const planeHeight = planeWidth * (.625 + (targetAspect - .625) * aspectMix);
    const matrix = displayMatrix(target, planeWidth, planeHeight);
    if (matrix) display.current.style.transform = matrix;
    display.current.style.width = `${planeWidth}px`; display.current.style.height = `${planeHeight}px`;
    display.current.style.borderRadius = `${13.55 * (planeWidth / 1600) * (1 - p)}px`;
    display.current.style.opacity = String(Math.max(0, Math.min(1, brightness)));
    display.current.style.setProperty('--reveal-progress', String(p));
    root.current.dataset.openAmount = opening.toFixed(3);
    root.current.dataset.enterProgress = p.toFixed(3);
  }, []);

  const replay = () => {
    if (reduced.current) return;
    pendingAnchor.current = '';
    completed.current = false; debugRef.current = null; setDebug(null); setPrepared(false);
    expansion.current.progress = 0; change('preparing');
    if (display.current) { display.current.style.opacity = '0'; display.current.style.setProperty('--reveal-progress', '0'); }
    deadline.current = setTimeout(fail, 3000);
    if (!Scene) Promise.all([import('./scene/LaptopCanvas'), document.fonts.ready]).then(([module]) => {
      if (alive.current && !completed.current) setScene(() => module.default);
    }).catch(fail);
  };

  useEffect(() => {
    const navigate = (event: MouseEvent) => { if (phaseRef.current !== 'content' && event.target instanceof Element && event.target.closest('a[href^="#"]')) finish(); };
    const observer = new IntersectionObserver(([entry]) => controls.current?.visible(entry.isIntersecting), { rootMargin: '80px' });
    if (root.current) observer.observe(root.current);
    document.addEventListener('click', navigate, true);
    return () => { observer.disconnect(); document.removeEventListener('click', navigate, true); };
  }, [finish, prepared]);

  return <section id="scene" ref={root} className={`${styles.experience} ${content ? styles.content : hydrated ? styles.playing : ''}`} data-scene-state={phase} data-scene-reason={content ? reason : undefined} aria-label="Сайт рождается из света">
    <div ref={stage} className={styles.stage}>
      {!content && <>
        <div className={`${styles.poster} ${prepared ? styles.posterHidden : ''}`} aria-hidden="true"><picture>
          <source media="(max-width:480px)" srcSet={assetPath('/images/atelier-mobile-closed.webp')} />
          <source media="(max-width:800px)" srcSet={assetPath('/images/atelier-tablet-closed.webp')} />
          <img src={assetPath('/images/atelier-desktop-closed.webp')} width="1440" height="900" alt="" fetchPriority="high" />
        </picture></div>
        <div ref={cameraWarp} className={styles.cameraWarp} aria-hidden="true"><div className={`${styles.canvas} ${prepared ? styles.canvasReady : ''}`}>
          {Scene && <Scene cinematic debug={debug} onReady={onReady} onError={fail} onBounds={() => {}} onDisplay={onDisplay} />}
        </div></div>
      </>}
      <div ref={display} data-live-display className={styles.display} inert={hydrated && !content}>{children}</div>
      <div className={styles.status}>
        {!content && !debug && <button onClick={finish}>Пропустить вступление <span aria-hidden="true">↗</span></button>}
        {content && reason !== 'reduced-motion' && <button onClick={replay}>Повторить вступление <span aria-hidden="true">↻</span></button>}
      </div>
    </div>
    <noscript><style>{`.${styles.display}{--reveal-progress:1;transform:none!important;opacity:1!important;width:100%!important;height:100%!important}.${styles.poster},.${styles.cameraWarp},.${styles.status}{display:none!important}`}</style></noscript>
  </section>;
}
