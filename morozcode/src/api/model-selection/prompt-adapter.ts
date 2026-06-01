/**
 * PromptAdapter — сокращение промпта при превышении контекстного окна.
 * Поддерживает три стратегии:
 * - 'tail' — обрезать конец
 * - 'middle' — сохранить начало и конец
 * - 'relevance' — обрезка по релевантности тегов (Context Trimming by Relevance)
 */

import { ApiMessage, RelevanceTags } from "../../core/task-persistence/apiMessages"

export interface PromptAdapterOptions {
	/** Целевое количество токенов (примерно). */
	targetTokens: number
	/** Стратегия сокращения: 'tail' | 'middle' | 'relevance'. */
	strategy?: "tail" | "middle" | "relevance"
}

/**
 * Опции для обрезки по релевантности (strategy = 'relevance').
 */
export interface RelevanceTrimmerOptions {
	/** Целевое количество токенов (примерно). */
	targetTokens: number
	/** Теги текущего промпта для сравнения с тегами сообщений. */
	promptTags: RelevanceTags
	/** Количество последних сообщений, которые всегда сохраняются (recency bias). */
	preserveLastN?: number
	/** Индексы сообщений, которые нельзя удалять (system prompt и т.д.). */
	protectedIndices?: Set<number>
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
 * Оценка количества токенов для массива сообщений.
 */
export function estimateMessagesTokenCount(messages: ApiMessage[]): number {
	let total = 0
	for (const msg of messages) {
		const content = msg.content
		if (typeof content === "string") {
			total += estimateTokenCount(content)
		} else if (Array.isArray(content)) {
			for (const block of content) {
				if (typeof block === "object" && block !== null && "text" in block && typeof block.text === "string") {
					total += estimateTokenCount(block.text)
				}
			}
		}
		// Добавляем накладные расходы на структуру сообщения (~4 токена на роль/формат)
		total += 4
	}
	return total
}

/**
 * Вычисляет relevance score для одного сообщения по сравнению с promptTags.
 *
 * Формула: score = Σ(weight_prompt(t) × weight_message(t)) для всех совпавших тегов t
 *
 * Совпавшие теги — пересечение direct-тегов сообщения и direct-тегов промпта.
 * Если у сообщения нет тегов — score = 0.
 *
 * @param messageTags Теги сообщения
 * @param promptTags Теги промпта
 * @returns Relevance score (≥ 0)
 */
export function computeMessageRelevanceScore(
	messageTags: RelevanceTags,
	promptTags: RelevanceTags,
): number {
	if (!messageTags.direct || messageTags.direct.length === 0) return 0
	if (!promptTags.direct || promptTags.direct.length === 0) return 0

	// Собираем Set direct-тегов промпта для быстрого поиска
	const promptDirectSet = new Set(promptTags.direct)

	let score = 0
	for (const tag of messageTags.direct) {
		if (promptDirectSet.has(tag)) {
			const promptWeight = promptTags.weights?.[tag] ?? 0.5
			const msgWeight = messageTags.weights?.[tag] ?? 0.5
			score += promptWeight * msgWeight
		}
	}

	return score
}

/**
 * Обрезка контекста по релевантности — удаляет наименее релевантные сообщения,
 * сохраняя наиболее релевантные для текущего промпта.
 *
 * Алгоритм:
 * 1. Вычислить relevance score для каждого сообщения (tag overlap × weights)
 * 2. Пометить защищённые сообщения (system prompt, последние N) — их нельзя удалять
 * 3. Отсортировать незащищённые сообщения по score (убывание)
 * 4. Удалять сообщения с наименьшим score, пока контекст не влезет в targetTokens
 * 5. Пересортировать оставшиеся сообщения в хронологическом порядке
 *
 * Это чисто математическая операция — без LLM-вызовов.
 *
 * @param messages Массив сообщений (из API conversation history)
 * @param options Опции обрезки
 * @returns Отфильтрованный массив сообщений, влезающий в targetTokens
 */
export function trimContextByRelevance(
	messages: ApiMessage[],
	options: RelevanceTrimmerOptions,
): ApiMessage[] {
	const { targetTokens, promptTags, preserveLastN = 3, protectedIndices } = options

	// Если нет тегов промпта — обрезка по релевантности невозможна
	if (!promptTags.direct || promptTags.direct.length === 0) {
		return messages
	}

	const currentTokens = estimateMessagesTokenCount(messages)

	// Если контекст уже влезает — ничего не делаем
	if (currentTokens <= targetTokens) {
		return messages
	}

	// Шаг 1: Вычисляем score для каждого сообщения
	type ScoredMessage = {
		index: number
		message: ApiMessage
		score: number
		isProtected: boolean
	}

	const scored: ScoredMessage[] = messages.map((msg, index) => {
		// Определяем, защищено ли сообщение.
		// Примечание: ApiMessage.role имеет тип "user" | "assistant" (из Anthropic.MessageParam),
		// system prompt передаётся отдельно или как первое сообщение с role="user".
		// Защищаем первые 2 сообщения (обычно system context + first user) и последние N.
		const isProtected =
			protectedIndices?.has(index) === true || // явно защищённый
			index < 2 || // первые 2 сообщения (system context + first user)
			index >= messages.length - preserveLastN // последние N сообщений

		// Вычисляем relevance score
		const tags = msg.relevance_tags
		const score = tags ? computeMessageRelevanceScore(tags, promptTags) : 0

		return { index, message: msg, score, isProtected }
	})

	// Шаг 2: Разделяем на защищённые и кандидатов на удаление
	const protectedMessages = scored.filter((s) => s.isProtected)
	const candidates = scored.filter((s) => !s.isProtected)

	// Шаг 3: Считаем токены защищённых сообщений
	let protectedTokens = protectedMessages.reduce(
		(sum, s) => sum + estimateMessagesTokenCount([s.message]),
		0,
	)

	// Если даже защищённые сообщения не влезаем — возвращаем только защищённые
	if (protectedTokens > targetTokens) {
		return protectedMessages
			.sort((a, b) => a.index - b.index)
			.map((s) => s.message)
	}

	// Шаг 4: Сортируем кандидатов по score (убывание) — наиболее релевантные первыми
	candidates.sort((a, b) => b.score - a.score)

	// Шаг 5: Добавляем кандидатов по убыванию score, пока есть место
	const remainingBudget = targetTokens - protectedTokens
	let usedTokens = 0
	const keptCandidates: ScoredMessage[] = []

	for (const candidate of candidates) {
		const msgTokens = estimateMessagesTokenCount([candidate.message])
		if (usedTokens + msgTokens <= remainingBudget) {
			keptCandidates.push(candidate)
			usedTokens += msgTokens
		}
		// Если не влезает — пропускаем (это менее релевантное сообщение)
	}

	// Шаг 6: Объединяем защищённые + отобранных кандидатов и сортируем по хронологии
	const result = [...protectedMessages, ...keptCandidates]
	result.sort((a, b) => a.index - b.index)

	return result.map((s) => s.message)
}

/**
 * Сократить промпт до целевого количества токенов.
 * Для strategy = 'relevance' требуется передать promptTags через options.
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
