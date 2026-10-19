export type ServiceId = 'landing' | 'company' | 'individual';
export interface Service {
  id: ServiceId; title: string; description: string; includes: string[];
  fromPrice: number | null; currency: string; timeframe: string;
}
export interface Project {
  id: string; title: string; category: string; image: string; imageAlt: string;
  task: string; role: string; solution: string; url: string; visible: boolean; demoCover: boolean;
}
export const siteConfig = {
  brand: 'DEEP',
  concept: 'В новом свете',
  heroDescription: 'Выразительный дизайн. Точная разработка. Сайты для бизнеса.',
  cover: {
    eyebrow: 'САЙТЫ ДЛЯ БИЗНЕСА',
    description: 'Проектирую и разрабатываю сайты, которые объясняют ваш продукт и раскрывают характер бизнеса.',
    note: 'От первой идеи до запуска. Всегда индивидуально.',
  },
  heroLines: ['Создаю сайты, в которых', 'бизнес обретает свой характер.'],
  description: 'Проектирую и разрабатываю сайты для бизнеса — с выразительным дизайном, понятной структурой и вниманием к деталям.',
  screen: { eyebrow: 'ДИЗАЙН, В КОТОРОМ ЕСТЬ СМЫСЛ', lines: ['Не просто красиво.', 'Продумано до деталей.'], footer: 'СТРУКТУРА / ХАРАКТЕР / ДЕТАЛИ' },
  contact: { email: '', telegram: '', socials: [] as {label:string; url:string}[], endpoint: '' },
  services: [
    { id:'landing', title:'Лендинг', description:'Для понятной презентации одной услуги, продукта или предложения.', includes:['Структура и визуальная концепция','Дизайн и адаптивная разработка','Форма обращения и подготовка к запуску'], fromPrice:null, currency:'RUB', timeframe:'' },
    { id:'company', title:'Сайт компании', description:'Для услуг, команды, информации о бизнесе и обращения клиентов.', includes:['Продуманная структура разделов','Единая система дизайна','Адаптивная разработка и формы'], fromPrice:null, currency:'RUB', timeframe:'' },
    { id:'individual', title:'Индивидуальный проект', description:'Для нестандартной структуры, взаимодействий и выразительных визуальных решений.', includes:['Концепция под вашу задачу','Индивидуальные интерфейсы и анимация','Техническое решение и разработка'], fromPrice:null, currency:'RUB', timeframe:'' },
  ] as Service[],
  projects: [
    {id:'wellness',title:'Премиальный банный комплекс',category:'ОТДЫХ И ВОССТАНОВЛЕНИЕ',image:'/images/project-wellness.svg',imageAlt:'Демонстрационная графика: архитектурный свет в тёмном пространстве',task:'',role:'',solution:'',url:'',visible:true,demoCover:true},
    {id:'paintball',title:'Пейнтбол',category:'АКТИВНЫЙ ОТДЫХ',image:'/images/project-paintball.svg',imageAlt:'Демонстрационная графика: геометричная мишень',task:'',role:'',solution:'',url:'',visible:true,demoCover:true},
    {id:'dental',title:'Стоматология',category:'ЗДОРОВЬЕ',image:'/images/project-dental.svg',imageAlt:'Демонстрационная графика: светлая скульптурная форма',task:'',role:'',solution:'',url:'',visible:true,demoCover:true},
  ] as Project[],
};
