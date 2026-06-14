# Git Skill — Операции с Git для AI-расширений

## Описание

Скилл для выполнения Git-операций в проектах AI-расширений (VS Code extensions с AI/LLM-компонентами). Основан на реальном опыте работы с форком Roo Code (morozcode).

**Когда использовать:** коммит, пуш, создание ветки, мердж, диагностика проблем с Git.

**НЕ использовать:** для обычных Git-операций без контекста AI-расширений (используйте стандартный `git`).

---

## Предварительные требования

```
Git: 2.x+
Репозиторий: AiZayaProject/
Ветка по умолчанию: developer
Remote: origin → https://github.com/morozfagot/aizayaproject.git
```

**ОБЯЗАТЕЛЬНО:** Перед началом работы прочитай `AiZayaProject/GIT_REMOTE_CONFIG.md` — там указан remote, ветки, что коммитить, формат сообщений.

---

## Стандартный процесс коммита

### Шаг 1: Проверка remote

```bash
cd AiZayaProject
git remote -v
# Должно показать:
# origin  https://github.com/morozfagot/aizayaproject.git (fetch)
# origin  https://github.com/morozfagot/aizayaproject.git (push)
```

**⚠️ ПРОБЛЕМА:** Если remote не настроен:
```bash
git remote add origin https://github.com/morozfagot/aizayaproject.git
```

### Шаг 2: Проверка статуса

```bash
git status
```

**⚠️ ПРОБЛЕМА:** Если `git status` показывает файлы вне `AiZayaProject/` — НЕ коммитить их. Только файлы внутри `AiZayaProject/`.

### Шаг 2: Добавление файлов

```bash
# ТОЛЬКО файлы внутри AiZayaProject/
git add AiZayaProject/
```

**⚠️ ПРОБЛЕМА:** Никогда не используйте `git add .` или `git add -A` из корня рабочей директории. Это закоммитит `.roomodes`, `docs/`, `*.md` и другой мусор.

### Шаг 3: Коммит

```bash
git commit -m "[тип]: краткое описание на русском"
```

**Формат сообщения:**
- ТОЛЬКО на русском языке
- Формат: `[тип]: краткое описание (50-70 символов)`
- Типы: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`

### Шаг 4: Пуш

```bash
git push origin developer
```

**⚠️ ОБЯЗАТЕЛЬНО:** После каждого `git commit` выполнять `git push origin <branch>`.

### Шаг 5: Верификация

```bash
git log --oneline -5
git status
```

---

## Чеклист перед коммитом (ОБЯЗАТЕЛЬНЫЙ)

### ✅ 1. Проверка рабочей директории

```bash
pwd  # Должно быть AiZayaProject/
```

**⚠️ ПРОБЛЕМА:** Если рабочая директория — корень workspace (`AIWorkFlowContext`), Git-команды затронут файлы вне репозитория.

### ✅ 2. Проверка статуса

```bash
git status
```

**Что проверить:**
- Нет ли файлов вне `AiZayaProject/`
- Нет ли нежелательных файлов (`.roomodes`, `docs/`, `*.md` из корня)

### ✅ 3. Проверка ветки

```bash
git branch --show-current
```

**⚠️ ПРОБЛЕМА:** Коммит в `main` вместо `developer` — неправильная ветка.

### ✅ 4. Проверка remote

```bash
git remote -v
```

**⚠️ ПРОБЛЕМА:** Если remote не настроен — push не сработает.

### ✅ 5. Проверка конфликтов

```bash
git diff --check
```

**⚠️ ПРОБЛЕМА:** Если есть конфликты — сначала решить, потом коммитить.

---

## Известные проблемы и решения

### Проблема 1: Файлы вне AiZayaProject/ попадают в коммит

**Симптомы:** `git status` показывает `.roomodes`, `docs/`, `*.md` из корня.

**Причина:** Выполнение `git add .` из корня workspace.

**Исправление:**
```bash
# Отменить добавление
git reset HEAD

# Добавить только AiZayaProject/
git add AiZayaProject/
```

### Проблема 2: Коммит в неправильную ветку

**Симптомы:** Коммит в `main` вместо `developer`.

**Причина:** Не проверена текущая ветка перед коммитом.

**Исправление:**
```bash
# Проверить ветку
git branch --show-current

# Если неправильная — переключиться
git checkout developer

