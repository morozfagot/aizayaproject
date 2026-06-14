# GIT REMOTE CONFIGURATION

## Локальный репозиторий

**Путь:** `C:\Users\Moroz\Desktop\AIWorkFlowContext\AiZayaProject`

Это ЕДИНСТВЕННЫЙ локальный репозиторий для коммитов. Всё что вне этой директории — НЕ коммитится.

## Удалённый репозиторий (Remote)

**URL:** `https://github.com/morozfagot/aizayaproject.git`

**Имя remote:** `origin`

**Проверка:**
```bash
cd C:\Users\Moroz\Desktop\AIWorkFlowContext\AiZayaProject
git remote -v
# Должно показать:
# origin  https://github.com/morozfagot/aizayaproject.git (fetch)
# origin  https://github.com/morozfagot/aizayaproject.git (push)
```

**Если remote не настроен:**
```bash
git remote add origin https://github.com/morozfagot/aizayaproject.git
```

## Ветки

| Ветка | Назначение | Push? |
|-------|------------|-------|
| `developer` | Основная ветка разработки | ✅ Да |
| `main` | Стабильная ветка | ❌ Только через PR |

**Текущая ветка по умолчанию:** `developer`

## Что коммитить

**КОММИТИТЬ:**
- `AiZayaProject/morozcode/` — исходный код расширения
- `AiZayaProject/README.md` — документация
- `AiZayaProject/.gitignore` — правила игнорирования

**НЕ КОММИТИТЬ:**
- `C:\Users\Moroz\Desktop\AIWorkFlowContext\.roomodes` — настройки режимов
- `C:\Users\Moroz\Desktop\AIWorkFlowContext\docs/` — документация сессий
- `C:\Users\Moroz\Desktop\AIWorkFlowContext\*.md` — файлы из корня workspace
- `AiZayaProject/morozcode/node_modules/` — зависимости
- `AiZayaProject/morozcode/bin/` — билды VSIX
- `AiZayaProject/morozcode/.turbo/` — кеш turbo

## Формат коммитов

- **ТОЛЬКО на русском языке**
- **Формат:** `[тип]: краткое описание (50-70 символов)`
- **Типы:** `feat`, `fix`, `refactor`, `docs`, `chore`, `test`

## Стандартный процесс

```bash
# 1. Перейти в репозиторий
cd C:\Users\Moroz\Desktop\AIWorkFlowContext\AiZayaProject

# 2. Проверить статус
git status

# 3. Проверить ветку
git branch --show-current
# Должно быть: developer

# 4. Проверить remote
git remote -v
# Должно быть: origin https://github.com/morozfagot/aizayaproject.git

# 5. Добавить файлы (ТОЛЬКО внутри AiZayaProject/)
git add AiZayaProject/

# 6. Коммит
git commit -m "[тип]: описание на русском"

# 7. Пуш
git push origin developer

# 8. Верификация
git log --oneline -1
```

## Диагностика проблем

### Remote не настроен
```bash
git remote -v
# Если пусто:
git remote add origin https://github.com/morozfagot/aizayaproject.git
```

### Неправильная ветка
```bash
git branch --show-current
# Если не developer:
git checkout developer
```

### Файлы вне AiZayaProject/ в коммите
```bash
# Отменить добавление
git reset HEAD

# Добавить только AiZayaProject/
git add AiZayaProject/
```

### Push не проходит
```bash
# Сначала pull
git pull origin developer

# Решить конфликты если есть
# Затем push
git push origin developer
```
