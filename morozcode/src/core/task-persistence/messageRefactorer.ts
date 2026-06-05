import { ApiMessage, MessageFragment, RelevanceTags, saveApiMessages } from "./apiMessages"
import { setRefactoringFlag, clearRefactoringFlag } from "./refactoringLock"
import { TagIndex, addChunkToIndex, persistTagIndex, readTagIndex } from "./tagIndex"
import { generateAutoTags, validateTags } from "./relevanceTags"
import type { ApiHandler } from "../../api"

// ─── Типы ────────────────────────────────────────────────────────────────────

/**
 * Фрагмент сообщения с тегами релевантности (для chunk-level RAG).
 * Расширение MessageFragment из apiMessages.ts с обязательными полями
 * для результата рефакторинга.
 */
export interface RefactoredFragment {
	chunk_id: string
	text: string
	summary: string
	tags: RelevanceTags
	embedding_ref?: string
}

/**
 * Результат рефакторинга и тегирования сообщения.
 */
export interface RefactorAndTagResult {
	/** Фрагменты с тегами */
	fragments: RefactoredFragment[]
	/** Агрегированные теги на уровне сообщения */
	tags: RelevanceTags
	/** Источник тегирования */
	source: "llm" | "fallback"
	/** Стоимость операции (USD) */
	cost: number
	/** Ошибка, если произошла */
	error?: string
}

/**
 * Опции для refactorAndTagMessage.
 */
export interface RefactorAndTagOptions {
	/** Модель для LLM-вызова (опционально, по умолчанию используется модель из apiHandler) */
	model?: string
	/** Максимальное количество фрагментов */
	maxFragments?: number
	/** Таймаут в миллисекундах */
	timeoutMs?: number
	/** Системный промпт (опционально, по умолчанию используется REFACTOR_SYSTEM_PROMPT) */
	systemPrompt?: string
}

// ─── Системный промпт ────────────────────────────────────────────────────────

const REFACTOR_SYSTEM_PROMPT = `You are a message refactoring and tagging assistant. Your task is to:

1. DECOMPOSE the assistant message into logical fragments (chunks)
2. SUMMARIZE each fragment concisely (1-2 sentences)
3. TAG each fragment with relevance tags

Output format (JSON only, no markdown):
{
  "fragments": [
    {
      "chunk_id": "unique-id",
      "text": "fragment text",
      "summary": "brief summary",
      "tags": {
        "direct": ["tag1", "tag2"],
        "depends_on": [],
        "depended_by": [],
        "weights": {"tag1": 0.9, "tag2": 0.7}
      }
    }
  ]
}

Rules:
- Each fragment should be a self-contained unit of meaning
- Maximum 10 direct tags per fragment
- Weights must be between 0.0 and 1.0
- Use lowercase tags with colons for categories (e.g., "tool:read_file", "file:path/to/file")
- If the message is short and coherent, return a single fragment
- Preserve code blocks within fragments`

// ─── Вспомогательные функции ─────────────────────────────────────────────────

/**
 * Извлекает текст из ApiMessage.
 * Обрабатывает как строковый content, так и массив content blocks.
 */
export function extractMessageText(message: ApiMessage): string {
	if (typeof message.content === "string") {
		return message.content
	}

	if (Array.isArray(message.content)) {
		const parts: string[] = []
		for (const block of message.content) {
			if (typeof block === "string") {
				parts.push(block)
			} else if (block && typeof block === "object") {
				const obj = block as unknown as Record<string, unknown>
				if (obj.type === "text" && typeof obj.text === "string") {
					parts.push(obj.text)
				} else if (obj.type === "tool_use") {
					const name = (obj.name as string) || "unknown"
					parts.push(`[tool:${name}]`)
				} else if (obj.type === "tool_result") {
					const content = obj.content
					if (typeof content === "string") {
						parts.push(content)
					} else if (Array.isArray(content)) {
						for (const item of content) {
							if (item && typeof item === "object" && (item as any).type === "text") {
								parts.push((item as any).text || "")
							}
						}
					}
				}
			}
		}
		return parts.join("\n")
	}

	if (message.text) {
		return message.text
	}

	return ""
}

