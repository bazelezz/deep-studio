'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { siteConfig, type Project } from '@/config/site';
import { assetPath } from '@/config/assetPath';
import styles from './ProjectReel.module.css';

function ProjectFrame({ project, index }: { project: Project; index: number }) {
  return <article className={styles.frame} data-project-frame>
    <div className={styles.picture}>
      <Image src={assetPath(project.image)} alt={project.imageAlt} width={1600} height={1100} sizes="(min-width: 901px) 72vw, 100vw" loading="lazy" unoptimized />
      <span className={styles.frameNumber} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
      {project.demoCover && <span className={styles.coverLabel}>Демонстрационная обложка</span>}
    </div>
    <div className={styles.caption}>
      <div><span className={styles.category}>{project.category}</span><h3>{project.title}</h3></div>
      {project.url && <a className={styles.projectLink} href={project.url} target="_blank" rel="noopener noreferrer" aria-label={`Открыть проект: ${project.title}`}><span>Открыть проект</span><span aria-hidden="true">↗</span></a>}
    </div>
    {(project.task || project.role || project.solution) && <dl className={styles.details}>
      {project.task && <><dt>Задача</dt><dd>{project.task}</dd></>}
      {project.role && <><dt>Моя роль</dt><dd>{project.role}</dd></>}
      {project.solution && <><dt>Решение</dt><dd>{project.solution}</dd></>}
    </dl>}
  </article>;
}

export default function ProjectReel() {
  const rootRef = useRef<HTMLElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);
  const projects = siteConfig.projects.filter((project) => project.visible);

  useEffect(() => {
    const root = rootRef.current;
    const viewport = viewportRef.current;
    const track = trackRef.current;
    const progress = progressRef.current;
    if (!root || !viewport || !track || !progress || projects.length < 2) return;

    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();
    media.add('(min-width: 901px) and (min-height: 620px) and (prefers-reduced-motion: no-preference)', () => {
      root.dataset.enhanced = 'true';
      let refreshFrame = 0;
      let alive = true;
      let previousWidth = viewport.clientWidth;
      let previousHeight = viewport.clientHeight;
      const distance = () => Math.max(0, track.scrollWidth - viewport.clientWidth);
      const animation = gsap.timeline({
        scrollTrigger: {
          trigger: root,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.55,
          invalidateOnRefresh: true,
        },
      });
      animation.fromTo(track, { x: 0 }, { x: () => -distance(), duration: 1, ease: 'none' }, 0);
      animation.fromTo(progress, { scaleX: 0 }, { scaleX: 1, duration: 1, ease: 'none' }, 0);

      const scheduleRefresh = () => {
        cancelAnimationFrame(refreshFrame);
        refreshFrame = requestAnimationFrame(() => {
          if (alive) ScrollTrigger.refresh();
        });
      };
      const resize = new ResizeObserver(() => {
        const width = viewport.clientWidth;
        const height = viewport.clientHeight;
        if (width === previousWidth && height === previousHeight) return;
        previousWidth = width;
        previousHeight = height;
        scheduleRefresh();
      });
      resize.observe(viewport);
      document.fonts.ready.then(() => { if (alive) scheduleRefresh(); });
      scheduleRefresh();

      return () => {
        alive = false;
        cancelAnimationFrame(refreshFrame);
        resize.disconnect();
        animation.scrollTrigger?.kill();
        animation.revert();
        delete root.dataset.enhanced;
      };
    }, root);
    return () => media.revert();
  }, [projects.length]);

  if (!projects.length) return null;

  return <section className={styles.reel} id="projects" aria-labelledby="project-reel-title" ref={rootRef}>
    <div className={styles.viewport} ref={viewportRef}>
      <header className={styles.header}>
        <div className={styles.heading}><span className={styles.eyebrow}>Из последних направлений</span><h2 id="project-reel-title">Разные миры.<br /><span>Один подход.</span></h2></div>
        <div className={styles.legend}><span className={styles.reelIndex}>01 — {String(projects.length).padStart(2, '0')}</span><span>Характер меняется.<br />Внимание остаётся.</span></div>
      </header>
      <div className={styles.track} ref={trackRef}>{projects.map((project, index) => <ProjectFrame project={project} index={index} key={project.id} />)}</div>
      <div className={styles.bottom}>
        <p>Обложки — авторские эскизы, не скриншоты сайтов.<br />Реальные материалы проектов готовятся.</p>
        <div className={styles.progress} aria-hidden="true"><span ref={progressRef} /></div>
        <span className={styles.scrollHint} aria-hidden="true">Листайте дальше <span>↓</span></span>
      </div>
    </div>
  </section>;
}
