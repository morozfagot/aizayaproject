/**
 * Рефакторинг и тегирование ответа модели — единый async LLM-поток.
 *
 * Функция refactorAndTagMessage():
 * 1. Декомпозирует ответ модели на фрагменты (chunk'и)
 * 2. Суммаризует каждый фрагмент
 * 3. Присваивает каждому фрагменту собственные RelevanceTags
 * 4. Обновляет БД и TagIndex атомарно
 * 5. Снимает флаг блокировки в finally
 *
 * Исправления относительно Roo Code:
 * - extractRecentContext() → extractRelevantContext(): динамический контекст
 *   на основе пересечения тегов (Jaccard similarity), а не фиксированное N=3
 */

import { ApiMessage, RelevanceTags, saveApiMessages, type MessageFragment } from "./apiMessages"
import {
	setRefactoringFlag,
	clearRefactoringFlag,
} from "./refactoringLock"
import {
	persistTagIndex,
	buildTagIndex,
} from "./tagIndex"
import { generateAutoTags, validateTags, createEmptyTags } from "./relevanceTags"
import type { SingleCompletionHandler } from "../../api"

/** Результат функции refactorAndTagMessage */
export interface RefactorAndTagResult {
	fragments: MessageFragment[]
	messageTags: RelevanceTags
}

/** Сырой ответ LLM — JSON-структура из промпта */
interface LLMFragmentResult {
	text: string
	summary: string
	tags?: {
		direct: string[]
		depends_on?: string[]
		depended_by?: string[]
		references?: {
			messages?: number[]
			files?: string[]
			nodes?: string[]
		}
		weights?: Record<string, number>
	}
}

interface LLMResponse {
	fragments: LLMFragmentResult[]
}

/** Параметры для refactorAndTagMessage */
export interface RefactorAndTagOptions {
	/** Сообщение ассистента для рефакторинга */
	message: ApiMessage
	/** Весь массив истории сообщений (для контекста и обновления) */
	allMessages: ApiMessage[]
	taskId: string
	globalStoragePath: string
	/** API handler для LLM-вызова */
	apiHandler: SingleCompletionHandler
}

/**
 * Извлекает текстовое содержимое из сообщения.
 */
function extractMessageText(message: ApiMessage): string {
	if (typeof message.content === "string") return message.content
	if (Array.isArray(message.content)) {
		const texts: string[] = []
		for (const block of message.content) {
			const b = block as unknown as Record<string, unknown>
			if (b.type === "text" && typeof b.text === "string") {
				texts.push(b.text)
			}
		}
		return texts.join("\n")
	}
	if (message.text) return message.text
	return ""
}

/**
 * Максимальное количество сообщений в контексте для LLM.
 * Жёсткий лимит предотвращает переполнение контекстного окна.
 */
const MAX_CONTEXT_MESSAGES = 10

/**
 * Минимальный score для включения сообщения в контекст.
 * Сообщения с пересечением тегов ниже этого порога игнорируются.
 */
const MIN_CONTEXT_SCORE = 0.1

/**
 * Извлекает релевантный контекст из истории сообщений на основе
 * пересечения тегов с текущим сообщением.
 *
 * Алгоритм (динамический контекст):
 * 1. Собираем все уникальные теги из ближайших сообщений как "профиль темы"
 * 2. Для каждого сообщения вычисляем score = |intersection| / |union|
 *    (Jaccard similarity между наборами тегов)
 * 3. Фильтруем: score >= MIN_CONTEXT_SCORE
 * 4. Сортируем по убыванию score, затем по времени (сначала ближайшие)
 * 5. Берём топ-N (MAX_CONTEXT_MESSAGES)
 *
 * Fallback: если у сообщений нет тегов — берём последние 3 сообщения.
 */
