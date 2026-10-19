'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import DemoInterface from './DemoInterface';
import styles from './ScrollShowcase.module.css';

const acts = [
  { word: 'Форма.', title: 'Сначала — форма.', label: '01 / СЕТКА' },
  { word: 'Тише.', title: 'Тише.', label: '02 / СДЕРЖАННО' },
  { word: 'Смелее.', title: 'Смелее.', label: '03 / СМЕЛО' },
  { word: 'Ближе.', title: 'Ближе.', label: '04 / МАЛЫЙ ФОРМАТ' },
];

export default function ScrollShowcase() {
  const root = useRef<HTMLElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const wire = useRef<HTMLDivElement>(null);
  const bold = useRef<HTMLDivElement>(null);
  const quiet = useRef<HTMLDivElement>(null);
  const sweep = useRef<HTMLDivElement>(null);
  const progress = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState(1);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: reduce)', () => { setPhase(1); });
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const node = root.current;
      if (!node || !panel.current) return;
      node.dataset.enhanced = 'true';
      let current = -1;
      const small = () => window.innerWidth <= 700;
      const initialWidth = () => Math.min(window.innerWidth * (small() ? .9 : .82), 1320);
      const phoneWidth = () => Math.min(338, window.innerWidth * .84);
      const captions = gsap.utils.toArray<HTMLElement>('[data-story-copy]', node);
      const words = gsap.utils.toArray<HTMLElement>('[data-story-word]', node);
      const timeline = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: node, start: 'top top', end: 'bottom bottom', scrub: .35,
          invalidateOnRefresh: true,
          onUpdate: self => {
            const next = self.progress < .2 ? 0 : self.progress < .42 ? 1 : self.progress < .76 ? 2 : 3;
            node.dataset.progress = self.progress.toFixed(3);
            progress.current?.style.setProperty('--progress', String(self.progress));
            if (next !== current) { current = next; node.dataset.act = String(next); setPhase(next); }
          },
        },
      });
      gsap.set(panel.current, { width: initialWidth, xPercent: -50, scale: .91, y: 50 });
      gsap.set(bold.current, { clipPath: 'inset(0 100% 0 0)' });
      gsap.set(quiet.current, { opacity: 1 });
      gsap.set(wire.current, { opacity: 1 });
      gsap.set(captions, { autoAlpha: 0, y: 18 });
      gsap.set(words, { autoAlpha: 0, xPercent: 3 });
      gsap.set([captions[0], words[0]], { autoAlpha: 1, y: 0, xPercent: 0 });
      timeline.to(panel.current, { scale: 1, y: 0, duration: .18 }, 0)
        .to(wire.current, { opacity: 0, duration: .12 }, .09)
        .to(bold.current, { clipPath: 'inset(0 0% 0 0)', duration: .26 }, .38)
        .fromTo(sweep.current, { left: '0%', opacity: 0 }, { opacity: 1, duration: .015 }, .38)
        .to(sweep.current, { left: '100%', duration: .26 }, .38)
        .to(sweep.current, { opacity: 0, duration: .025 }, .64)
        .to(node, { '--wash': 1, duration: .26 }, .38)
        .to(quiet.current, { opacity: 0, duration: .01 }, .65)
        .to(panel.current, { width: phoneWidth, duration: .22 }, .70)
        .to(node, { '--wash': .2, duration: .2 }, .73)
        .to({}, { duration: .08 }, .92);
      for (let index = 1; index < acts.length; index++) {
        const at = [0, .18, .4, .75][index];
        timeline.to(captions[index - 1], { autoAlpha: 0, y: -14, duration: .045 }, at)
          .to(words[index - 1], { autoAlpha: 0, xPercent: -4, duration: .06 }, at)
          .to(captions[index], { autoAlpha: 1, y: 0, duration: .055 }, at + .045)
          .to(words[index], { autoAlpha: 1, xPercent: 0, duration: .08 }, at + .035);
      }
      let alive = true;
      const refresh = () => { if (alive) ScrollTrigger.refresh(); };
      document.fonts.ready.then(refresh);
      // Only watch width: scroll-height changes during intro locking must not form a refresh loop.
      let lastWidth = document.documentElement.clientWidth;
      const resize = () => { const width = document.documentElement.clientWidth; if (Math.abs(width - lastWidth) > 2) { lastWidth = width; refresh(); } };
      window.addEventListener('resize', resize);
      return () => {
        alive = false;
        window.removeEventListener('resize', resize);
        delete node.dataset.enhanced; delete node.dataset.act; delete node.dataset.progress;
      };
    });
    return () => media.revert();
  }, []);

  return <section ref={root} id="capabilities" className={styles.experience} aria-label="От структуры к характеру — история одного интерфейса">
    <div className={styles.sticky}>
      <div className={styles.wash} aria-hidden="true" />
      <div className={styles.topline}><span>Ⅱ / ФОРМА И ХАРАКТЕР</span><span>DEEP — ВИЗУАЛЬНЫЙ ЭТЮД</span></div>
      <div className={styles.words} aria-hidden="true">{acts.map((act, index) => <span key={act.word} data-story-word className={index === 1 ? styles.defaultWord : ''}>{act.word}</span>)}</div>
      <div className={styles.captions}>{acts.map((act, index) => <div data-story-copy key={act.label} aria-hidden={phase !== index} className={`${styles.caption} ${index === 1 ? styles.defaultCaption : ''}`}><h2>{act.title}</h2><span>{act.label}</span></div>)}</div>
      <div ref={panel} className={styles.panel} role="img" aria-label="Один интерфейс в двух характерах: спокойный дизайн с плавной типографикой и смелый с крупным шрифтом и ярким цветом. На узком экране колонки перестраиваются вертикально.">
        <div ref={quiet} className={styles.quiet} aria-hidden="true"><DemoInterface presentation character="quiet" instanceId="scroll-quiet" /></div>
        <div ref={bold} className={styles.bold} aria-hidden="true"><DemoInterface presentation character="bold" instanceId="scroll-bold" /></div>
        <div ref={wire} className={styles.wire} aria-hidden="true"><div className={styles.wireNav}><b>форма°</b><span>01 — КАРКАС</span></div><div className={styles.wireCopy}><span>СНАЧАЛА СМЫСЛ</span><strong>Место<br/>для идеи.</strong><i/><i/><i/><div/></div><div className={styles.wireArt}><svg viewBox="0 0 200 220"><path d="M40 200V100a60 60 0 0 1 120 0v100H40Zm30 0V100a30 30 0 0 1 60 0v100M20 200h160M100 15v205M20 100h160" /></svg><span>ФОРМА ЕЩЁ ВПЕРЕДИ</span></div><span className={styles.wireFooter}>СЕТКА / ИЕРАРХИЯ / ДЕЙСТВИЕ</span></div>
        <div ref={sweep} className={styles.sweep} aria-hidden="true"><span>СМЕНА ХАРАКТЕРА</span></div>
      </div>
      <div className={styles.phoneNote} aria-hidden="true"><span>ТОТ ЖЕ ХАРАКТЕР.</span><i>↙</i></div>
      <div className={styles.bottom}><span className={styles.demoLabel}>Демонстрация интерфейса</span><div className={styles.track} ref={progress}><span/></div><span className={styles.count}>0{phase + 1}<i> / 04</i></span></div>
    </div>
    <div className={styles.staticDescription}><p>Одна структура может говорить по-разному. Спокойная типографика и свободное пространство — или выразительный цвет и крупные акценты. На телефоне интерфейс меняет композицию, сохраняя характер.</p></div>
  </section>;
}
