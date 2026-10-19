'use client';

import { useId, useState } from 'react';
import styles from './CraftStudy.module.css';

const stages = [
  { title: 'Структура', description: 'Помогает быстро понять предложение.', note: 'Сначала — логика. Сетка задаёт ритм, а иерархия ведёт от главной мысли к действию.', name: 'Основа' },
  { title: 'Характер', description: 'Делает бизнес узнаваемым.', note: 'Затем — собственный голос. Типографика, цвет и форма превращают структуру в образ.', name: 'Выражение' },
  { title: 'Детали', description: 'Связывают всё в цельный опыт.', note: 'Наконец — точность. Расстояния, состояния и реакции делают интерфейс естественным.', name: 'Цельность' },
];

/** One composition, three design states. No timeline or scroll interception. */
export default function CraftStudy() {
  const [stage, setStage] = useState(2);
  const [guides, setGuides] = useState(false);
  const [inspect, setInspect] = useState(false);
  const id = useId();
  const showGuides = stage === 0 || guides;
  const chooseStage = (next: number) => { setStage(next); setInspect(false); };

  return <div className={styles.study}>
    <div className={styles.heading}>
      <h2>У каждого решения<br /><span>есть причина.</span></h2>
      <p>Не добавляю красоту поверх смысла.<br />{' '}Проектирую их вместе — от первой<br className={styles.desktopBreak} /> линии до последнего состояния.</p>
    </div>
    <div className={styles.worktable}>
      <aside className={styles.tools}>
        <div className={styles.tableName}><span className={styles.smallCross} aria-hidden="true" />Световой стол<span className={styles.tableIndex}>01</span></div>
        <div className={styles.stages} role="group" aria-label="Этапы создания интерфейса">
          {stages.map((item, index) => <button type="button" key={item.title} onClick={() => chooseStage(index)} aria-pressed={stage === index} aria-controls={`${id}-artboard`} className={`${styles.stage} ${stage === index ? styles.active : ''}`}>
            <span className={styles.stageIndex}>0{index + 1}</span>
            <span className={styles.stageText}><strong>{item.title}</strong><small>{item.description}</small></span>
            <span className={styles.stageArrow} aria-hidden="true">↗</span>
          </button>)}
        </div>
        <p className={styles.stageNote}>{stages[stage].note}</p>
        <div className={styles.toolFoot}><span className={styles.tinyMark} aria-hidden="true"><i /><i /></span><span>Один интерфейс.<br />Три уровня внимания.</span></div>
      </aside>
      <div className={styles.tableBody}>
        <div className={styles.toolbar}>
          <span>Демонстрация интерфейса</span>
          <button type="button" aria-pressed={showGuides} onClick={() => { if (stage === 0) chooseStage(1); setGuides(!showGuides); }} aria-label={showGuides ? 'Скрыть направляющие' : 'Показать направляющие'}><span className={styles.gridIcon} aria-hidden="true" /> <span>Сетка</span><span className={styles.switch} data-on={showGuides}><i /></span></button>
        </div>
        <div id={`${id}-artboard`} className={`${styles.artboard} ${stage === 0 ? styles.structure : ''} ${stage === 1 ? styles.character : ''} ${inspect ? styles.inspect : ''}`} data-guides={showGuides}>
          <div className={styles.grid} aria-hidden="true" />
          <div className={styles.artHeader}><span className={styles.artBrand}>форма<span aria-hidden="true">.</span></span><span className={styles.artDescriptor}>МЕСТО ДЛЯ ВАШЕГО СМЫСЛА</span><span className={styles.artMenu} aria-hidden="true"><i /><i /></span></div>
          <div className={styles.artMain}>
            <div className={styles.artCopy}>
              <span className={styles.artEyebrow}>Из мысли — в ощущение</span>
              <p className={styles.artTitle}>Идея<br />обретает<br /><em>форму.</em></p>
              <p className={styles.artDescription}>Ясность в главном.<br />Характер в каждой детали.</p>
              <button type="button" className={styles.artAction} aria-pressed={inspect} aria-controls={`${id}-notes`} onClick={() => { setInspect(!inspect); if (stage !== 2) setStage(2); }}><span>{inspect ? 'Скрыть пояснения' : 'Увидеть логику'}</span><span aria-hidden="true">{inspect ? '−' : '↗'}</span></button>
            </div>
            <div className={styles.object} aria-hidden="true">
              <svg className={styles.objectSvg} viewBox="0 0 360 430" fill="none">
                <defs>
                  <linearGradient id={`${id}-plane`} x1="56" y1="44" x2="260" y2="353" gradientUnits="userSpaceOnUse"><stop stopColor="#183B43" /><stop offset=".48" stopColor="#42636A" /><stop offset="1" stopColor="#172F36" /></linearGradient>
                  <linearGradient id={`${id}-light`} x1="146" y1="76" x2="296" y2="391" gradientUnits="userSpaceOnUse"><stop stopColor="#EFF2EE" /><stop offset=".5" stopColor="#BDC9C8" /><stop offset="1" stopColor="#97AFB1" /></linearGradient>
                  <linearGradient id={`${id}-edge`} x1="64" y1="66" x2="228" y2="299" gradientUnits="userSpaceOnUse"><stop stopColor="#91A7A8" /><stop offset="1" stopColor="#55747B" /></linearGradient>
                </defs>
                <g className={styles.objectShadow} opacity=".1" fill="#20343A"><path d="M78 387 267 365 319 389 131 414Z" /><path d="m90 379 160-17 58 28-163 18Z" /></g>
                <g className={styles.planeBack}>
                  <path d="M126 51C80 51 48 84 48 131V306H101V132C101 113 110 103 127 103H223V51H126Z" fill={`url(#${id}-plane)`} />
                  <path d="m48 306 12 9h54l-13-9H48Zm175-255 12 9v52l-12-9V51Z" fill="#153139" />
                  <path d="M114 315V141c0-19 9-29 26-29h95l-12-9h-96c-17 0-26 10-26 29v174l13 9Z" fill={`url(#${id}-edge)`} />
                  <path d="M49 306V131c0-47 32-79 77-79h96" stroke="#8B9E9E" strokeWidth=".8" />
                </g>
                <g className={styles.planeFront}>
                  <path d="M226 377c47 0 79-33 79-80V122h-53v174c0 19-9 29-26 29h-96v52h96Z" fill={`url(#${id}-light)`} />
                  <path d="m305 122 12 9v174c0 47-32 81-79 81h-96l-12-9h96c47 0 79-33 79-80V122Z" fill="#789095" />
                  <path d="m252 122 12 9h53l-12-9h-53Z" fill="#F2F4F0" />
                  <path d="M131 326h95c17 0 26-10 26-30V123" stroke="#F4F6F1" strokeWidth="1.2" />
                </g>
                <g className={styles.objectConstruction} stroke="currentColor" strokeWidth=".7"><path d="M31 30h302v378H31zM31 131h302M31 306h302M101 30v378M252 30v378" /><path d="M18 51h17m-8-8v16M321 377h17m-8-8v16" /></g>
              </svg>
              <span className={styles.objectCaption}>Форма следует смыслу</span>
            </div>
          </div>
          <div className={styles.artFooter}><span>Ясно. Собранно. По существу.</span><span className={styles.artRule} /><span>Этюд № 01</span></div>
          <div id={`${id}-notes`} className={styles.annotations} aria-hidden={!inspect}><span><b>01</b> Иерархия текста</span><span><b>02</b> Собственный образ</span><span><b>03</b> Понятное действие</span></div>
        </div>
        <div className={styles.caption}><span>ОТ СМЫСЛА К ФОРМЕ</span><span className={styles.captionState}>0{stage + 1}<span> / </span>{stages[stage].name}</span></div>
      </div>
    </div>
    <p className={styles.mobileHint}>Переключайте этапы, чтобы увидеть, как меняется одно решение.</p>
    <span className={styles.srOnly} aria-live="polite">Выбран этап: {stages[stage].title}. {stages[stage].description}</span>
  </div>;
}