function extractRelevantContext(
	allMessages: ApiMessage[],
	currentTs: number | undefined,
): string {
	const currentMsgTs = currentTs ?? Infinity

	// Сообщения ДО текущего
	const messagesBefore = allMessages.filter((m) => (m.ts ?? 0) < currentMsgTs)

	if (messagesBefore.length === 0) {
		return ""
	}

	// Пытаемся найти сообщения с тегами
	const messagesWithTags = messagesBefore.filter(
		(m) => m.relevance_tags && m.relevance_tags.direct && m.relevance_tags.direct.length > 0,
	)

	if (messagesWithTags.length === 0) {
		// Fallback: нет тегов — берём последние 3
		const recent = messagesBefore.slice(-3)
		return recent
			.map((m) => {
				const role = m.role
				const text = extractMessageText(m)
				return `[${role}]: ${text.substring(0, 200)}`
			})
			.join("\n---\n")
	}

	// Собираем все уникальные теги из ближайших сообщений как "профиль темы"
	const recentMessages = messagesBefore.slice(-20)
	const topicTags = new Set<string>()
	for (const m of recentMessages) {
		if (m.relevance_tags?.direct) {
			for (const tag of m.relevance_tags.direct) {
				topicTags.add(tag)
			}
		}
	}

	// Оцениваем каждое сообщение по релевантности к текущей теме
	const scored = messagesBefore.map((m) => {
		const msgTags = new Set(m.relevance_tags?.direct ?? [])

		if (msgTags.size === 0 || topicTags.size === 0) {
			return { message: m, score: 0 }
		}

		// Jaccard similarity: |intersection| / |union|
		const intersection = new Set([...msgTags].filter((t) => topicTags.has(t)))
		const union = new Set([...msgTags, ...topicTags])
		const score = intersection.size / union.size

		return { message: m, score }
	})

	// Фильтруем по минимальному score, сортируем по score (убывание),
	// затем по ts (убывание — ближайшие первыми)
	const relevant = scored
		.filter((s) => s.score >= MIN_CONTEXT_SCORE)
		.sort((a, b) => {
			if (b.score !== a.score) return b.score - a.score
			return (b.message.ts ?? 0) - (a.message.ts ?? 0)
		})
		.slice(0, MAX_CONTEXT_MESSAGES)
		.map((s) => s.message)

	// Если после фильтрации ничего не осталось — fallback на последние 3
	if (relevant.length === 0) {
		const recent = messagesBefore.slice(-3)
		return recent
			.map((m) => {
				const role = m.role
				const text = extractMessageText(m)
				return `[${role}]: ${text.substring(0, 200)}`
			})
			.join("\n---\n")
	}

	return relevant
		.map((m) => {
			const role = m.role
			const text = extractMessageText(m)
			return `[${role}]: ${text.substring(0, 200)}`
		})
		.join("\n---\n")
}

/**
 * Строит промпт для LLM — единый вызов для декомпозиции, суммаризации и тегирования.
 */
function buildRefactoringPrompt(
	messageText: string,
	relevantContext: string,
): string {
	const contextSection = relevantContext
		? `RELEVANT CONTEXT (dynamically selected by tag relevance):
---
${relevantContext}
---`
		: ""

	return `You are a message analyzer for a hybrid RAG system. Your task is to decompose, summarize, and tag an assistant message for efficient retrieval.

MESSAGE TO ANALYZE:
---
${messageText}
---

${contextSection}

Produce valid JSON with this exact schema:
{
  "fragments": [
    {
      "text": "original fragment text",
      "summary": "1-2 sentence summary",
      "tags": {
        "direct": ["topic1", "tool:read_file"],
        "depends_on": [],
        "depended_by": [],
        "references": {
          "messages": [],
          "files": ["src/utils.ts"],
          "nodes": []
        },
        "weights": {
          "tool:read_file": 0.9,
          "topic1": 0.6
        }
      }
    }
  ]
}

RULES:
- Decompose by logical boundaries: topic changes, tool calls, code vs explanation
- Maximum 10 direct tags per fragment
- Tags must be specific: "tool:read_file" not "tool", "typescript:interface" not "code"
- Summary must be 1-2 sentences, self-contained
- Include file paths from tool calls in references.files
- For each tag in "direct", provide a weight (0.0-1.0) in "weights" based on how important this tag is for the fragment's content
- If message is short (< 200 words), return 1 fragment
- Do NOT include markdown code fences or any text outside the JSON object`
}

/**
 * Парсит ответ LLM, извлекая JSON из текста.
 * Обрабатывает markdown-обёртки и другие артефакты.
 */
