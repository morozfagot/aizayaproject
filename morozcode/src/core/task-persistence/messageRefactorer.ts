import { ApiMessage, MessageFragment, RelevanceTags, saveApiMessages } from "./apiMessages"
import { setRefactoringFlag, clearRefactoringFlag } from "./refactoringLock"

// ─── Типы ────────────────────────────────────────────────────────────────────

/**
 * Фрагмент сообщения для chunk-level RAG.
 */
export interface ChunkFragment {
	chunk_id: string
	text: string
	summary: string
	tags: RelevanceTags
	embedding_ref?: string
}

/**
 * Результат разбиения сообщения на фрагменты (статическое разбиение, без LLM).
 */
export interface ChunkResult {
	/** Фрагменты */
	fragments: ChunkFragment[]
	/** Агрегированные (пустые) теги на уровне сообщения */
	tags: RelevanceTags
	/** Источник разбиения */
	source: "static" | "fallback"
	/** Стоимость операции (всегда 0 для статического разбиения) */
	cost: number
	/** Ошибка, если произошла */
	error?: string
}

/**
 * Опции для chunkMessage (статическое разбиение).
 */
export interface ChunkOptions {
	/** Максимальное количество фрагментов */
	maxFragments?: number
}

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
 * @deprecated LLM-тегирование удалено. Функция сохранена для обратной совместимости.
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
 * @deprecated LLM-тегирование удалено. Функция сохранена для обратной совместимости.
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
 * Конвертирует сырой фрагмент из ответа LLM в ChunkFragment.
 * @deprecated LLM-тегирование удалено. Функция сохранена для обратной совместимости.
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
): ChunkFragment {
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
export function aggregateFragmentTags(fragments: ChunkFragment[]): RelevanceTags {
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

// ─── Основная функция ────────────────────────────────────────────────────────

/**
 * Статическое разбиение сообщения на фрагменты по абзацам (без LLM, без тегов).
 *
 * Алгоритм:
 * 1. setRefactoringFlag()
 * 2. Извлечь текст сообщения
 * 3. Разбить по `\n\n` на абзацы
 * 4. Создать фрагменты с chunk_id = `msg-{ts}-frag-{n}`, без тегов
 * 5. Сохранить сообщение с фрагментами через saveApiMessages()
 * 6. finally { clearRefactoringFlag() }
 *
 * @param message - Сообщение для разбиения (обычно assistant)
 * @param messageIndex - Индекс сообщения в массиве истории
 * @param allMessages - Полная история сообщений
 * @param taskId - ID задачи
 * @param globalStoragePath - Путь к глобальному хранилищу
 * @param options - Опции (только maxFragments)
 * @returns Результат с фрагментами и пустыми тегами
 */
export async function chunkMessage(
	message: ApiMessage,
	messageIndex: number,
	allMessages: ApiMessage[],
	taskId: string,
	globalStoragePath: string,
	options?: ChunkOptions,
): Promise<ChunkResult> {
	const maxFragments = options?.maxFragments ?? 50

	// Шаг 1: Установить флаг разбиения
	await setRefactoringFlag(taskId, globalStoragePath, `refactor-${messageIndex}`)

	try {
		// Шаг 2: Извлечь текст
		const messageText = extractMessageText(message)

		if (!messageText.trim()) {
			// Пустое сообщение — возвращаем fallback
			return {
				fragments: [],
				tags: {
					direct: [],
					depends_on: [],
					depended_by: [],
					references: {
						messages: [],
						files: [],
						nodes: [],
					},
					weights: {},
					source: "static",
					schema_version: 1,
				},
				source: "fallback",
				cost: 0,
			}
		}

		// Шаг 3: Статическое разбиение по абзацам
		const paragraphs = messageText.split(/\n\s*\n/).filter(p => p.trim().length > 0)
		const messageTs = message.ts ?? Date.now()

		// Шаг 4: Создание фрагментов (без тегов)
		const fragments: ChunkFragment[] = []
		for (let i = 0; i < Math.min(paragraphs.length, maxFragments); i++) {
			const text = paragraphs[i].trim()
			if (!text) continue

			fragments.push({
				chunk_id: `msg-${messageTs}-frag-${i}`,
				text,
				summary: text.length > 120 ? text.slice(0, 120) + "..." : text,
				tags: {
					direct: [],
					depends_on: [],
					depended_by: [],
					references: {
						messages: [],
						files: [],
						nodes: [],
					},
					weights: {},
					source: "static" as const,
					schema_version: 1,
				},
			})
		}

		// Агрегированные (пустые) теги на уровне сообщения
		const emptyTags: RelevanceTags = {
			direct: [],
			depends_on: [],
			depended_by: [],
			references: {
				messages: [],
				files: [],
				nodes: [],
			},
			weights: {},
			source: "static",
			schema_version: 1,
		}

		// Шаг 5: Обновляем сообщение с фрагментами
		const updatedMessage: ApiMessage = {
			...message,
			relevance_tags: emptyTags,
			fragments: fragments.map((f) => ({
				chunk_id: f.chunk_id,
				tags: f.tags,
			})),
		}

		const updatedMessages = [...allMessages]
		updatedMessages[messageIndex] = updatedMessage

		// Сохраняем сообщения (без tagIndex)
		await saveApiMessages({ messages: updatedMessages, taskId, globalStoragePath })

		return {
			fragments,
			tags: emptyTags,
			source: "static",
			cost: 0,
		}
	} catch (error) {
		// Fallback при любой ошибке
		const errorMessage = error instanceof Error ? error.message : String(error)

		return {
			fragments: [],
			tags: {
				direct: [],
				depends_on: [],
				depended_by: [],
				references: {
					messages: [],
					files: [],
					nodes: [],
				},
				weights: {},
				source: "static",
				schema_version: 1,
			},
			source: "fallback",
			cost: 0,
			error: errorMessage,
		}
	} finally {
		// Гарантированное снятие флага
		await clearRefactoringFlag(taskId, globalStoragePath)
	}
}
