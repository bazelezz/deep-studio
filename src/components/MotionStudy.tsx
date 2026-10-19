'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import styles from './MotionStudy.module.css';

const formats = [
  {number:'01',title:'Лендинг.',subtitle:'Одна цель. Точный фокус.',description:'Услуга, продукт или запуск — всё внимание на одном предложении.',kind:'landing'},
  {number:'02',title:'Сайт компании.',subtitle:'Разные стороны. Цельный образ.',description:'Услуги, направления и история бизнеса складываются в понятную систему.',kind:'company'},
  {number:'03',title:'Особый проект.',subtitle:'Когда привычного недостаточно.',description:'Индивидуальная структура, нестандартные взаимодействия и собственный визуальный язык.',kind:'custom'},
];

function Architecture() {
  return <svg viewBox="0 0 600 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="arch-sky" x2="0" y2="1"><stop stopColor="#c1cecb"/><stop offset="1" stopColor="#e5e5db"/></linearGradient><linearGradient id="arch-wall"><stop stopColor="#6b7776"/><stop offset=".55" stopColor="#aab1a9"/><stop offset="1" stopColor="#e4e3d5"/></linearGradient><linearGradient id="arch-side"><stop stopColor="#3d4a4c"/><stop offset="1" stopColor="#788783"/></linearGradient></defs><rect width="600" height="600" fill="url(#arch-sky)"/><path d="M60 600V225L390 65 560 168V600Z" fill="url(#arch-side)"/><path d="M60 225 390 65V600H60Z" fill="url(#arch-wall)"/>{[0,1,2,3,4,5,6].map(i=><g key={i}><path d={`M${88+i*42} ${222-i*20}v${378+i*20}h14V${215-i*20}Z`} fill="#536060"/><path d={`M${102+i*42} ${215-i*20}v${385+i*20}h3V${214-i*20}Z`} fill="#e3e3d4" opacity=".65"/></g>)}{[0,1,2,3,4,5].map(i=><path key={i} d={`M390 ${100+i*80} 560 ${203+i*62}v10L390 ${110+i*80}Z`} fill="#253638" opacity=".7"/>)}<path d="M0 550 390 495 600 598V600H0Z" fill="#bac1b6"/><path d="M60 600 390 495 507 600Z" fill="#657572" opacity=".35"/></svg>;
}

function SitePreview({kind}:{kind:string}) {
  if(kind==='landing') return <div className={`${styles.website} ${styles.landing}`}>
    <div className={styles.siteNav}><strong>ТИХО.</strong><span>ПРОСТРАНСТВО ДЛЯ СЕБЯ</span><span>↗</span></div>
    <div className={styles.landingTitle}>Меньше.<br/><em>Но лучше.</em></div>
    <div className={styles.paperObject}><i/><i/><i/><i/></div>
    <div className={styles.siteBottom}><span>ОБЪЕКТ 01 / СВЕТ И ФОРМА</span><span>Открыть коллекцию ↗</span></div>
  </div>;
  if(kind==='company') return <div className={`${styles.website} ${styles.company}`}>
    <div className={styles.siteNav}><strong>основа</strong><span>ПОДХОД / НАПРАВЛЕНИЯ / КОНТАКТЫ</span><span>↗</span></div>
    <div className={styles.companyGrid}><div><small>АРХИТЕКТУРА И ПРОСТРАНСТВО</small><h4>Собираем<br/><em>перспективу.</em></h4><p>От первой линии<br/>до целостного пространства.</p><span className={styles.companyRule}>ПРОЕКТИРОВАНИЕ <i>01</i></span><span className={styles.companyRule}>ИНТЕРЬЕРЫ <i>02</i></span></div><div className={styles.architecture}><Architecture/></div></div>
    <div className={styles.siteBottom}><span>ИДЕЯ / СРЕДА / ЧЕЛОВЕК</span><span>Посмотреть подход ↗</span></div>
  </div>;
  return <div className={`${styles.website} ${styles.custom}`}>
    <div className={styles.siteNav}><strong>СДВИГ</strong><span>ЭКСПЕРИМЕНТАЛЬНЫЙ ФОРМАТ</span><span>↗</span></div>
    <div className={styles.customGrid} aria-hidden="true">{Array.from({length:9},(_,i)=><i key={i}/>)}</div>
    <div className={styles.customTitle}>Вне<br/><em>рамок.</em></div><span className={styles.customStar} aria-hidden="true">↗</span>
    <div className={styles.siteBottom}><span>НЕПРИВЫЧНОЕ — ВОЗМОЖНО</span><span>Начать исследование ↗</span></div>
  </div>;
}

