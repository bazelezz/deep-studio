'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { gsap } from 'gsap';
import artwork from '@/config/brandArtwork.json';
import styles from './LightStudy.module.css';

/** An optical section of one object: its construction and its finished surface. */
export default function LightStudy({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const range = useRef<HTMLInputElement>(null);
  const reveal = useRef({ value: 100 });
  const animation = useRef<gsap.core.Tween | null>(null);
  const writeValue = (value: number) => {
    reveal.current.value = value;
    root.current?.style.setProperty('--cut', `${100 - value}%`);
    // The light only becomes visible over the object, never in the empty margin
    // where it could cross the mobile reading column.
    const cut = 100 - value;
    root.current?.style.setProperty('--beam', String(Math.max(0, Math.min(1, (cut - 18) / 7, (86 - cut) / 7))));
    root.current?.setAttribute('data-material', String(Math.round(value)));
    if (range.current) {
      range.current.value = String(value);
      range.current.setAttribute('aria-valuetext', `Готовая форма: ${Math.round(value)} процентов`);
    }
  };

  useEffect(() => {
    const element = root.current;
    const scene = element?.closest<HTMLElement>('#scene');
    if (!element || !scene) return;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    let played = false;
    const sync = () => {
      const enabled = scene.dataset.sceneState === 'content';
      element.dataset.enabled = String(enabled);
      if (!enabled) {
        animation.current?.kill();
        writeValue(100);
        return;
      }
      if (!played) {
        played = true;
        if (!media.matches) animation.current = gsap.to(reveal.current, {
          value: 56, delay: .3, duration: 1.65, ease: 'power2.inOut',
          onUpdate: () => writeValue(reveal.current.value),
        });
      }
    };
    const changePreference = () => {
      animation.current?.kill();
      if (media.matches) writeValue(100);
    };
    const observer = new MutationObserver(sync);
    observer.observe(scene, { attributes: true, attributeFilter: ['data-scene-state'] });
    media.addEventListener('change', changePreference);
    sync();
    return () => {
      observer.disconnect();
      media.removeEventListener('change', changePreference);
      animation.current?.kill();
    };
  }, []);

  const takeControl = () => animation.current?.kill();
  return <div ref={root} className={styles.study} data-light-study data-material="100" data-enabled="false">
    <div className={styles.drawing} data-light-drawing aria-hidden="true">
      <div className={styles.material}>{children}</div>
      <div className={styles.blueprint}>
        <svg viewBox="0 0 820 850" fill="none" focusable="false">
          <g stroke="#7394a6" strokeWidth=".65" opacity=".38">
            <path d="M120 110H702V690H120ZM120 255H702M120 400H702M120 545H702M265 110V690M410 110V690M555 110V690"/>
            <circle cx="410" cy="400" r="290" strokeDasharray="2 8"/>
          </g>
          <g transform="translate(82 82) scale(9.1) skewY(-8)" stroke="#abc8d6" strokeWidth=".18">
            <g transform="translate(3.24 2.592)" opacity=".38">{artwork.symbol.paths.map((path,i)=><path key={i} d={path}/>)}</g>
            {artwork.symbol.paths.map((path,i)=><path key={i} d={path}/>)}
            <path d="M8 26H20M28 6V17M44 38H56M36 47V58M8 50 11.24 52.592M56 14 59.24 16.592M40 6 43.24 8.592M24 58 27.24 60.592" opacity=".6"/>
          </g>
          <g stroke="#c6dbe4" strokeWidth="1.1">
            <path d="M112 110H128M120 102V118M694 110H710M702 102V118M112 690H128M120 682V698M694 690H710M702 682V698"/>
          </g>
          <g fill="#94adbc" fontFamily="monospace" fontSize="11" letterSpacing="2">
            <text x="120" y="88">ЗАМЫСЕЛ</text><text x="557" y="720">ПРОПОРЦИИ / РИТМ</text>
          </g>
        </svg>
      </div>
      <div className={styles.cut}><span>СВЕТОВОЙ СРЕЗ</span><i/></div>
    </div>
    <div className={styles.controls}>
      <div className={styles.legend}><span>Чертёж</span><span className={styles.hint}>Проведите светом <i aria-hidden="true">↔</i></span><span>Материал</span></div>
      <input ref={range} type="range" min="0" max="100" step="1" defaultValue="100"
        aria-label="Световой срез — от чертежа к материалу"
        aria-valuetext="Готовая форма: 100 процентов"
        onPointerDown={takeControl} onKeyDown={takeControl}
        onInput={event => { takeControl(); writeValue(Number(event.currentTarget.value)); }}/>
    </div>
  </div>;
}
