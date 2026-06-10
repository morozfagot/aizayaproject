# fix-taskts-ascii.ps1
# Fix corrupted Russian comments in Task.ts
# All Russian text is encoded as Unicode escapes to avoid encoding issues
# Run: powershell -ExecutionPolicy Bypass -File scripts\fix-taskts-ascii.ps1

$path = Join-Path $PSScriptRoot "..\src\core\task\Task.ts"

if (-not (Test-Path $path)) {
    Write-Host "ERROR: File not found" -ForegroundColor Red
    exit 1
}

$lines = [System.IO.File]::ReadAllLines($path, [System.Text.Encoding]::UTF8)
Write-Host ("Total lines: " + $lines.Length)

# Helper: convert Unicode escape string to actual string
function Convert-UnicodeEscapes($s) {
    return [regex]::Replace($s, '\\u([0-9A-Fa-f]{4})', { param($m) [char]::ConvertFromUtf32([Convert]::ToInt32($m.Groups[1].Value, 16)) })
}

# Define replacements as hashtable: line number (0-based) -> unicode-escaped string
$replacements = @{
    1990 = '// messages to become "orphaned" and restored to active status \u2014 effectively'
    2706 = '// Dynamic Model Selection: \u0432\u044B\u0431\u043E\u0440 \u043E\u043F\u0442\u0438\u043C\u0430\u043B\u044C\u043D\u043E\u0439 \u043C\u043E\u0434\u0435\u043B\u0438 \u0447\u0435\u0440\u0435\u0437 OpenRouter'
    2707 = '// \u0410\u043A\u0442\u0438\u0432\u0438\u0440\u0443\u0435\u0442\u0441\u044F \u043A\u043E\u0433\u0434\u0430 \u0432\u044B\u0431\u0440\u0430\u043D \u043F\u0440\u043E\u0444\u0438\u043B\u044C "Dynamic Model Selection" \u0432 API Configuration'
    3569 = '					// RAG Step 5: \u0420\u0430\u0437\u0431\u0438\u0435\u043D\u0438\u0435 \u043E\u0442\u0432\u0435\u0442\u0430 \u043C\u043E\u0434\u0435\u043B\u0438 \u043D\u0430 \u0444\u0440\u0430\u0433\u043C\u0435\u043D\u0442\u044B'
    3570 = '					// \u0412\u044B\u0437\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u041F\u041E\u0421\u041B\u0415 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F assistant message \u0432 apiConversationHistory'
    3571 = '					// NOTE: \u0421\u0440\u0430\u0437\u0443 \u043F\u043E\u0441\u043B\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0435\u043C modelOverride \u0438 metadata (OpenRouter)'
    3588 = '							// \u041E\u0431\u043D\u043E\u0432\u043B\u044F\u0435\u043C details \u043F\u043E\u0441\u043B\u0435 \u0440\u0430\u0437\u0431\u0438\u0435\u043D\u0438\u044F \u043D\u0430 \u0444\u0440\u0430\u0433\u043C\u0435\u043D\u0442\u044B'
    3596 = '						// Fallback: \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0430\u0435\u043C \u0431\u0435\u0437 \u0444\u0440\u0430\u0433\u043C\u0435\u043D\u0442\u0430\u0446\u0438\u0438'
    3605 = '					// \u041B\u043E\u0433\u0438\u0440\u0443\u0435\u043C \u0448\u0430\u0433 5 (chunkMessage)'
    3611 = '					// \u041B\u043E\u0433\u0438\u0440\u0443\u0435\u043C \u0448\u0430\u0433 6 (\u0438\u043D\u0434\u0435\u043A\u0441\u0430\u0446\u0438\u044F \u0432 Qdrant)'
    3622 = '					// Qdrant-\u0438\u043D\u0434\u0435\u043A\u0441\u0430\u0446\u0438\u044F \u0444\u0440\u0430\u0433\u043C\u0435\u043D\u0442\u043E\u0432 (\u0448\u0430\u0433 6.5)'
    3623 = '					// \u0421\u043E\u0445\u0440\u0430\u043D\u044F\u0435\u043C \u0444\u0440\u0430\u0433\u043C\u0435\u043D\u0442\u044B \u0432 \u043A\u043E\u043B\u043B\u0435\u043A\u0446\u0438\u044E \u0434\u043B\u044F RRR \u043F\u043E\u0438\u0441\u043A\u0430'
    3638 = '								// \u041F\u043E\u043B\u0443\u0447\u0430\u0435\u043C embedder \u0438\u0437 \u043A\u043E\u043D\u0444\u0438\u0433\u0443\u0440\u0430\u0446\u0438\u0438'
    3685 = '							// Non-fatal: \u043E\u0448\u0438\u0431\u043A\u0430 \u043D\u0435 \u0434\u043E\u043B\u0436\u043D\u0430 \u043F\u0440\u0435\u0440\u044B\u0432\u0430\u0442\u044C \u043E\u0441\u043D\u043E\u0432\u043D\u043E\u0439 \u043F\u043E\u0442\u043E\u043A'
    4146 = '		// requests \u2014 even from new subtasks \u2014 will honour the provider''s rate-limit.'
    4329 = '		// RRR-\u043A\u044D\u0448: \u0432\u0435\u043A\u0442\u043E\u0440\u043D\u044B\u0439 \u043F\u043E\u0438\u0441\u043A \u0447\u0435\u0440\u0435\u0437 Qdrant \u0432\u043C\u0435\u0441\u0442\u043E \u0442\u0435\u0433\u043E\u0432'
    4361 = '		// \u041B\u043E\u0433\u0438\u0440\u0443\u0435\u043C \u0448\u0430\u0433 3 (getEffectiveApiHistoryWithVectorSearch)'
    4364 = '		const requestSummary = `\u0412\u0441\u0435\u0433\u043E: ${totalHistory} \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439, \u043E\u0442\u0444\u0438\u043B\u044C\u0442\u0440\u043E\u0432\u0430\u043D\u043E: ${totalHistory - filteredCount}, \u043F\u0435\u0440\u0435\u0434\u0430\u043D\u043E: ${filteredCount}, \u043E\u0431\u043E\u0433\u0430\u0449\u0435\u043D\u0438\u0435: ${enrichedContext}`'
    4465 = '		// \u041D\u0430\u0447\u0438\u043D\u0430\u0435\u043C \u0448\u0430\u0433 4 (api.createMessage) \u043F\u0435\u0440\u0435\u0434 \u0437\u0430\u043F\u0440\u043E\u0441\u043E\u043C \u043A API'
    4508 = '			// \u041F\u043E\u0434\u0441\u0447\u0451\u0442 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439 \u043F\u043E\u0441\u043B\u0435 \u0444\u0438\u043B\u044C\u0442\u0440\u0430\u0446\u0438\u0438 \u0438 \u043E\u0431\u043E\u0433\u0430\u0449\u0435\u043D\u0438\u044F'
    4511 = '			const messagesSummary = `\u0412\u0441\u0435\u0433\u043E: ${cleanConversationHistory.length}, user: ${userCount}, assistant: ${assistantCount}, \u043E\u0431\u043E\u0433\u0430\u0449\u0435\u043D\u0438\u0435: ${enrichedContext}`'
    4513 = '			// \u041B\u043E\u0433\u0438\u0440\u0443\u0435\u043C \u0448\u0430\u0433 4 (api.createMessage) \u0441 \u043F\u043E\u0434\u0440\u043E\u0431\u043D\u044B\u043C \u043E\u0442\u0447\u0451\u0442\u043E\u043C \u043F\u043E\u0441\u043B\u0435 \u0443\u0441\u043F\u0435\u0448\u043D\u043E\u0433\u043E \u043E\u0442\u0432\u0435\u0442\u0430'
    4532 = '			// \u041B\u043E\u0433\u0438\u0440\u0443\u0435\u043C \u0448\u0430\u0433 4 \u0441 \u043E\u0448\u0438\u0431\u043A\u043E\u0439 (\u043E\u0442\u043B\u0438\u0447\u0430\u0442\u044C \u043E\u0442 \u043E\u0448\u0438\u0431\u043A\u0438 \u043E\u0441\u043D\u043E\u0432\u043D\u043E\u0433\u043E \u043F\u043E\u0442\u043E\u043A\u0430)'
    4537 = '			const messagesSummary = `\u0412\u0441\u0435\u0433\u043E: ${cleanConversationHistory.length}, user: ${userCount}, assistant: ${assistantCount}, \u043E\u0431\u043E\u0433\u0430\u0449\u0435\u043D\u0438\u0435: ${enrichedContext}`'
}

$fixed = 0
foreach ($idx in $replacements.Keys) {
    $oldLine = $lines[$idx]
    if ($oldLine.Contains([char]0xFFFD)) {
        $newLine = Convert-UnicodeEscapes $replacements[$idx]
        $lines[$idx] = $newLine
        Write-Host ("Fixed line " + ($idx + 1)) -ForegroundColor Green
        $fixed++
    } else {
        Write-Host ("Line " + ($idx + 1) + ": no corruption found") -ForegroundColor Yellow
    }
}

# Write back
$newContent = $lines -join "`n"
[System.IO.File]::WriteAllText($path, $newContent, [System.Text.Encoding]::UTF8)

# Verify
$remaining = ([regex]::Matches($newContent, [char]0xFFFD)).Count
Write-Host ""
Write-Host ("Fixed " + $fixed + " lines. Remaining U+FFFD: " + $remaining) -ForegroundColor Cyan
