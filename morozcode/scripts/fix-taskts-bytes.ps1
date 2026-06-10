# fix-taskts-bytes.ps1
# Fix corrupted Russian comments in Task.ts by replacing lines containing U+FFFD
# Run from morozcode directory: powershell -ExecutionPolicy Bypass -File scripts\fix-taskts-bytes.ps1

$path = Join-Path $PSScriptRoot "..\src\core\task\Task.ts"

if (-not (Test-Path $path)) {
    Write-Host "ERROR: File not found: $path" -ForegroundColor Red
    exit 1
}

# Read file as raw bytes
$rawBytes = [System.IO.File]::ReadAllBytes($path)
$content = [System.Text.Encoding]::UTF8.GetString($rawBytes)
$lines = $content -split "`n"

Write-Host "Total lines: $($lines.Length)"

# Find all lines containing U+FFFD and show their numbers
$corruptedLines = @()
for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i].Contains([char]0xFFFD)) {
        $corruptedLines += $i
        $preview = $lines[$i].Replace([char]0xFFFD, '?').Substring(0, [Math]::Min(100, $lines[$i].Length))
        Write-Host ("Line " + ($i + 1) + ": " + $preview) -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Found $($corruptedLines.Count) corrupted lines" -ForegroundColor Cyan

# Now fix them by replacing the entire line
# We'll use a simple approach: replace the line content

# Line 1991: em-dash fix
$lines[1990] = $lines[1990].Replace([char]0xFFFD, [char]0x2014)

# For lines with multiple corrupted chars, we need to replace the whole line
# Line 2707-2708: Dynamic Model Selection
$lines[2706] = "// Dynamic Model Selection: выбор оптимальной модели через OpenRouter"
$lines[2707] = "// Активируется когда выбран профиль ""Dynamic Model Selection"" в API Configuration"

# Line 3570-3572: RAG Step 5
$lines[3569] = "					// RAG Step 5: Разбиение ответа модели на фрагменты"
$lines[3570] = "					// Вызывается ПОСЛЕ сохранения assistant message в apiConversationHistory"
$lines[3571] = "					// NOTE: Сразу после сохранения используем modelOverride и metadata (OpenRouter)"

# Line 3589
$lines[3588] = "							// Обновляем details после разбиения на фрагменты"

# Line 3597
$lines[3596] = "						// Fallback: продолжаем без фрагментации"

# Line 3606
$lines[3605] = "					// Логируем шаг 5 (chunkMessage)"

# Line 3612
$lines[3611] = "					// Логируем шаг 6 (индексация в Qdrant)"

# Line 3623-3624
$lines[3622] = "					// Qdrant-индексация фрагментов (шаг 6.5)"
$lines[3623] = "					// Сохраняем фрагменты в коллекцию для RRR поиска"

# Line 3639
$lines[3638] = "								// Получаем embedder из конфигурации"

# Line 3686
$lines[3685] = "							// Non-fatal: ошибка не должна прерывать основной поток"

# Line 4147
$lines[4146] = "		// requests — even from new subtasks — will honour the provider's rate-limit."

# Line 4330
$lines[4329] = "		// RRR-кэш: векторный поиск через Qdrant вместо тегов"

# Line 4362
$lines[4361] = "		// Логируем шаг 3 (getEffectiveApiHistoryWithVectorSearch)"

# Line 4365
$lines[4364] = '		const requestSummary = "Всего: " + totalHistory + " сообщений, отфильтровано: " + (totalHistory - filteredCount) + ", передано: " + filteredCount + ", обогащение: " + enrichedContext'

# Line 4466
$lines[4465] = "		// Начинаем шаг 4 (api.createMessage) перед запросом к API"

# Line 4509
$lines[4508] = "			// Подсчёт сообщений после фильтрации и обогащения"

# Line 4512
$lines[4511] = '			var messagesSummary = "Всего: " + cleanConversationHistory.length + ", user: " + userCount + ", assistant: " + assistantCount + ", обогащение: " + enrichedContext'

# Line 4514
$lines[4513] = "			// Логируем шаг 4 (api.createMessage) с подробным отчётом после успешного ответа"

# Line 4533
$lines[4532] = "			// Логируем шаг 4 с ошибкой (отличать от ошибки основного потока)"

# Line 4538
$lines[4537] = '			var messagesSummary = "Всего: " + cleanConversationHistory.length + ", user: " + userCount + ", assistant: " + assistantCount + ", обогащение: " + enrichedContext'

# Rebuild content
$newContent = $lines -join "`n"

# Verify no more U+FFFD
$remaining = ([regex]::Matches($newContent, [char]0xFFFD)).Count
Write-Host "Remaining U+FFFD characters: $remaining" -ForegroundColor $(if ($remaining -eq 0) { "Green" } else { "Red" })

# Write back as UTF-8 without BOM
[System.IO.File]::WriteAllText($path, $newContent, [System.Text.Encoding]::UTF8)
Write-Host "File saved: $path" -ForegroundColor Green
