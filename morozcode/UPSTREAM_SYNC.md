# Morozcode — Синхронизация с Upstream

## 📋 Обзор

`morozcode/` — форк [Zoo Code](https://github.com/ZooCodeAI/zoo-code), интегрированный как поддиректория репозитория агента `AiZayaProject/`.

**Важно**: morozcode НЕ является отдельным git-репозиторием. Это часть главного репозитория агента.

## 🌿 Стратегия ветвления

```
┌─────────────────────────────────────────────────────────────────┐
│                     ZooCodeAI/zoo-code                          │
│                        (upstream)                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ GitHub Actions (авто)
                              │ или ручной скрипт
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     origin/developer                            │
│              (разработка + обновления из upstream)               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ merge (когда ты решишь)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        origin/main                              │
│                      (продакшн)                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Ветки:

| Ветка | Назначение |
|-------|------------|
| `developer` | Разработка, твои кастомные правки + обновления из upstream |
| `main` | Продакшн, мержишь когда решишь |

## 🔧 Git Remotes

```bash
# Из корня AiZayaProject/
git remote -v
# origin    https://github.com/morozfagot/aizayaproject.git (fetch/push)
# upstream  https://github.com/ZooCodeAI/zoo-code.git (fetch/push)
```

## 🔄 Синхронизация

### Автоматическая (GitHub Actions)

Workflow [`.github/workflows/sync-morozcode-upstream.yml`](../../.github/workflows/sync-morozcode-upstream.yml):
- Запускается ежедневно в 03:00 UTC
- Может быть запущен вручную через `workflow_dispatch`
- Обновляет `morozcode/` в ветке `developer`
- Сохраняет кастомные файлы

### Ручная синхронизация

```bash
# Из корня AiZayaProject/

# 1. Переключиться на developer
git checkout developer

# 2. Сохранить кастомные файлы
mkdir -p /tmp/custom
cp morozcode/src/core/task-persistence/relevanceTags.ts /tmp/custom/
cp morozcode/src/core/task-persistence/tagIndex.ts /tmp/custom/
cp morozcode/src/core/task-persistence/refactoringLock.ts /tmp/custom/
cp morozcode/src/shared/globalFileNames.ts /tmp/custom/

# 3. Клонировать upstream
git clone --depth 1 https://github.com/ZooCodeAI/zoo-code.git /tmp/upstream

# 4. Заменить morozcode
rm -rf morozcode
mv /tmp/upstream morozcode

# 5. Восстановить кастомные файлы
cp /tmp/custom/* morozcode/src/core/task-persistence/
cp /tmp/custom/globalFileNames.ts morozcode/src/shared/

# 6. Закоммитить
git add -A
git commit -m "Sync morozcode with upstream"
git push origin developer
```

## 📁 Кастомные файлы

Файлы, которые сохраняются при синхронизации:

| Путь | Описание |
|------|----------|
| `src/core/task-persistence/relevanceTags.ts` | Теги релевантности для RAG |
| `src/core/task-persistence/tagIndex.ts` | Индекс тегов для поиска |
| `src/core/task-persistence/refactoringLock.ts` | Блокировка рефакторинга |
| `src/shared/globalFileNames.ts` | Глобальные имена файлов |

## 🔗 Ссылки

- Upstream: https://github.com/ZooCodeAI/zoo-code
- Origin: https://github.com/morozfagot/aizayaproject
