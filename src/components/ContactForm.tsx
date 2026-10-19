'use client';

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { siteConfig } from '@/config/site';
import styles from './ContactForm.module.css';

type FieldName = 'name' | 'contact' | 'message';
type Errors = Partial<Record<FieldName, string>>;
type FormStatus = 'idle' | 'working' | 'copied' | 'sent' | 'manual' | 'error';
const subscribeReady = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

async function copyText(text: string): Promise<boolean> {
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(text); return true; } catch { /* Try the selection-based browser fallback. */ }
  }
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.setAttribute('aria-label', 'Текст заявки для копирования');
  field.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;';
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  document.body.appendChild(field);
  field.focus();
  field.select();
  field.setSelectionRange(0, field.value.length);
  let copied = false;
  try { copied = document.execCommand('copy'); } catch { copied = false; }
  field.remove();
  previousFocus?.focus({ preventScroll: true });
  return copied;
}

export default function ContactForm() {
  const enhanced = useSyncExternalStore(subscribeReady, clientReady, serverReady);
  const [service, setService] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<FormStatus>('idle');
  const [draft, setDraft] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const manualRef = useRef<HTMLTextAreaElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const endpoint = siteConfig.contact.endpoint.trim();

  useEffect(() => {
    const chooseService = (id: string | null) => {
      if (id && siteConfig.services.some((item) => item.id === id)) { setService(id); setStatus('idle'); }
    };
    chooseService(new URLSearchParams(window.location.search).get('format'));
    const handleLink = (event: MouseEvent) => {
      const element = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-service]') : null;
      if (element) chooseService(element.dataset.service ?? null);
    };
    const handleService = (event: Event) => chooseService((event as CustomEvent<string>).detail);
    document.addEventListener('click', handleLink);
    window.addEventListener('deep:select-service', handleService);
    return () => {
      document.removeEventListener('click', handleLink);
      window.removeEventListener('deep:select-service', handleService);
      requestRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (status === 'manual') { manualRef.current?.focus(); manualRef.current?.select(); }
  }, [status]);

  function clearError(field: FieldName) {
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
    if (status !== 'working') setStatus('idle');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'working') return;
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') ?? '').trim();
    const contact = String(data.get('contact') ?? '').trim();
    const message = String(data.get('message') ?? '').trim();
    const nextErrors: Errors = {};
    if (name.length < 2) nextErrors.name = 'Напишите имя — хотя бы 2 символа.';
    if (contact.length < 4) nextErrors.contact = 'Укажите email, Telegram или телефон для связи.';
    else if (contact.includes('@') && !contact.startsWith('@') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) nextErrors.contact = 'Проверьте адрес email: например, name@example.ru.';
    else if (/^[+\d\s()\-]+$/.test(contact) && contact.replace(/\D/g, '').length < 7) nextErrors.contact = 'Проверьте номер телефона: не хватает цифр.';
    if (message.length < 10) nextErrors.message = 'Добавьте несколько слов о задаче — хотя бы 10 символов.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setStatus('idle');
      const firstField = Object.keys(nextErrors)[0];
      formRef.current?.querySelector<HTMLElement>(`[name="${firstField}"]`)?.focus();
      return;
    }

    const selectedService = siteConfig.services.find((item) => item.id === service);
    const serviceLabel = selectedService?.title ?? 'Пока не определился';
    const text = `Заявка на разработку сайта\n\nИмя: ${name}\nСвязь: ${contact}\nФормат: ${serviceLabel}\n\nО проекте:\n${message}`;
    setDraft(text);
    setStatus('working');

    if (!endpoint) {
      const copied = await copyText(text);
      setStatus(copied ? 'copied' : 'manual');
      return;
    }

    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, contact, message, service: service || null, serviceLabel }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('Request failed');
      setStatus('sent');
    } catch {
      setStatus('error');
    } finally {
      window.clearTimeout(timeout);
      requestRef.current = null;
    }
  }

  async function copyDraft() {
    const copied = await copyText(draft);
    setStatus(copied ? 'copied' : 'manual');
  }

  return (
    <form ref={formRef} className={styles.form} onSubmit={handleSubmit} method="post" noValidate aria-label="Обсудить проект">
      <div className={styles.topline}><span>Несколько слов о вашей задаче</span><span aria-hidden="true">↗</span></div>
      <div className={styles.twoColumns}>
        <div className={styles.field}>
          <label htmlFor="project-name">Как вас зовут <span aria-hidden="true">*</span></label>
          <input id="project-name" name="name" autoComplete="name" placeholder="Ваше имя" required minLength={2} maxLength={100} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'project-name-error' : undefined} onChange={() => clearError('name')} />
          {errors.name && <p className={styles.fieldError} id="project-name-error">{errors.name}</p>}
        </div>
        <div className={styles.field}>
          <label htmlFor="project-contact">Как с вами связаться <span aria-hidden="true">*</span></label>
          <input id="project-contact" name="contact" autoComplete="off" placeholder="Email, Telegram или телефон" required minLength={4} maxLength={200} spellCheck={false} aria-invalid={Boolean(errors.contact)} aria-describedby={errors.contact ? 'project-contact-error' : undefined} onChange={() => clearError('contact')} />
          {errors.contact && <p className={styles.fieldError} id="project-contact-error">{errors.contact}</p>}
        </div>
      </div>
      <div className={styles.field}>
        <label htmlFor="project-service">Какой сайт вам нужен</label>
        <div className={styles.selectWrap}>
          <select id="project-service" name="service" value={service} onChange={(event) => { setService(event.target.value); setStatus('idle'); }}>
            <option value="">Пока не определился</option>
            {siteConfig.services.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 7.5 5 5 5-5" /></svg>
        </div>
      </div>
      <div className={styles.field}>
        <label htmlFor="project-message">Несколько слов о проекте <span aria-hidden="true">*</span></label>
        <textarea id="project-message" name="message" placeholder="Чем занимается ваш бизнес и какую задачу должен решить сайт?" required minLength={10} maxLength={5000} rows={3} aria-invalid={Boolean(errors.message)} aria-describedby={errors.message ? 'project-message-error' : undefined} onChange={() => clearError('message')} />
        {errors.message && <p className={styles.fieldError} id="project-message-error">{errors.message}</p>}
      </div>

      {!endpoint && <p className={styles.modeNote}><span aria-hidden="true" />Сейчас форма работает в деморежиме: заявка копируется, но не отправляется автоматически.</p>}
      <div className={styles.submitRow}>
        <button className={styles.submit} type="submit" disabled={!enhanced || status === 'working'}>{status === 'working' ? (endpoint ? 'Отправляю…' : 'Копирую…') : endpoint ? 'Отправить заявку' : 'Скопировать заявку'}<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.5" /></svg></button>
        <p className={styles.requiredNote}>* Обязательные поля</p>
      </div>
      <div className={styles.status} role="status" aria-live="polite" aria-atomic="true">
        {status === 'copied' && <p className={styles.success}>Заявка скопирована. Вставьте её в сообщение выбранному контакту. Автоматической отправки не было.</p>}
        {status === 'sent' && <p className={styles.success}>Заявка отправлена. Спасибо, что рассказали о проекте.</p>}
        {status === 'error' && <div className={styles.failure}><p>Не удалось подтвердить отправку. Текст сохранён в форме. Попробуйте ещё раз или скопируйте его.</p><button type="button" onClick={copyDraft}>Скопировать текст заявки ↗</button></div>}
        {status === 'manual' && <p>Браузер не разрешил копирование. Выделите текст ниже и скопируйте его вручную. Заявка не отправлена.</p>}
      </div>
      {status === 'manual' && <div className={styles.manual}><label htmlFor="project-draft">Готовый текст заявки</label><textarea ref={manualRef} id="project-draft" value={draft} readOnly rows={9} onFocus={(event) => event.currentTarget.select()} /><button type="button" onClick={() => { manualRef.current?.focus(); manualRef.current?.select(); }}>Выделить текст</button></div>}
      <noscript><p className={styles.modeNote}>Для подготовки заявки в этой форме нужен JavaScript. Вы можете описать задачу в свободной форме и отправить её по указанным контактам, когда они будут добавлены.</p></noscript>
    </form>
  );
}