/**
 * Извлекает релевантный контекст из истории сообщений.
 * Возвращает последние N сообщений в формате "role: text".
 */
export function extractRelevantContext(messages: ApiMessage[], contextWindow: number = 5): string {
	const recent = messages.slice(-contextWindow)
	const lines: string[] = []

	for (const msg of recent) {
		const text = extractMessageText(msg)
		if (text.trim()) {
			// Обрезаем длинные сообщения для контекста
			const truncated = text.length > 500 ? text.slice(0, 500) + "..." : text
			lines.push(`${msg.role}: ${truncated}`)
		}
	}

	return lines.join("\n---\n")
}

/**
 * Формирует промпт для LLM из текста сообщения и контекста.
 */
export function buildRefactoringPrompt(
	messageText: string,
	context: string,
	maxFragments: number = 5,
): string {
	return `Context (recent conversation):
${context}

---

Message to refactor and tag:
${messageText}

---

Please decompose this message into at most ${maxFragments} logical fragments, summarize each, and assign relevance tags. Return JSON only.`
}

/**
 * Парсит ответ LLM в массив фрагментов.
 * Возвращает null если парсинг не удался.
 */
export function parseLLMResponse(responseText: string): Array<{
	chunk_id: string
	text: string
	summary: string
	tags: {
		direct: string[]
		depends_on: string[]
		depended_by: string[]
		weights: Record<string, number>
	}
}> | null {
	// Извлекаем JSON из ответа (может быть обёрнут в markdown code block)
	let jsonStr = responseText.trim()

	// Убираем markdown code blocks если есть
	const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
	if (codeBlockMatch?.[1]) {
		jsonStr = codeBlockMatch[1].trim()
	}

	try {
		const parsed = JSON.parse(jsonStr)
		if (!parsed.fragments || !Array.isArray(parsed.fragments)) {
			return null
		}
		return parsed.fragments
	} catch {
		return null
	}
}

/**
 * Конвертирует сырой фрагмент из ответа LLM в RefactoredFragment.
 */
export function convertToMessageFragment(
	raw: {
		chunk_id: string
		text: string
		summary: string
		tags: {
			direct: string[]
			depends_on: string[]
			depended_by: string[]
			weights: Record<string, number>
		}
	},
	messageTs: number,
	fragmentIndex: number,
): RefactoredFragment {
	const chunkId = raw.chunk_id || `msg-${messageTs}-frag-${fragmentIndex}`

	return {
		chunk_id: chunkId,
		text: raw.text,
		summary: raw.summary,
		tags: {
			direct: raw.tags.direct || [],
			depends_on: raw.tags.depends_on || [],
			depended_by: raw.tags.depended_by || [],
			references: {
				messages: [],
				files: [],
				nodes: [],
			},
			weights: raw.tags.weights || {},
			source: "llm",
			schema_version: 1,
		},
	}
}

/**
 * Агрегирует теги фрагментов на уровне сообщения.
 * Объединяет direct теги всех фрагментов, берёт максимальные веса.
 */
export function aggregateFragmentTags(fragments: RefactoredFragment[]): RelevanceTags {
	const allDirect: string[] = []
	const allDependsOn: string[] = []
	const allDependedBy: string[] = []
	const allWeights: Record<string, number> = {}
	const allMessages: number[] = []
	const allFiles: string[] = []
	const allNodes: string[] = []

	for (const frag of fragments) {
		if (!frag.tags) continue

		for (const tag of frag.tags.direct) {
			if (!allDirect.includes(tag)) {
				allDirect.push(tag)
			}
		}

		for (const tag of frag.tags.depends_on) {
			if (!allDependsOn.includes(tag)) {
				allDependsOn.push(tag)
			}
		}

		for (const tag of frag.tags.depended_by) {
			if (!allDependedBy.includes(tag)) {
				allDependedBy.push(tag)
			}
		}

		// Берём максимальный вес для каждого тега
		for (const [tag, weight] of Object.entries(frag.tags.weights)) {
			const existingWeight = allWeights[tag]
			if (existingWeight === undefined || weight > existingWeight) {
				allWeights[tag] = weight
			}
		}

		// Собираем references
		if (frag.tags.references) {
			for (const msg of frag.tags.references.messages) {
				if (!allMessages.includes(msg)) allMessages.push(msg)
			}
			for (const file of frag.tags.references.files) {
				if (!allFiles.includes(file)) allFiles.push(file)
			}
			for (const node of frag.tags.references.nodes) {
				if (!allNodes.includes(node)) allNodes.push(node)
			}
		}
	}

	return {
		direct: allDirect.slice(0, 10),
		depends_on: allDependsOn,
		depended_by: allDependedBy,
		references: {
			messages: allMessages,
			files: allFiles,
			nodes: allNodes,
		},
		weights: allWeights,
		source: "llm",
		schema_version: 1,
	}
}

