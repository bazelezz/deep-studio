import type { ReactNode } from 'react';
import BrandLogo from './BrandLogo';
import ContactForm from './ContactForm';
import { siteConfig, type Service } from '@/config/site';
import styles from './EditorialSections.module.css';


function Arrow({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14" stroke="currentColor" strokeWidth="1.2" /></svg>;
}

function Chapter({ number, children }: { number: string; children: ReactNode }) {
  return <div className={styles.chapter}><span>{number}</span><span>{children}</span><span className={styles.chapterLine} aria-hidden="true" /></div>;
}

function formatPrice(service: Service) {
  if (service.fromPrice == null || !Number.isFinite(service.fromPrice) || service.fromPrice <= 0) return 'По запросу';
  try {
    return `от ${new Intl.NumberFormat('ru-RU', { style: 'currency', currency: service.currency || 'RUB', maximumFractionDigits: 0 }).format(service.fromPrice)}`;
  } catch {
    return `от ${new Intl.NumberFormat('ru-RU').format(service.fromPrice)} ${service.currency}`;
  }
}

export default function EditorialSections() {
  const contacts = [
    ...(siteConfig.contact.telegram ? [{ label: 'Telegram', url: siteConfig.contact.telegram }] : []),
    ...(siteConfig.contact.email ? [{ label: siteConfig.contact.email, url: `mailto:${siteConfig.contact.email}` }] : []),
    ...siteConfig.contact.socials.filter((contact) => contact.url),
  ];

  return <div className={styles.editorial}>

    <section className={`${styles.services} ${styles.shell}`} id="services" aria-labelledby="services-heading">
      <Chapter number="03">Форматы работы</Chapter>
      <div className={styles.sectionHeading}><h2 id="services-heading">Какой сайт нужен<br /><span>вашему бизнесу?</span></h2><p>Сначала задача, затем решение.<br />Состав работы и стоимость<br />определяю после обсуждения.</p></div>
      <div className={styles.serviceList}>{siteConfig.services.map((service, index) => <article className={styles.service} key={service.id}>
        <div className={styles.serviceName}><span className={styles.serviceIndex}>0{index + 1}</span><h3>{service.title}</h3></div>
        <div className={styles.serviceDescription}><p>{service.description}</p><ul>{service.includes.map((item) => <li key={item}>{item}</li>)}</ul></div>
        <div className={styles.serviceAction}><span className={styles.price} data-service-price>{formatPrice(service)}</span><span className={styles.timeframe}>{service.timeframe || 'Сроки — после обсуждения'}</span><a href="#contact" data-service={service.id}>Обсудить {service.id === 'landing' ? 'лендинг' : service.id === 'company' ? 'сайт компании' : 'проект'}<Arrow /></a></div>
      </article>)}</div>
    </section>


    <section className={styles.contact} id="contact" aria-labelledby="contact-heading"><div className={styles.shell}>
      <Chapter number="04">Ваша следующая глава</Chapter>
      <div className={styles.contactTitle}><h2 id="contact-heading">Давайте покажем<br />ваш бизнес<br /><span>в новом свете.</span></h2><Arrow className={styles.contactArrow} /></div>
      <div className={styles.contactLayout}>
        <div className={styles.contactAside}><p>Расскажите о задаче —<br />обсудим подходящий<br />формат сайта.</p>{contacts.length > 0 && <div className={styles.contactLinks}>{contacts.map((contact) => <a href={contact.url} key={contact.url}>{contact.label}<Arrow /></a>)}</div>}<span className={styles.contactNote}>Хороший сайт начинается<br />с внимания.</span></div>
        <ContactForm />
      </div>
    </div></section>
  </div>;
}

export function EditorialFooter() {
  return <footer className={styles.footer}><div className={styles.shell}>
    <div className={styles.footerLine} aria-hidden="true" />
    <div className={styles.footerMain}><a href="#top" className={styles.footerBrand} aria-label={`${siteConfig.brand} — в начало`}><BrandLogo /></a><p>Дизайн со смыслом.<br />Разработка с вниманием.</p><a href="#top" className={styles.backTop}>К началу <Arrow /></a></div>
    <div className={styles.footerBottom}><span>Независимый дизайн и разработка</span><span>Концепция «{siteConfig.concept}»</span></div>
  </div></footer>;
}

