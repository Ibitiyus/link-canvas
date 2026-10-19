# Link Canvas

Стартовый проект на React, TypeScript и Vite. Серверная часть, база данных и ключи доступа не требуются.

## Разработка

Нужен Node.js 24 LTS (версия указана в `.nvmrc`).

```sh
cd /workspace/link-canvas
npm ci --cache /workspace/.npm-cache --no-audit --no-fund
npm run dev
```

Vite использует порт 5173. В облачной среде используйте существующий checkout: отдельный Git worktree не нужен.

## Проверка и сборка

```sh
npm run typecheck
npm run build
npm run preview
```

Production-файлы создаются в `dist/`, preview использует порт 4173. Оба сервера останавливаются через Ctrl+C. После восстановления облачной среды процессы нужно запускать заново.

Исходная страница находится в `src/main.tsx`, стили — в `src/style.css`. Автоматизированный набор тестов пока не добавлен.
