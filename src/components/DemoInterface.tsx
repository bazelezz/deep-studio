'use client';

import { useId, useState } from 'react';
import styles from './DemoInterface.module.css';

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={diagonal ? 'M5 19 19 5M5 5h14v14' : 'M4 12h16m-6-6 6 6-6 6'} stroke="currentColor" strokeWidth="1.5" /></svg>;
}

type DemoInterfaceProps = {
  presentation?: boolean;
  character?: 'quiet' | 'bold';
  device?: 'desktop' | 'phone';
  instanceId?: string;
};

export default function DemoInterface({ presentation = false, character: controlledCharacter, device: controlledDevice, instanceId = 'demo' }: DemoInterfaceProps = {}) {
  const [localCharacter, setCharacter] = useState<'quiet' | 'bold'>('quiet');
  const [localDevice, setDevice] = useState<'desktop' | 'phone'>('desktop');
  const [collection, setCollection] = useState(false);
  const generatedId = useId();
  const collectionId = `${instanceId}-${generatedId}-collection`;
  const character = controlledCharacter ?? localCharacter;
  const device = controlledDevice ?? localDevice;

  return (
    <div className={`${styles.demo} ${presentation ? styles.presentation : ''}`} data-presentation={presentation || undefined}>
      {!presentation && <div className={styles.controls}>
        <div className={styles.characterControl} role="group" aria-label="Характер демонстрационного интерфейса">
          <button type="button" aria-pressed={character === 'quiet'} onClick={() => setCharacter('quiet')}>Сдержанно</button>
          <button type="button" aria-pressed={character === 'bold'} onClick={() => setCharacter('bold')}>Смело <span aria-hidden="true">↗</span></button>
        </div>
        <div className={styles.deviceControl} role="group" aria-label="Формат демонстрационного интерфейса">
          <button type="button" aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')}>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="1" /><path d="M8 20h8m-4-4v4" /></svg><span>Компьютер</span>
          </button>
          <button type="button" aria-pressed={device === 'phone'} onClick={() => setDevice('phone')}>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="2" /><path d="M10 18h4" /></svg><span>Телефон</span>
          </button>
        </div>
      </div>}

      <div className={styles.previewArea}>
        <div className={`${styles.interface} ${character === 'bold' ? styles.bold : ''} ${device === 'phone' ? styles.phone : ''} ${collection ? styles.collectionOpen : ''}`} data-character={character} data-device={device}>
          <div className={styles.interfaceNav}>
            <span className={styles.wordmark}>форма<span aria-hidden="true">°</span></span>
            <span className={styles.navCaption}>Архитектура повседневности</span>
            {presentation ? <span className={styles.indexButton}>Коллекция <span aria-hidden="true">+</span></span> : <button type="button" className={styles.indexButton} onClick={() => setCollection(!collection)} aria-expanded={collection} aria-controls={collectionId}>
              {collection ? 'К началу' : 'Коллекция'} <span aria-hidden="true">{collection ? '−' : '+'}</span>
            </button>}
          </div>

          <div className={styles.editorial}>
            <div className={styles.copy}>
              <span className={styles.eyebrow}>{collection ? 'Исследование формы / 02' : 'Объекты. Свет. Пространство.'}</span>
              <h3>{collection ? <>Красота<br /><em>простого.</em></> : <>Форма<br /><em>пространства.</em></>}</h3>
              <div className={styles.descriptionRow}>
                <span className={styles.folio} aria-hidden="true">{collection ? '02' : '01'}</span>
                <p>{collection ? 'Один материал. Множество ощущений. Рассмотрите, как свет раскрывает привычную геометрию.' : 'Меньше случайного. Больше смысла. Предметы и пространства, с которыми хочется остаться.'}</p>
              </div>
              {presentation ? <span className={styles.explore}>Исследовать форму<Arrow /></span> : <button type="button" className={styles.explore} onClick={() => setCollection(!collection)} aria-expanded={collection} aria-controls={collectionId}>
                {collection ? 'Вернуться к концепции' : 'Исследовать форму'}<Arrow />
              </button>}
            </div>

            <div className={styles.art} role="img" aria-label={collection ? 'Скульптурная композиция: каменный шар и ступенчатая архитектура' : 'Скульптурная композиция: монументальный портал в мягком свете'}>
              <div className={styles.artBackdrop} />
              <div className={styles.portalShadow} />
              <div className={styles.portal}><div className={styles.portalInner} /><div className={styles.portalLight} /></div>
              <div className={styles.stepOne} /><div className={styles.stepTwo} /><div className={styles.sphere} />
              <span className={styles.artNumber} aria-hidden="true">{collection ? 'II' : 'I'}</span>
              <div className={styles.artCaption}><span>{collection ? 'Материал и свет' : 'Тишина как форма'}</span><Arrow diagonal /></div>
            </div>
          </div>

          <div className={styles.interfaceFooter} id={collectionId}>
            <span>{collection ? 'Этюд в камне' : 'Дизайн начинается с ощущения'}</span>
            <div className={styles.swatches} aria-label="Выбранная композиция">
              {presentation ? <><span className={styles.swatchStatic} data-selected="true"><i />01</span><span className={styles.swatchStatic}><i />02</span></> : <><button type="button" aria-label="Композиция Портал" aria-pressed={!collection} onClick={() => setCollection(false)}><span />01</button><button type="button" aria-label="Композиция Материал и свет" aria-pressed={collection} onClick={() => setCollection(true)}><span />02</button></>}
            </div>
          </div>
        </div>
      </div>

      {!presentation && <><div className={styles.demoCaption}>
        <span><i aria-hidden="true" />Демонстрация интерфейса</span>
        <p>Один сюжет. Два характера. <span>Вымышленный образец, не клиентский проект.</span></p>
      </div>
      <span className={styles.srOnly} aria-live="polite">{character === 'quiet' ? 'Сдержанный' : 'Смелый'} вариант, {device === 'desktop' ? 'компьютер' : 'телефон'}. Композиция {collection ? 'Материал и свет' : 'Портал'}.</span></>}
    </div>
  );
}