function parseLLMResponse(rawResponse: string): LLMResponse {
	let cleaned = rawResponse.trim()

	// Убираем markdown code fences если есть
	const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/)
	if (codeBlockMatch) {
		cleaned = codeBlockMatch[1].trim()
	}

	// Убираем текст до первого { и после последнего }
	const firstBrace = cleaned.indexOf("{")
	const lastBrace = cleaned.lastIndexOf("}")
	if (firstBrace !== -1 && lastBrace !== -1) {
		cleaned = cleaned.substring(firstBrace, lastBrace + 1)
	}

	const parsed = JSON.parse(cleaned) as LLMResponse
	if (!parsed.fragments || !Array.isArray(parsed.fragments)) {
		throw new Error("Invalid LLM response: missing fragments array")
	}
	return parsed
}

/**
 * Конвертирует сырой LLM-фрагмент в MessageFragment.
 * Валидирует теги, применяет fallback при необходимости.
 */
function convertToMessageFragment(
	raw: LLMFragmentResult,
	messageTs: number,
	fragmentIndex: number,
): MessageFragment {
	const chunkId = `msg-${messageTs}-frag-${fragmentIndex}`

	// Валидация и fallback тегов
	let tags: RelevanceTags
	if (raw.tags && validateTags(raw.tags as RelevanceTags)) {
		tags = raw.tags as RelevanceTags
	} else {
		// Fallback: пустые теги
		tags = createEmptyTags("fallback")
	}

	return {
		chunk_id: chunkId,
		text: raw.text,
		summary: raw.summary,
		tags,
		embedding_ref: undefined, // Будет заполнено в 2.9.4
	}
}

/**
 * Агрегирует теги всех фрагментов в message-level теги.
 */
function aggregateFragmentTags(fragments: MessageFragment[]): RelevanceTags {
	const direct = new Set<string>()
	const depends_on = new Set<string>()
	const depended_by = new Set<string>()
	const files = new Set<string>()
	const nodes = new Set<string>()
	const messages = new Set<number>()
	const weights: Record<string, number> = {}

	for (const frag of fragments) {
		const t = frag.tags
		for (const tag of t.direct ?? []) {
			direct.add(tag)
			if (t.weights?.[tag] !== undefined) {
				weights[tag] = Math.max(weights[tag] ?? 0, t.weights[tag])
			}
		}
		for (const tag of t.depends_on ?? []) depends_on.add(tag)
		for (const tag of t.depended_by ?? []) depended_by.add(tag)
		for (const f of t.references?.files ?? []) files.add(f)
		for (const n of t.references?.nodes ?? []) nodes.add(n)
		for (const m of t.references?.messages ?? []) messages.add(m)
	}

	// Ограничиваем direct до 10
	const limitedDirect = [...direct].slice(0, 10)

	return {
		direct: limitedDirect,
		depends_on: [...depends_on],
		depended_by: [...depended_by],
		references: {
			messages: [...messages],
			files: [...files],
			nodes: [...nodes],
		},
		weights,
		source: "llm",
		schema_version: 1,
	}
}

/**
 * Рефакторинг и тегирование ответа модели — единый async LLM-поток.
 *
 * Алгоритм:
 * 1. setRefactoringFlag() — блокирует обогащение промпта
 * 2. Извлекаем текст сообщения и динамический контекст
 * 3. Вызываем LLM для декомпозиции + суммаризации + тегирования
 * 4. Валидируем фрагменты, применяем fallback при необходимости
 * 5. Обновляем message.relevance_tags и message.fragments
 * 6. Сохраняем БД и TagIndex атомарно (порядок операций = атомарность)
 * 7. finally { clearRefactoringFlag() } — гарантия снятия блокировки
 */
