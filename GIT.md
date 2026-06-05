# Git инструкции для репозитория

Этот файл читается Git-режимом перед выполнением любых git-операций.

## Репозиторий

- **Путь:** `C:\Users\Евгений\Desktop\AIWorkFlowContext\AiZayaProject`
- **Remote:** `origin` → `https://github.com/morozfagot/aizayaproject.git`
- **Ветка по умолчанию:** `developer`

## Правила

- Рабочая директория для ВСЕХ git-команд локального репозитория C:\Users\Евгений\Desktop\AIWorkFlowContext\AiZayaProject: `AiZayaProject/`
- Формат коммитов: `[тип]: краткое описание` (только русский язык)
- Типы: feat, fix, refactor, docs, chore, test
- ПОСЛЕ КАЖДОГО commit → ОБЯЗАТЕЛЬНО `git push origin <branch>`
- ПЕРЕД завершением работы → `git status` → если есть незакоммиченные изменения → commit + push

## Структура

- `morozcode/` — исходный код проекта (подпапка, НЕ отдельный репозиторий)
- `docs/` — документация (session-tree.md, context_payloads/)