/**
 * Атомарно сохраняет сообщения и обновляет тег-индекс.
 * Гарантия: либо оба сохранения проходят, либо выбрасывается ошибка.
 */
export async function saveMessagesWithIndex(
	messages: ApiMessage[],
	tagIndex: TagIndex,
	taskId: string,
	globalStoragePath: string,
): Promise<void> {
	// Атомарное сохранение: сначала сообщения, потом индекс
	// Если saveApiMessages упадёт — индекс не обновится (консистентность)
	await saveApiMessages({ messages, taskId, globalStoragePath })
	await persistTagIndex({ index: tagIndex, taskId, globalStoragePath })
}

// ─── Основная функция ────────────────────────────────────────────────────────

/**
 * Рефакторинг и тегирование сообщения — единый async LLM-поток.
 *
 * Алгоритм:
 * 1. setRefactoringFlag()
 * 2. Извлечь текст сообщения и контекст
 * 3. Вызвать LLM для декомпозиции + суммаризации + тегирования
 * 4. Валидировать фрагменты (validateTags), пофрагментный fallback
 * 5. Агрегировать теги на уровне сообщения
 * 6. Сохранить атомарно (saveApiMessages + persistTagIndex)
 * 7. finally { clearRefactoringFlag() }
 *
 * @param message - Сообщение для рефакторинга (обычно assistant)
 * @param messageIndex - Индекс сообщения в массиве истории
 * @param allMessages - Полная история сообщений (для контекста)
 * @param apiHandler - API handler для LLM-вызова
 * @param taskId - ID задачи
 * @param globalStoragePath - Путь к глобальному хранилищу
 * @param options - Опции рефакторинга
 * @returns Результат рефакторинга с фрагментами и тегами
 */