export async function refactorAndTagMessage({
	message,
	allMessages,
	taskId,
	globalStoragePath,
	apiHandler,
}: RefactorAndTagOptions): Promise<RefactorAndTagResult> {
	// Ставим флаг блокировки
	await setRefactoringFlag({ taskId, globalStoragePath })

	try {
		const messageTs = message.ts ?? Date.now()
		const messageText = extractMessageText(message)
		const relevantContext = extractRelevantContext(allMessages, messageTs)
		const prompt = buildRefactoringPrompt(messageText, relevantContext)

		// Вызываем LLM
		const rawResponse = await apiHandler.completePrompt(prompt)

		// Парсим ответ
		let llmResult: LLMResponse
		try {
			llmResult = parseLLMResponse(rawResponse)
		} catch (parseError) {
			// Полный fallback — LLM вернул невалидный JSON
			console.warn(
				`[refactorAndTagMessage] LLM response parse error, using full fallback. TaskId: ${taskId}`,
			)
			const autoTags = generateAutoTags(message)
			const fallbackFragment: MessageFragment = {
				chunk_id: `msg-${messageTs}-frag-0`,
				text: messageText,
				summary: messageText.substring(0, 200),
				tags: autoTags,
				embedding_ref: undefined,
			}
			;(message as any).relevance_tags = autoTags
			;(message as any).fragments = [fallbackFragment]

			// Сохраняем атомарно
			await saveMessagesWithIndex(allMessages, taskId, globalStoragePath)
			return { fragments: [fallbackFragment], messageTags: autoTags }
		}

		// Конвертируем фрагменты с пофрагментным fallback
		const validFragments: MessageFragment[] = []
		const invalidRawFragments: LLMFragmentResult[] = []

		for (let i = 0; i < llmResult.fragments.length; i++) {
			const raw = llmResult.fragments[i]
			if (raw.tags && validateTags(raw.tags as RelevanceTags)) {
				validFragments.push(
					convertToMessageFragment(raw, messageTs, validFragments.length),
				)
			} else {
				invalidRawFragments.push(raw)
			}
		}

		// Если есть невалидные фрагменты — мерджим в один fallback
		if (invalidRawFragments.length > 0) {
			const mergedText = invalidRawFragments.map((f) => f.text).join("\n")
			const fallbackTags = createEmptyTags("fallback")
			const fallbackFragment: MessageFragment = {
				chunk_id: `msg-${messageTs}-frag-${validFragments.length}`,
				text: mergedText,
				summary: mergedText.substring(0, 200),
				tags: fallbackTags,
				embedding_ref: undefined,
			}
			validFragments.push(fallbackFragment)
		}

		// Если вообще нет фрагментов — полный fallback
		if (validFragments.length === 0) {
			const autoTags = generateAutoTags(message)
			const fallbackFragment: MessageFragment = {
				chunk_id: `msg-${messageTs}-frag-0`,
				text: messageText,
				summary: messageText.substring(0, 200),
				tags: autoTags,
				embedding_ref: undefined,
			}
			;(message as any).relevance_tags = autoTags
			;(message as any).fragments = [fallbackFragment]
			await saveMessagesWithIndex(allMessages, taskId, globalStoragePath)
			return { fragments: [fallbackFragment], messageTags: autoTags }
		}

		// Агрегируем теги на уровне сообщения
		const messageTags = aggregateFragmentTags(validFragments)

		// Обновляем сообщение
		;(message as any).relevance_tags = messageTags
		;(message as any).fragments = validFragments

		// Сохраняем атомарно
		await saveMessagesWithIndex(allMessages, taskId, globalStoragePath)

		return { fragments: validFragments, messageTags }
	} finally {
		await clearRefactoringFlag({ taskId, globalStoragePath })
	}
}

/**
 * Атомарное сохранение сообщений и TagIndex — единая операция.
 * Атомарность обеспечивается порядком операций:
 * 1. Сохраняем сообщения (saveApiMessages)
 * 2. Перестраиваем TagIndex полностью из messages (buildTagIndex)
 * 3. Сохраняем TagIndex (persistTagIndex)
 *
 * TagIndex перестраивается полностью из messages при каждом сохранении,
 * поэтому атомарность гарантирована: индекс всегда консистентен с данными.
 * Ошибка на любом шаге = весь failure (clearRefactoringFlag в finally).
 */
async function saveMessagesWithIndex(
	messages: ApiMessage[],
	taskId: string,
	globalStoragePath: string,
): Promise<void> {
	// 1. Сохраняем сообщения
	await saveApiMessages({ messages, taskId, globalStoragePath })

	// 2. Перестраиваем и сохраняем индекс
	//    Полная перестройка безопаснее инкрементального обновления
	const index = buildTagIndex(messages)
	await persistTagIndex({ index, taskId, globalStoragePath })
}
