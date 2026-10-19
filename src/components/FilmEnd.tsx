import BrandLogo from './BrandLogo';
import ContactForm from './ContactForm';
import { siteConfig } from '@/config/site';
import styles from './FilmEnd.module.css';

export default function FilmEnd() {
  const contacts = [
    ...(siteConfig.contact.telegram ? [{label:'Telegram',url:siteConfig.contact.telegram}] : []),
    ...(siteConfig.contact.email ? [{label:siteConfig.contact.email,url:`mailto:${siteConfig.contact.email}`}] : []),
    ...siteConfig.contact.socials.filter(item => item.url),
  ];
  return <footer className={styles.end} id="contact">
    <div className={styles.rail}><span>ПОСЛЕДНИЙ КАДР.</span><span>НАЧАЛО ВАШЕЙ ИСТОРИИ.</span></div>
    <details className={styles.conversation}>
      <summary><span className={styles.invitation}>Теперь<br/><em>ваш ход.</em></span><span className={styles.open}><span>Обсудить проект</span><svg viewBox="0 0 100 100" aria-hidden="true"><path d="M15 85 85 15M15 15h70v70"/></svg></span></summary>
      <div className={styles.formArea}><h2>Что создадим?</h2><ContactForm /></div>
    </details>
    {contacts.length > 0 && <div className={styles.links}>{contacts.map(contact => <a href={contact.url} key={contact.url}>{contact.label} ↗</a>)}</div>}
    <div className={styles.bottom}><a href="#top" aria-label={`${siteConfig.brand} — в начало`} className={styles.brand}><BrandLogo /></a><span>ДИЗАЙН × РАЗРАБОТКА</span><a href="#top" className={styles.again}>В начало <span aria-hidden="true">↑</span></a></div>
    <div className={styles.light} aria-hidden="true" />
  </footer>;
}