export async function refactorAndTagMessage(
	message: ApiMessage,
	messageIndex: number,
	allMessages: ApiMessage[],
	apiHandler: ApiHandler,
	taskId: string,
	globalStoragePath: string,
	options?: RefactorAndTagOptions,
): Promise<RefactorAndTagResult> {
	const maxFragments = options?.maxFragments ?? 5
	const timeoutMs = options?.timeoutMs ?? 60000
	const systemPrompt = options?.systemPrompt ?? REFACTOR_SYSTEM_PROMPT

	// Шаг 1: Установить флаг рефакторинга
	await setRefactoringFlag(taskId, globalStoragePath, `refactor-${messageIndex}`)

	try {
		// Шаг 2: Извлечь текст и контекст
		const messageText = extractMessageText(message)
		const context = extractRelevantContext(allMessages.slice(0, messageIndex))

		if (!messageText.trim()) {
			// Пустое сообщение — возвращаем fallback
			const autoTags = generateAutoTags(message)
			return {
				fragments: [],
				tags: autoTags,
				source: "fallback",
				cost: 0,
			}
		}

		// Шаг 3: Вызвать LLM
		const prompt = buildRefactoringPrompt(messageText, context, maxFragments)
		const requestMessages: Array<{ role: "user" | "assistant"; content: string }> = [
			{ role: "user", content: prompt },
		]

		let llmResponse = ""
		let cost = 0

		// Вызов LLM с таймаутом
		const timeoutPromise = new Promise<never>((_, reject) =>
			setTimeout(() => reject(new Error("LLM call timed out")), timeoutMs),
		)

		const streamPromise = (async () => {
			const stream = apiHandler.createMessage(systemPrompt, requestMessages, {
				taskId,
				...(options?.model ? { modelOverride: options.model } : {}),
			})
			for await (const chunk of stream) {
				if (chunk.type === "text") {
					llmResponse += chunk.text
				}
				if (chunk.type === "usage") {
					cost = (chunk as any).totalCost ?? 0
				}
			}
		})()

		await Promise.race([streamPromise, timeoutPromise])

		// Шаг 4: Парсинг и валидация
		const parsedFragments = parseLLMResponse(llmResponse)

		if (!parsedFragments || parsedFragments.length === 0) {
			// Fallback: LLM не вернул валидный ответ
			const autoTags = generateAutoTags(message)
			return {
				fragments: [],
				tags: autoTags,
				source: "fallback",
				cost,
				error: "LLM response parsing failed, using auto-tags fallback",
			}
		}

		// Пофрагментная валидация с fallback
		const validFragments: RefactoredFragment[] = []
		const invalidTexts: string[] = []

		for (let i = 0; i < parsedFragments.length; i++) {
			const raw = parsedFragments[i]
			if (!raw) continue

			const fragment = convertToMessageFragment(raw, message.ts ?? Date.now(), i)

			if (validateTags(fragment.tags)) {
				validFragments.push(fragment)
			} else {
				// Невалидный фрагмент — собираем текст для fallback
				invalidTexts.push(raw.text)
			}
		}

		// Если есть невалидные фрагменты — мержим их в один fallback
		if (invalidTexts.length > 0) {
			const fallbackText = invalidTexts.join("\n\n")
			const fallbackTags = generateAutoTags({
				role: "assistant",
				content: fallbackText,
				ts: message.ts,
			} as ApiMessage)

			validFragments.push({
				chunk_id: `msg-${message.ts ?? Date.now()}-frag-fallback`,
				text: fallbackText,
				summary: "Fallback fragment (validation failed)",
				tags: fallbackTags,
			})
		}

		// Шаг 5: Агрегация тегов на уровне сообщения
		const aggregatedTags = aggregateFragmentTags(validFragments)

		// Шаг 6: Атомарное сохранение
		// Обновляем сообщение с фрагментами и тегами
		const updatedMessage: ApiMessage = {
			...message,
			relevance_tags: aggregatedTags,
			fragments: validFragments.map((f) => ({
				chunk_id: f.chunk_id,
				tags: f.tags,
			})),
		}

		const updatedMessages = [...allMessages]
		updatedMessages[messageIndex] = updatedMessage

		// Читаем текущий индекс и обновляем его
		let tagIndex = await readTagIndex({ taskId, globalStoragePath })

		for (const frag of validFragments) {
			if (!frag.tags) continue
			for (const tag of frag.tags.direct) {
				const weight = frag.tags.weights[tag] ?? 0.5
				tagIndex = addChunkToIndex(tagIndex, tag, frag.chunk_id, weight)
			}
			for (const tag of frag.tags.depends_on) {
				const weight = frag.tags.weights[tag] ?? 0.5
				tagIndex = addChunkToIndex(tagIndex, tag, frag.chunk_id, weight)
			}
			for (const tag of frag.tags.depended_by) {
				const weight = frag.tags.weights[tag] ?? 0.5
				tagIndex = addChunkToIndex(tagIndex, tag, frag.chunk_id, weight)
			}
		}

		await saveMessagesWithIndex(updatedMessages, tagIndex, taskId, globalStoragePath)

		return {
			fragments: validFragments,
			tags: aggregatedTags,
			source: "llm",
			cost,
		}
	} catch (error) {
		// Fallback при любой ошибке
		const errorMessage = error instanceof Error ? error.message : String(error)
		const autoTags = generateAutoTags(message)

		return {
			fragments: [],
			tags: autoTags,
			source: "fallback",
			cost: 0,
			error: errorMessage,
		}
	} finally {
		// Шаг 7: Гарантированное снятие флага
		await clearRefactoringFlag(taskId, globalStoragePath)
	}
}
