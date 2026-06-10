# enable-utf8-windows.ps1
# Скрипт для включения UTF-8 кодировки в Windows 10/11
# Решает проблему с кракозябрами при кириллических именах пользователей
#
# Запуск: PowerShell от имени администратора
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#   .\scripts\enable-utf8-windows.ps1

Write-Host "=== Настройка UTF-8 кодировки в Windows ===" -ForegroundColor Cyan

# 1. Включение "Beta: Use Unicode UTF-8 for worldwide language support"
# Это реестр: HKLM:\SYSTEM\CurrentControlSet\Control\Nls\CodePage -> ACP = 65001
$codePagePath = "HKLM:\SYSTEM\CurrentControlSet\Control\Nls\CodePage"

try {
    $currentACP = (Get-ItemProperty -Path $codePagePath -Name "ACP" -ErrorAction Stop).ACP
    Write-Host "Текущая кодовая страница (ACP): $currentACP"
    
    if ($currentACP -eq "65001") {
        Write-Host "UTF-8 (65001) уже включена. Пропускаем." -ForegroundColor Green
    } else {
        Write-Host "Устанавливаю ACP = 65001 (UTF-8)..." -ForegroundColor Yellow
        Set-ItemProperty -Path $codePagePath -Name "ACP" -Value "65001" -Type String
        Set-ItemProperty -Path $codePagePath -Name "OEMCP" -Value "65001" -Type String
        Set-ItemProperty -Path $codePagePath -Name "MACCP" -Value "65001" -Type String
        Write-Host "UTF-8 кодировка установлена в реестре." -ForegroundColor Green
    }
} catch {
    Write-Host "ОШИБКА: Не удалось изменить реестр. Запустите скрипт от имени администратора." -ForegroundColor Red
    Write-Host $_.Exception.Message
    exit 1
}

# 2. Настройка локали системы для поддержки кириллицы
# Проверяем текущую системную локаль
try {
    $systemLocale = Get-WinSystemLocale
    Write-Host "Текущая системная локаль: $($systemLocale.Name)"
    
    # Устанавливаем русскую локаль с UTF-8 поддержкой
    # ru-RU с UTF-8 — это не то же самое, что ACP=65001, но помогает
    if ($systemLocale.Name -ne "ru-RU") {
        Write-Host "Рекомендуется установить системную локаль ru-RU для корректной работы с кириллицей." -ForegroundColor Yellow
        Write-Host "Для этого выполните: Set-WinSystemLocale -SystemLocale ru-RU" -ForegroundColor Yellow
    }
} catch {
    Write-Host "Предупреждение: не удалось проверить системную локаль." -ForegroundColor Yellow
}

# 3. Настройка переменных окружения для Node.js
Write-Host ""
Write-Host "=== Настройка переменных окружения для Node.js ===" -ForegroundColor Cyan

$nodeOptions = "--experimental-vm-modules"
$env:NODE_OPTIONS = $nodeOptions

# Устанавливаем для текущего пользователя
try {
    [Environment]::SetEnvironmentVariable("NODE_OPTIONS", $nodeOptions, "User")
    Write-Host "NODE_OPTIONS установлен: $nodeOptions" -ForegroundColor Green
} catch {
    Write-Host "Предупреждение: не удалось установить NODE_OPTIONS." -ForegroundColor Yellow
}

# 4. Настройка кодировки консоли
Write-Host ""
Write-Host "=== Настройка кодировки консоли ===" -ForegroundColor Cyan

try {
    # Устанавливаем кодировку консоли в UTF-8 для текущей сессии
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $OutputEncoding = [System.Text.Encoding]::UTF8
    Write-Host "Кодировка консоли установлена в UTF-8 для текущей сессии." -ForegroundColor Green
    
    # Для PowerShell 7+ можно установить постоянно
    $profilePath = $PROFILE.CurrentUserAllHosts
    if (Test-Path $profilePath) {
        $profileContent = Get-Content $profilePath -Raw -ErrorAction SilentlyContinue
        if ($profileContent -notmatch "OutputEncoding") {
            Add-Content -Path $profilePath -Value "`n`$OutputEncoding = [System.Text.Encoding]::UTF8"
            Write-Host "OutputEncoding добавлен в PowerShell профиль." -ForegroundColor Green
        }
    }
} catch {
    Write-Host "Предупреждение: не удалось настроить кодировку консоли." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== ИТОГО ===" -ForegroundColor Cyan
Write-Host "Для применения изменений РЕКОМЕНДУЕТСЯ перезагрузить компьютер." -ForegroundColor Yellow
Write-Host ""
Write-Host "После перезагрузки проверьте:" -ForegroundColor White
Write-Host "  1. Путь к папке пользователя должен отображаться корректно" -ForegroundColor White
Write-Host "  2. Русские комментарии в коде должны отображаться без кракозябров" -ForegroundColor White
Write-Host "  3. Команды в терминале должны корректно обрабатывать кириллицу" -ForegroundColor White