# Если нужно перенести коммит — cherry-pick
git cherry-pick <commit-hash>
git checkout main
git reset --hard HEAD~1
```

### Проблема 3: Push не проходит (non-fast-forward)

**Симптомы:** `! [rejected] developer -> developer (non-fast-forward)`

**Причина:** Remote имеет коммиты, которых нет локально.

**Исправление:**
```bash
# Сначала pull
git pull origin developer

# Решить конфликты если есть
# Затем push
git push origin developer
```

### Проблема 4: Конфликты при pull/merge

**Симптомы:** `CONFLICT (content): Merge conflict in <file>`

**Причина:** Одни и те же строки изменены локально и на remote.

**Исправление:**
```bash
# Открыть файлы с конфликтами
# Разрешить конфликты (выбрать нужные изменения)
git add <resolved-file>
git commit -m "fix: разрешение конфликтов мержа"
git push origin developer
```

### Проблема 5: Потеря изменений при reset

**Симптомы:** Изчезли локальные изменения после `git reset`.

**Причина:** Использование `git reset --hard` без stash.

**Исправление:**
```bash
# Восстановить из reflog
git reflog
git cherry-pick <lost-commit-hash>

# Или из stash
git stash list
git stash pop
```

### Проблема 6: .gitignore не игнорирует файлы

**Симптомы:** Файлы из `.gitignore` всё равно показываются в `git status`.

**Причина:** Файлы уже отслеживаются Git (были добавлены до добавления в `.gitignore`).

**Исправление:**
```bash
# Убрать из отслеживания
git rm --cached <file>

# Или для директории
git rm -r --cached <directory>
```

### Проблема 7: Большой размер репозитория

**Симптомы:** Push очень медленный, репозиторий занимает много места.

**Причина:** В репозиторий добавлены бинарные файлы, node_modules, build-артефакты.

**Исправление:**
```bash
# Проверить что занимает место
git rev-list --objects --all | git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' | grep blob | sort -k3 -n -r | head -20

# Удалить большие файлы из истории
git filter-branch --tree-filter 'rm -f <large-file>' HEAD
```

---

## Диагностика проблем

### Проверка состояния репозитория

```bash
# Полный статус
git status

# Список веток
git branch -a

# История коммитов
git log --oneline -10

# Remote
git remote -v

# Размер репозитория
du -sh .git
```

### Проверка перед push

```bash
# Что будет отправлено
git diff origin/developer --stat

# Коммиты которые будут отправлены
git log origin/developer..HEAD --oneline
```

### Проверка после push

```bash
# Убедиться что push прошёл
git log --oneline -1

# Сравнить локальную и remote ветку
git diff origin/developer
```

---

## Работа с ветками

### Создание новой ветки

```bash
git checkout -b feature/<название>
git push -u origin feature/<название>
```

### Переключение между ветками

```bash
git checkout developer
git checkout feature/<название>
```

### Мердж ветки

```bash
git checkout developer
git merge feature/<название>
git push origin developer
```

### Удаление ветки

```bash
# Локально
git branch -d feature/<название>

# На remote
git push origin --delete feature/<название>
```

---

## Версионирование

При каждом коммите, который меняет функциональность:

1. Обновить версию в `package.json` (в `AiZayaProject/morozcode/`)
2. Обновить `CHANGELOG.md`
3. Закоммитить изменения версии

**Формат версии:** `MAJOR.MINOR.PATCH` (семантическое версионирование)

---

## Связанные файлы

| Файл | Назначение |
|------|------------|
| `AiZayaProject/GIT_REMOTE_CONFIG.md` | **Главный файл** — remote, ветки, что коммитить, формат сообщений |
| `GIT_COMMIT_INSTRUCTIONS.md` | Правила коммитов (корень workspace) |
| `.roomodes` | Настройка Git-режима |
| `AiZayaProject/.git/config` | Конфигурация Git |
| `AiZayaProject/.gitignore` | Игнорируемые файлы |

---

## Источники опыта

Этот скилл основан на реальном опыте работы с форком Roo Code (morozcode):
- 44 сессии morozcode в `C:\Users\Moroz\ZooCodeStorage\tasks/`
- Ветка 9 (VSIX Build Skill): `docs/context_payloads/9_vsix_build_skill/`
- Git-коммиты: `91fb6a3`, `fdea08e`, `75f196d`, `0d74e43`, `639cc0d`, `6599df6`