export default function MotionStudy() {
  const root=useRef<HTMLElement>(null);
  const [phase,setPhase]=useState(0);
  useEffect(()=>{
    gsap.registerPlugin(ScrollTrigger);
    const media=gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)',()=>{
      const node=root.current;if(!node)return;
      const frames=gsap.utils.toArray<HTMLElement>('[data-format-frame]',node);
      const labels=gsap.utils.toArray<HTMLElement>('[data-format-label]',node);
      const finish=node.querySelector('[data-bespoke]');
      const shutters=gsap.utils.toArray<HTMLElement>('[data-shutter]',node);
      const previews=gsap.utils.toArray<HTMLElement>('[data-format-preview]',node);
      let alive=true,current=-1;
      node.dataset.enhanced='true';
      gsap.set(frames.slice(1),{clipPath:'inset(100% 0 0 0)'});
      gsap.set(labels.slice(1),{autoAlpha:0,y:20});
      gsap.set(finish,{autoAlpha:0});
      gsap.set(shutters,{scaleY:1});
      const tl=gsap.timeline({defaults:{ease:'none'},scrollTrigger:{trigger:node,start:'top top',end:'bottom bottom',scrub:.5,invalidateOnRefresh:true,onUpdate:self=>{
        node.dataset.progress=self.progress.toFixed(3);
        const next=self.progress<.25?0:self.progress<.49?1:self.progress<.76?2:3;
        if(current!==next){current=next;setPhase(next);node.dataset.act=String(next);}
      }}});
      tl.fromTo(previews[0],{yPercent:12,scale:.92,rotation:-3},{yPercent:0,scale:1,rotation:-2,duration:.16},0)
        .fromTo(node.querySelectorAll(`.${styles.paperObject} i`),{xPercent:55,rotation:8},{xPercent:0,rotation:0,duration:.19,stagger:.018},0)
        .to(frames[1],{clipPath:'inset(0% 0 0 0)',duration:.12},.22)
        .to(labels[0],{autoAlpha:0,y:-20,duration:.05},.22)
        .to(labels[1],{autoAlpha:1,y:0,duration:.07},.27)
        .fromTo(previews[1],{yPercent:9,rotation:3,scale:.94},{yPercent:0,rotation:1.5,scale:1,duration:.17},.24)
        .fromTo(node.querySelector(`.${styles.architecture}`),{clipPath:'inset(100% 0 0 0)'},{clipPath:'inset(0% 0 0 0)',duration:.17,ease:'power2.out'},.26)
        .fromTo(node.querySelectorAll(`.${styles.companyRule}`),{x:25,autoAlpha:0},{x:0,autoAlpha:1,duration:.1,stagger:.025},.31)
        .to(frames[2],{clipPath:'inset(0% 0 0 0)',duration:.12},.47)
        .to(labels[1],{autoAlpha:0,y:-20,duration:.05},.47)
        .to(labels[2],{autoAlpha:1,y:0,duration:.07},.52)
        .fromTo(previews[2],{scale:1.1,rotation:-2},{scale:1,rotation:0,duration:.16},.49)
        .fromTo(node.querySelectorAll(`.${styles.customGrid} i`),{scaleY:0},{scaleY:1,duration:.13,stagger:.013,ease:'power2.out'},.51)
        .to(previews[2],{scale:.86,yPercent:-3,duration:.12},.7)
        .to(labels[2],{autoAlpha:0,duration:.05},.73)
        .to(finish,{autoAlpha:1,duration:.02},.76)
        .to(shutters,{scaleY:0,duration:.17,stagger:.025,ease:'power3.inOut'},.77)
        .fromTo(node.querySelector('[data-bespoke-title]'),{y:45,letterSpacing:'-.09em'},{y:0,letterSpacing:'-.055em',duration:.15},.81)
        .fromTo(node.querySelectorAll(`.${styles.fingerprint} i`),{x:110,opacity:0},{x:0,opacity:1,duration:.13,stagger:.005},.82)
        .to({}, {duration:.04},.96);
      document.fonts.ready.then(()=>{if(alive)ScrollTrigger.refresh();});
      return()=>{alive=false;delete node.dataset.enhanced;delete node.dataset.progress;delete node.dataset.act;};
    });
    return()=>media.revert();
  },[]);
  return <section id="motion" ref={root} className={styles.study} aria-label="Три формата сайта. Всегда индивидуальное решение.">
    <div className={styles.viewport}>
      <div className={styles.rail}><span>Ⅲ / ФОРМАТ НЕ ОГРАНИЧИВАЕТ ИДЕЮ</span><span>{phase===3?'1 / 1':`0${phase+1} / 03`}</span></div>
      {formats.map((format,index)=><article key={format.kind} className={`${styles.frame} ${styles[format.kind+'Frame']}`} data-format-frame>
        <div data-format-label className={styles.caption}><span>{format.number} / ФОРМАТ</span><h2>{format.title}</h2><p>{format.subtitle}</p><div>{format.description}</div></div>
        <div className={styles.preview} data-format-preview role="img" aria-label={`Демонстрационный дизайн: ${format.title}`}><SitePreview kind={format.kind}/></div>
        <span className={styles.demoLabel}>ДЕМОНСТРАЦИЯ ДИЗАЙНА / НЕ КЛИЕНТСКИЙ ПРОЕКТ</span>
        <span className={styles.backgroundNumber} aria-hidden="true">0{index+1}</span>
      </article>)}
      <div className={styles.bespoke} data-bespoke>
        <span className={styles.bespokeMeta}>НЕ ТИПОВОЙ. ВАШ.</span>
        <h2 data-bespoke-title>Под вашу<br/><em>задачу.</em></h2>
        <div className={styles.bespokeBottom}><strong>Всегда индивидуально.</strong><p>Структура, визуальный язык, взаимодействия.<br/>Формат — только отправная точка.</p><a href="#contact">Создадим ваше? <span aria-hidden="true">↗</span></a></div>
        <div className={styles.fingerprint} aria-hidden="true">{Array.from({length:9},(_,i)=><i key={i} style={{inset:`${i*4}%`,borderRadius:`${12+i*6}% ${55-i*3}% ${20+i*3}% ${62-i*4}%`}}/>)}</div>
        <div className={styles.shutters} aria-hidden="true">{[0,1,2].map(i=><i data-shutter key={i}/>)}</div>
      </div>
    </div>
  </section>;
}
