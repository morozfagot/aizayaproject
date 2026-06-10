# fix-encoding-taskts.ps1
# Скрипт для исправления повреждённых русских комментариев в Task.ts
# Запуск: PowerShell от имени администратора
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#   .\scripts\fix-encoding-taskts.ps1

param(
    [string]$FilePath = "C:\Users\$env:USERNAME\Desktop\AIWorkFlowContext\AiZayaProject\morozcode\src\core\task\Task.ts"
)

Write-Host "=== Исправление кодировки Task.ts ===" -ForegroundColor Cyan

# Проверяем существование файла
if (-not (Test-Path $FilePath)) {
    Write-Host "ОШИБКА: Файл не найден: $FilePath" -ForegroundColor Red
    exit 1
}

# Читаем файл как UTF-8
$content = [System.IO.File]::ReadAllText($FilePath, [System.Text.Encoding]::UTF8)
$lines = $content -split "`n"

Write-Host "Всего строк: $($lines.Length)"

# Массив замен: [номер_строки_с_1, новый_текст]
$replacements = @(
    # Строка 1991: em-dash вместо replacement character
    @(1991, '					// messages to become "orphaned" and restored to active status — effectively'),
    
    # Строки 2707-2708: Dynamic Model Selection
    @(2707, '				// Dynamic Model Selection: выбор оптимальной модели через OpenRouter'),
    @(2708, '				// Активируется когда выбран профиль "Dynamic Model Selection" в API Configuration'),
    
    # Строка 3570-3572: RAG Step 5
    @(3570, '					// RAG Step 5: Разбиение ответа модели на фрагменты'),
    @(3571, '					// Вызывается ПОСЛЕ сохранения assistant message в apiConversationHistory'),
    @(3572, '					// NOTE: Сразу после сохранения используем modelOverride и metadata (OpenRouter)'),
    
    # Строка 3589: обновление details
    @(3589, '							// Обновляем details после разбиения на фрагменты'),
    
    # Строка 3597: Fallback
    @(3597, '						// Fallback: продолжаем без фрагментации'),
    
    # Строка 3606-3607: логирование шага 5
    @(3606, '					// Логируем шаг 5 (chunkMessage)'),
    
    # Строка 3612-3613: логирование шага 6
    @(3612, '					// Логируем шаг 6 (индексация в Qdrant)'),
    
    # Строка 3623-3624: Qdrant-индексация
    @(3623, '					// Qdrant-индексация фрагментов (шаг 6.5)'),
    @(3624, '					// Сохраняем фрагменты в коллекцию для RRR поиска'),
    
    # Строка 3639: получение embedder
    @(3639, '								// Получаем embedder из конфигурации'),
    
    # Строка 3686: Non-fatal
    @(3686, '							// Non-fatal: ошибка не должна прерывать основной поток'),
    
    # Строка 4147: rate-limit
    @(4147, '		// requests — even from new subtasks — will honour the provider''s rate-limit.'),
    
    # Строка 4330: RRR-кэш
    @(4330, '		// RRR-кэш: векторный поиск через Qdrant вместо тегов'),
    
    # Строка 4362-4365: логирование шага 3
    @(4362, '		// Логируем шаг 3 (getEffectiveApiHistoryWithVectorSearch)'),
    @(4363, '		const totalHistory = this.apiConversationHistory.length'),
    @(4364, '		const filteredCount = effectiveHistory.length'),
    @(4365, '		const requestSummary = `Всего: ${totalHistory} сообщений, отфильтровано: ${totalHistory - filteredCount}, передано: ${filteredCount}, обогащение: ${enrichedContext}`'),
    
    # Строка 4466: начало шага 4
    @(4466, '		// Начинаем шаг 4 (api.createMessage) перед запросом к API'),
    
    # Строка 4509: подсчёт сообщений
    @(4509, '			// Подсчёт сообщений после фильтрации и обогащения'),
    
    # Строка 4512: messagesSummary
    @(4512, '			const messagesSummary = `Всего: ${cleanConversationHistory.length}, user: ${userCount}, assistant: ${assistantCount}, обогащение: ${enrichedContext}`'),
    
    # Строка 4514-4515: логирование шага 4 успех
    @(4514, '			// Логируем шаг 4 (api.createMessage) с подробным отчётом после успешного ответа'),
    
    # Строка 4533: логирование шага 4 ошибка
    @(4533, '			// Логируем шаг 4 с ошибкой (отличать от ошибки основного потока)'),
    
    # Строка 4538: messagesSummary ошибка
    @(4538, '			const messagesSummary = `Всего: ${cleanConversationHistory.length}, user: ${userCount}, assistant: ${assistantCount}, обогащение: ${enrichedContext}`')
)

$fixedCount = 0

foreach ($replacement in $replacements) {
    $lineNum = $replacement[0]
    $newText = $replacement[1]
    
    # Проверяем что строка существует
    if ($lineNum -le $lines.Length) {
        $oldLine = $lines[$lineNum - 1]
        
        # Проверяем содержит ли строка символы замены (U+FFFD)
        if ($oldLine -match [char]0xFFFD) {
            $lines[$lineNum - 1] = $newText
            Write-Host "Исправлена строка $lineNum" -ForegroundColor Green
            $fixedCount++
        } else {
            Write-Host "Строка $lineNum не содержит повреждённых символов, пропускаем" -ForegroundColor Yellow
        }
    } else {
        Write-Host "Строка $lineNum за пределами файла!" -ForegroundColor Red
    }
}

# Собираем файл обратно
$newContent = $lines -join "`n"

# Записываем обратно в UTF-8 без BOM
[System.IO.File]::WriteAllText($FilePath, $newContent, [System.Text.Encoding]::UTF8)

Write-Host ""
Write-Host "=== ИТОГО ===" -ForegroundColor Cyan
Write-Host "Исправлено строк: $fixedCount" -ForegroundColor Green
Write-Host "Файл сохранён: $FilePath" -ForegroundColor White
