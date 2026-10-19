import { siteConfig } from '@/config/site';
import artwork from '@/config/brandArtwork.json';
import BrandLogo from './BrandLogo';
import LightStudy from './LightStudy';
import styles from './DisplaySite.module.css';

/** The same server-rendered cover lives in the physical LCD and the full page. */
export default function DisplaySite() {
  return <div className={styles.site} data-display-site>
    <div className={styles.art} data-film-art><LightStudy>
      <svg viewBox="0 0 820 850" fill="none" focusable="false">
        <defs>
          <radialGradient id="cover-atmosphere"><stop stopColor="#345269" stopOpacity=".32"/><stop offset="1" stopColor="#030810" stopOpacity="0"/></radialGradient>
          <linearGradient id="cover-face" x1=".08" y1="0" x2=".87" y2="1"><stop stopColor="#b9c5ca"/><stop offset=".12" stopColor="#5c737f"/><stop offset=".28" stopColor="#172c3c"/><stop offset=".47" stopColor="#334c5b"/><stop offset=".63" stopColor="#617785"/><stop offset=".83" stopColor="#1b2e3c"/><stop offset="1" stopColor="#0c1d2b"/></linearGradient>
          <linearGradient id="cover-side" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#142837"/><stop offset=".34" stopColor="#516774"/><stop offset=".7" stopColor="#142432"/><stop offset="1" stopColor="#040b13"/></linearGradient>
          <linearGradient id="cover-fillet" x1="0" y1="0" x2="1" y2=".75"><stop stopColor="#e2e7e5"/><stop offset=".24" stopColor="#748998"/><stop offset=".44" stopColor="#192c39"/><stop offset=".7" stopColor="#89a1ae"/><stop offset="1" stopColor="#1a2b38"/></linearGradient>
          <linearGradient id="cover-cut" x1="0" y1="0" x2="1" y2="0"><stop stopColor="#adc6d1" stopOpacity="0"/><stop offset=".45" stopColor="#cfe1e8"/><stop offset=".62" stopColor="#e7eeed"/><stop offset="1" stopColor="#8babbc" stopOpacity="0"/></linearGradient>
          <radialGradient id="cover-ground"><stop stopColor="#526b7b" stopOpacity=".17"/><stop offset="1" stopColor="#030810" stopOpacity="0"/></radialGradient>
          <filter id="cover-contact"><feGaussianBlur stdDeviation="12"/></filter>
          <filter id="cover-light"><feGaussianBlur stdDeviation="3.5"/></filter>
        </defs>
        <ellipse cx="434" cy="382" rx="385" ry="420" fill="url(#cover-atmosphere)"/>
        <ellipse cx="430" cy="708" rx="320" ry="105" fill="url(#cover-ground)"/>
        <ellipse cx="425" cy="708" rx="228" ry="20" fill="#000" opacity=".8" filter="url(#cover-contact)"/>
        <g className={styles.construction} stroke="#8aa4b2" strokeWidth=".65" opacity=".2">
          <path d="M130 106V725M705 106V725M95 151H742M95 677H742M401 83V755" strokeDasharray="2 9"/>
          <path d="M123 151H137M130 144V158M698 151H712M705 144V158M123 677H137M130 670V684M698 677H712M705 670V684"/>
          <circle cx="425" cy="408" r="277"/>
          <path d="M704 410H771M771 405V415M75 409H137M75 404V414"/>
        </g>
        <g transform="translate(82 82) scale(9.1) skewY(-8)">
          {Array.from({ length: 18 }, (_, index) => {
            const depth = (18 - index) * .18;
            return <g key={index} transform={`translate(${depth} ${depth * .8})`} fill="url(#cover-side)">{artwork.symbol.paths.map((path, i) => <path key={i} d={path}/>)}</g>;
          })}
          <g fill="url(#cover-face)" stroke="url(#cover-fillet)" strokeWidth=".18" strokeLinejoin="round">{artwork.symbol.paths.map((path, i) => <path key={i} d={path}/>)}</g>
          <path d="M20.15 49.8V26.2C20.15 20.4 23 17.2 28.1 17.2H39.9M44.15 14.2V37.9C44.15 43.8 41.1 47.15 36 47.15H24.2" stroke="#c2d3da" strokeOpacity=".45" strokeWidth=".12"/>
        </g>
        <g fill="#8199a8" fontFamily="monospace" fontSize="9" letterSpacing="2">
          <text x="122" y="111">ОТ ИДЕИ</text><text x="628" y="739">К ФОРМЕ</text>
        </g>
      </svg>
      </LightStudy>
    </div>
    <header className={styles.header}>
      <a className={styles.brand} href="#top" aria-label={`${siteConfig.brand} — в начало`}><BrandLogo /></a>
      <span className={styles.edition}>НЕЗАВИСИМЫЙ ДИЗАЙН И РАЗРАБОТКА</span>
      <a className={styles.contact} href="#contact">Обсудить проект <span aria-hidden="true">↗</span></a>
    </header>
    <div className={styles.type} data-film-title>
      <span className={styles.prelude}><span />{siteConfig.cover.eyebrow}</span>
      <h1><span className={styles.business}>Ваш бизнес.</span><span>В новом</span><span className={styles.serif}>свете.</span></h1>
      <p className={styles.description}>{siteConfig.cover.description}</p>
      <a className={styles.explore} href="#capabilities">Посмотреть возможности <span aria-hidden="true">↘</span></a>
    </div>
    <div className={styles.bottom}>
      <div className={styles.approach}><span className={styles.index}>01 / ПОДХОД</span><p>{siteConfig.cover.note}</p></div>
      <div className={styles.disciplines}><span>Структура</span><i aria-hidden="true"/><span>Дизайн</span><i aria-hidden="true"/><span>Разработка</span></div>
      <a href="#capabilities" className={styles.scrollCue}><span>Дальше — наглядно</span><span aria-hidden="true">↓</span></a>
    </div>
  </div>;
}

