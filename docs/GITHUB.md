# GitHub Pages

Проект поддерживает статическую публикацию в репозитории `deep-studio` по пути `/deep-studio/`.

Переменные задаются **до сборки**: префикс встраивается в HTML и клиентские файлы.

```powershell
$env:GITHUB_PAGES = 'true'
$env:NEXT_PUBLIC_BASE_PATH = '/deep-studio'
npm ci
npm run build
```

На Linux или в GitHub Actions задайте те же `GITHUB_PAGES: 'true'` и `NEXT_PUBLIC_BASE_PATH: '/deep-studio'` через `env`.

Публикуйте содержимое **`out/`** как GitHub Pages artifact. Node.js-сервер и `next start` для этой сборки не нужны. При публикации из ветки с Jekyll добавьте в корень публикуемого каталога пустой `.nojekyll`.

Сборка использует `.next/`. Если из неё уже запущен локальный production-сервер, выполняйте экспорт в отдельной копии проекта или сначала остановите сервер. В этой версии Next.js `distDir` при `output: 'export'` меняет папку готового экспорта, а промежуточная `.next/` остаётся общей.

Без `GITHUB_PAGES=true` остаётся обычная Next.js-сборка. Для локального запуска в корне сайта используйте новый терминал без этих переменных либо удалите их:

```powershell
Remove-Item Env:GITHUB_PAGES, Env:NEXT_PUBLIC_BASE_PATH -ErrorAction SilentlyContinue
npm run dev
```

Пути к файлам из `public/` проходят через `src/config/assetPath.ts`. При добавлении новых абсолютных `src`/`srcSet` используйте этот helper. Локальные шрифты и JS/CSS bundles получают префикс автоматически. Якоря вида `#contact` менять не требуется.

Форма по умолчанию копирует заявку. Для реальной отправки понадобится внешний endpoint в `siteConfig.contact.endpoint`; GitHub Pages не запускает серверные обработчики.
