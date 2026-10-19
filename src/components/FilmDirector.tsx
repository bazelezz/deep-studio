'use client';

import { useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

/** Own only the inner film artwork; the projected display belongs to SceneExperience. */
export default function FilmDirector() {
  useEffect(() => {
    const scene = document.getElementById('scene');
    if (!scene) return;

    gsap.registerPlugin(ScrollTrigger);
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let alive = true;
    let firstFrame = 0;
    let secondFrame = 0;
    let context: gsap.Context | null = null;
    const isContent = () => scene.dataset.sceneState === 'content';

    const cancelFrames = () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      firstFrame = secondFrame = 0;
    };

    const reset = () => {
      cancelFrames();
      context?.revert();
      context = null;
    };

    const prepareFilm = () => {
      if (context || preference.matches) return;
      const artwork = scene.querySelectorAll<HTMLElement>('[data-film-art]');
      const title = scene.querySelectorAll<HTMLElement>('[data-film-title]');
      if (!artwork.length && !title.length) return;

      context = gsap.context(() => {
        const sequence = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            trigger: scene,
            start: 'top top',
            end: 'bottom top',
            scrub: .65,
            invalidateOnRefresh: true,
          },
        });
        if (artwork.length) sequence.fromTo(artwork, { scale: 1, yPercent: 0 }, { scale: 1.1, yPercent: 12, duration: 1 }, 0);
        if (title.length) sequence.fromTo(title, { yPercent: 0, opacity: 1 }, { yPercent: -18, opacity: 0, duration: 1 }, 0);
      }, scene);
    };

    const refreshAfterLayout = () => {
      cancelFrames();
      if (!alive || !isContent()) return;
      // SceneExperience removes body:fixed in a layout-effect cleanup. Let that
      // commit and the following layout settle before measuring every sequence.
      firstFrame = requestAnimationFrame(() => {
        firstFrame = 0;
        secondFrame = requestAnimationFrame(() => {
          secondFrame = 0;
          if (!alive || !isContent()) return;
          prepareFilm();
          ScrollTrigger.refresh();
        });
      });
    };

    const syncScene = () => {
      if (!isContent()) { reset(); return; }
      refreshAfterLayout();
    };
    const changePreference = () => {
      reset();
      refreshAfterLayout();
    };
    const observer = new MutationObserver(syncScene);
    observer.observe(scene, { attributes: true, attributeFilter: ['data-scene-state'] });
    preference.addEventListener('change', changePreference);
    document.fonts.ready.then(() => { if (alive) refreshAfterLayout(); });
    syncScene();

    return () => {
      alive = false;
      observer.disconnect();
      preference.removeEventListener('change', changePreference);
      reset();
    };
  }, []);

  return null;
}
