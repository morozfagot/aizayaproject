# Инструкции по сборке и публикации Morozcode

## Предварительные требования

1. Node.js 20.20.2
2. pnpm 10.8.1
3. vsce 3.3.2 (установлен в devDependencies)

## Фаза 6: Сборка расширения

```bash
# Перейди в директорию проекта
cd AiZayaProject/morozcode

# Установи зависимости
pnpm install

# Собери проект
pnpm build

# Создай VSIX файл
pnpm vsix
```

После выполнения в папке `bin/` появится файл `morozcode-1.0.0.vsix`

## Фаза 7: Создание PAT (Personal Access Token)

1. Перейди на https://dev.azure.com
2. Создай организацию (если нет)
3. Создай PAT:
   - Нажми на иконку пользователя → Personal Access Tokens
   - New Token
   - Name: `Morozcode Marketplace`
   - Organization: твоя организация
   - Scopes: **Marketplace (Manage)**
   - Сохрани PAT в безопасном месте!

## Фаза 8: Публикация в VS Code Marketplace

```bash
# Войди в publisher (используй свой PAT)
npx vsce login MorozOrg

# Опубликуй расширение
npx vsce publish
```

Или через VSIX файл:
```bash
npx vsce publish --packagePath bin/morozcode-1.0.0.vsix
```

## Фаза 9: Верификация

1. Перейди на https://marketplace.visualstudio.com/manage/publishers/MorozOrg
2. Проверь что расширение появилось
3. Установи расширение в чистый VS Code:
   - Открой VS Code
   - Extensions → Search "Morozcode"
   - Install
4. Проверь что кастомные режимы работают

## Альтернатива: публикация через ovsx (Open VSX Registry)

```bash
# Создай токен на https://open-vsx.org
npx ovsx publish -p <YOUR_OPEN_VSX_TOKEN>
```

## Полезные ссылки

- [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [vsce CLI](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#vsce)
- [Azure DevOps](https://dev.azure.com)
