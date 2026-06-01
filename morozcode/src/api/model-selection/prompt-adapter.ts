/**
 * PromptAdapter — сокращение промпта при превышении контекстного окна.
 */

export interface PromptAdapterOptions {
	/** Целевое количество токенов (примерно). */
	targetTokens: number
	/** Стратегия сокращения: 'tail' — обрезать конец, 'middle' — сохранить начало и конец. */
	strategy?: "tail" | "middle"
}

/**
 * Оценка количества токенов по длине строки.
 * Приближенно: 1 токен ≈ 4 символа для английского, 1.5–2 для кириллицы.
 * Используем консервативную оценку 3 символа на токен.
 */
export function estimateTokenCount(text: string): number {
	return Math.ceil(text.length / 3)
}

/**
 * Сократить промпт до целевого количества токенов.
 */
export function shrinkPrompt(prompt: string, options: PromptAdapterOptions): string {
	const { targetTokens, strategy = "tail" } = options
	const currentTokens = estimateTokenCount(prompt)

	if (currentTokens <= targetTokens) {
		return prompt
	}

	const targetChars = targetTokens * 3

	if (strategy === "tail") {
		return prompt.slice(0, targetChars)
	}

	// middle: сохраняем начало (40%) и конец (40%), убираем середину.
	const headChars = Math.floor(targetChars * 0.4)
	const tailChars = Math.floor(targetChars * 0.4)
	const head = prompt.slice(0, headChars)
	const tail = prompt.slice(-tailChars)
	return `${head}\n\n...[truncated]...\n\n${tail}`
}
