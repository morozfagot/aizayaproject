# Git инструкции для публикации Morozcode

## 1. Инициализация репозитория (если ещё не сделано)

```bash
cd AiZayaProject/morozcode
git init
git remote add origin https://github.com/morozfagot/aizayaproject.git
```

## 2. Создание ветки production из текущей (developer)

```bash
# Убедись что ты на ветке developer/main
git branch -a

# Создай ветку production из текущей
git checkout -b production

# Сделай первый коммит если нужно
git add .
git commit -m "Initial morozcode release v1.0.0"

# Push ветки production
git push -u origin production
```

## 3. Настройка приватной ветки developer

```bash
# Вернись на developer
git checkout -b developer

# Push ветки developer
git push -u origin developer
```

## 4. Настройка репозитория на GitHub

1. Перейди на https://github.com/morozfagot/aizayaproject
2. В Settings → Branches настрой:
   - Default branch: `production`
   - Protection rules для `developer` (опционально)

## 5. Сделать developer приватной (если нужно)

Для приватной ветки нужно:
1. Создать отдельный приватный репозиторий для developer
2. Или использовать GitHub Pro для приватных веток

Альтернатива - два репозитория:
- `aizayaproject` (public) - ветка production
- `aizayaproject-dev` (private) - ветка developer

## 6. После настройки Git

Переходи к Фазе 6: Сборка расширения
