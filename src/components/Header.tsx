'use client';
import { useEffect, useRef } from 'react';
import { siteConfig } from '@/config/site';
import BrandLogo from './BrandLogo';

const links = [['Возможности','#capabilities'],['Услуги','#services'],...(siteConfig.projects.some(project=>project.visible)?[['Проекты','#projects']]:[])];
export default function Header() {
  const menu = useRef<HTMLDetailsElement>(null);
  const summary = useRef<HTMLElement>(null);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && menu.current?.open) { menu.current.open = false; summary.current?.focus(); }
    };
    const outside = (event: PointerEvent) => { if (menu.current?.open && !menu.current.contains(event.target as Node)) menu.current.open = false; };
    document.addEventListener('keydown', close);
    document.addEventListener('pointerdown', outside);
    return () => { document.removeEventListener('keydown',close); document.removeEventListener('pointerdown',outside); };
  }, []);
  return <header className="header shell">
    <a className="wordmark" href="#top" aria-label={`${siteConfig.brand} — в начало`}><BrandLogo /></a>
    <nav className="desktop-nav" aria-label="Основная навигация">{links.map(([label,href]) => <a key={href} href={href}>{label}</a>)}</nav>
    <a className="header-cta" href="#contact">Обсудить проект <span aria-hidden="true">↗</span></a>
    <details className="mobile-menu" ref={menu}>
      <summary ref={summary}>Меню <span aria-hidden="true">☰</span></summary>
      <nav aria-label="Мобильная навигация">{[...links,['Обсудить проект','#contact']].map(([label,href]) => <a key={href} href={href} onClick={() => { if(menu.current) menu.current.open=false; requestAnimationFrame(()=> { const target=document.querySelector<HTMLElement>(href); if(target){ target.tabIndex=-1; target.focus({preventScroll:true}); } }); }}>{label}<span aria-hidden="true">↗</span></a>)}</nav>
    </details>
  </header>;
}
