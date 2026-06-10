# fix-taskts-lines.ps1
# Fix corrupted Russian comments in Task.ts by line number
# Run: powershell -ExecutionPolicy Bypass -File scripts\fix-taskts-lines.ps1

$path = Join-Path $PSScriptRoot "..\src\core\task\Task.ts"

if (-not (Test-Path $path)) {
    Write-Host "ERROR: File not found: $path" -ForegroundColor Red
    exit 1
}

# Read all lines
$lines = [System.IO.File]::ReadAllLines($path, [System.Text.Encoding]::UTF8)
Write-Host "Total lines: $($lines.Length)"

# Define replacements: line number (1-based) -> new content
# Russian text is encoded as UTF-8 strings
$replacements = @{
    1991 = '					// messages to become "orphaned" and restored to active status — effectively'
    2707 = '				// Dynamic Model Selection: выбор оптимальной модели через OpenRouter'
    2708 = '				// Активируется когда выбран профиль "Dynamic Model Selection" в API Configuration'
    3570 = '					// RAG Step 5: Разбиение ответа модели на фрагменты'
    3571 = '					// Вызывается ПОСЛЕ сохранения assistant message в apiConversationHistory'
    3572 = '					// NOTE: Сразу после сохранения используем modelOverride и metadata (OpenRouter)'
    3589 = '							// Обновляем details после разбиения на фрагменты'
    3597 = '						// Fallback: продолжаем без фрагментации'
    3606 = '					// Логируем шаг 5 (chunkMessage)'
    3612 = '					// Логируем шаг 6 (индексация в Qdrant)'
    3623 = '					// Qdrant-индексация фрагментов (шаг 6.5)'
    3624 = '					// Сохраняем фрагменты в коллекцию для RRR поиска'
    3639 = '								// Получаем embedder из конфигурации'
    3686 = '							// Non-fatal: ошибка не должна прерывать основной поток'
    4147 = '		// requests — even from new subtasks — will honour the provider''s rate-limit.'
    4330 = '		// RRR-кэш: векторный поиск через Qdrant вместо тегов'
    4362 = '		// Логируем шаг 3 (getEffectiveApiHistoryWithVectorSearch)'
    4365 = '		const requestSummary = `Всего: ${totalHistory} сообщений, отфильтровано: ${totalHistory - filteredCount}, передано: ${filteredCount}, обогащение: ${enrichedContext}`'
    4466 = '		// Начинаем шаг 4 (api.createMessage) перед запросом к API'
    4509 = '			// Подсчёт сообщений после фильтрации и обогащения'
    4512 = '			const messagesSummary = `Всего: ${cleanConversationHistory.length}, user: ${userCount}, assistant: ${assistantCount}, обогащение: ${enrichedContext}`'
    4514 = '			// Логируем шаг 4 (api.createMessage) с подробным отчётом после успешного ответа'
    4533 = '			// Логируем шаг 4 с ошибкой (отличать от ошибки основного потока)'
    4538 = '			const messagesSummary = `Всего: ${cleanConversationHistory.length}, user: ${userCount}, assistant: ${assistantCount}, обогащение: ${enrichedContext}`'
}

$fixed = 0
foreach ($lineNum in $replacements.Keys) {
    $idx = $lineNum - 1
    if ($idx -lt $lines.Length) {
        $old = $lines[$idx]
        # Check if line contains replacement character U+FFFD
        if ($old.Contains([char]0xFFFD)) {
            $lines[$idx] = $replacements[$lineNum]
            Write-Host "Fixed line $lineNum" -ForegroundColor Green
            $fixed++
        } else {
            Write-Host "Line $lineNum: no replacement char found, checking content..." -ForegroundColor Yellow
            # Show first 80 chars of the line
            $preview = $old.Substring(0, [Math]::Min(80, $old.Length))
            Write-Host "  Current: $preview"
        }
    }
}

# Write back as UTF-8 without BOM
$newContent = $lines -join "`n"
[System.IO.File]::WriteAllText($path, $newContent, [System.Text.Encoding]::UTF8)

Write-Host ""
Write-Host "Fixed $fixed lines. File saved." -ForegroundColor Cyan
