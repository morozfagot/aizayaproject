import { Anthropic } from "@anthropic-ai/sdk"

import { ApiMessage, RelevanceTags } from "./apiMessages"
import { waitForRefactoringDone } from "./refactoringLock"
import type { ApiHandler, SingleCompletionHandler } from "../../api"

// ─── Типы ────────────────────────────────────────────────────────────────────

/**
 * Результат генерации тегов промпта.
 */
export interface GeneratePromptTagsResult {
	/** Рефакторенный промпт (или оригинальный при fallback) */
	refinedPrompt: string
	/** Теги релевантности для pre-filter */
	tags: RelevanceTags
	/** Источник тегирования */
	source: "llm" | "fallback"
}

/**
 * Опции для generatePromptTags().
 */
export interface GeneratePromptTagsOptions {
	/** Максимальное количество последних сообщений для контекста */
	maxContextMessages?: number
	/** Таймаут в миллисекунд */
	timeoutMs?: number
	/** Кастомный системный промпт для тегирования */
	systemPrompt?: string
}

// ─── Системный промпт ────────────────────────────────────────────────────────

const PROMPT_TAGGER_SYSTEM_PROMPT = `You are a prompt refactoring and tagging assistant. Your task is to:

1. REFACTOR the user prompt to be more concise and focused (remove redundancy, clarify intent)
2. TAG the prompt with relevance tags for hybrid RAG search

Output format (JSON only, no markdown):
{
  "refined_prompt": "the refactored prompt text",
  "tags": {
    "direct": ["tag1", "tag2"],
    "depends_on": [],
    "depended_by": [],
    "weights": {"tag1": 0.9, "tag2": 0.7}
  }
}

Rules:
- Maximum 10 direct tags
- Weights must be between 0.0 and 1.0
- Use lowercase tags with colons for categories (e.g., "tool:read_file", "file:path/to/file", "topic:typescript")
- Preserve the original meaning and intent
- If the prompt is already concise, return it as-is
- The refined_prompt should be in the same language as the original`

// ─── Вспомогательные функции ─────────────────────────────────────────────────

/**
 * Извлекает текст из ApiMessage для контекста.
 */
function extractMessageTextForContext(message: ApiMessage): string {
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
				}
			}
		}
		return parts.join("\n")
	}

	return ""
}

/**
 * Формирует промпт для LLM из systemPrompt, контекста и текущего промпта.
 */
function buildTaggerPrompt(
	systemPrompt: string,
	recentMessages: ApiMessage[],
	currentPrompt: string,
	maxContextMessages: number = 5,
): string {
	const contextLines: string[] = []
	const recent = recentMessages.slice(-maxContextMessages)

	for (const msg of recent) {
		const text = extractMessageTextForContext(msg)
		if (text.trim()) {
			const truncated = text.length > 300 ? text.slice(0, 300) + "..." : text
			contextLines.push(`${msg.role}: ${truncated}`)
		}
	}

	const contextStr = contextLines.length > 0 ? contextLines.join("\n---\n") : "(no recent context)"

	return `System prompt context:
${systemPrompt.slice(0, 1000)}${systemPrompt.length > 1000 ? "..." : ""}

Recent conversation:
${contextStr}

---

Current user prompt to refactor and tag:
${currentPrompt}

---

Please refactor the prompt and assign relevance tags. Return JSON only.`
}

/**
 * Парсит ответ LLM в GeneratePromptTagsResult.
 * Возвращает null если парсинг не удался.
 */
function parseTaggerResponse(responseText: string): GeneratePromptTagsResult | null {
	let jsonStr = responseText.trim()

	// Убираем markdown code blocks если есть
	const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
	if (codeBlockMatch?.[1]) {
		jsonStr = codeBlockMatch[1].trim()
	}

	try {
		const parsed = JSON.parse(jsonStr)
		if (!parsed.refined_prompt || typeof parsed.refined_prompt !== "string") {
			return null
		}

		const tags: RelevanceTags = {
			direct: Array.isArray(parsed.tags?.direct) ? parsed.tags.direct.slice(0, 10) : [],
			depends_on: Array.isArray(parsed.tags?.depends_on) ? parsed.tags.depends_on : [],
			depended_by: Array.isArray(parsed.tags?.depended_by) ? parsed.tags.depended_by : [],
			references: {
				messages: [],
				files: [],
				nodes: [],
			},
			weights: parsed.tags?.weights && typeof parsed.tags.weights === "object" ? parsed.tags.weights : {},
			source: "llm",
			schema_version: 1,
		}

		return {
			refinedPrompt: parsed.refined_prompt,
			tags,
			source: "llm",
		}
	} catch {
		return null
	}
}

/**
 * Создаёт fallback-результат с оригинальным промптом и пустыми тегами.
 */
function createFallbackResult(originalPrompt: string): GeneratePromptTagsResult {
	return {
		refinedPrompt: originalPrompt,
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
			source: "fallback",
			schema_version: 1,
		},
		source: "fallback",
	}
}

// ─── Адаптер ─────────────────────────────────────────────────────────────────

/**
 * Адаптер для оборачивания ApiHandler в SingleCompletionHandler.
 * Используется для единообразного интерфейса вызова LLM.
 */
export function createPromptTaggerClient(apiHandler: ApiHandler): SingleCompletionHandler {
	return {
		completePrompt: async (prompt: string): Promise<string> => {
			const requestMessages: Array<{ role: "user" | "assistant"; content: string }> = [
				{ role: "user", content: prompt },
			]

			let responseText = ""
			const stream = apiHandler.createMessage(PROMPT_TAGGER_SYSTEM_PROMPT, requestMessages)

			for await (const chunk of stream) {
				if (chunk.type === "text") {
					responseText += chunk.text
				}
			}

			return responseText
		},
	}
}

// ─── Основная функция ────────────────────────────────────────────────────────

/**
 * Единый async LLM-поток для рефакторинга промпта + тегирования.
 *
 * Алгоритм:
 * 1. waitForRefactoringDone() — ждём завершения рефакторинга БД
 * 2. Формируем промпт из systemPrompt + recentMessages + currentPrompt
 * 3. Вызываем LLM через apiHandler
 * 4. Парсим ответ → { refinedPrompt, tags }
 * 5. Fallback: оригинальный промпт без тегов при ошибке LLM
 *
 * @param systemPrompt - Системный промпт задачи
 * @param recentMessages - Последние сообщения для контекста
 * @param currentPrompt - Текущий промпт пользователя
 * @param apiHandler - API handler для LLM-вызова
 * @param taskId - ID задачи (для блокировки рефакторинга)
 * @param globalStoragePath - Путь к глобальному хранилищу
 * @param options - Опции тегирования
 * @returns Результат с рефакторенным промптом и тегами
 */
export async function generatePromptTags(
	systemPrompt: string,
	recentMessages: ApiMessage[],
	currentPrompt: string,
	apiHandler: ApiHandler,
	taskId: string,
	globalStoragePath: string,
	options?: GeneratePromptTagsOptions,
): Promise<GeneratePromptTagsResult> {
	const maxContextMessages = options?.maxContextMessages ?? 5
	const timeoutMs = options?.timeoutMs ?? 30000
	const systemPromptForTagger = options?.systemPrompt ?? PROMPT_TAGGER_SYSTEM_PROMPT

	// Шаг 1: Ждём завершения рефакторинга БД
	await waitForRefactoringDone(taskId, globalStoragePath)

	// Шаг 2: Формируем промпт
	const prompt = buildTaggerPrompt(systemPrompt, recentMessages, currentPrompt, maxContextMessages)
	const requestMessages: Array<{ role: "user" | "assistant"; content: string }> = [
		{ role: "user", content: prompt },
	]

	// Шаг 3: Вызываем LLM с таймаутом
	try {
		const timeoutPromise = new Promise<never>((_, reject) =>
			setTimeout(() => reject(new Error("LLM call timed out")), timeoutMs),
		)

		let llmResponse = ""

		const streamPromise = (async () => {
			const stream = apiHandler.createMessage(systemPromptForTagger, requestMessages, { taskId })
			for await (const chunk of stream) {
				if (chunk.type === "text") {
					llmResponse += chunk.text
				}
			}
		})()

		await Promise.race([streamPromise, timeoutPromise])

		// Шаг 4: Парсим ответ
		const result = parseTaggerResponse(llmResponse)

		if (result) {
			return result
		}

		// Fallback: LLM вернул ответ, но парсинг не удался
		console.warn("[generatePromptTags] LLM response parsing failed, using fallback")
		return createFallbackResult(currentPrompt)
	} catch (error) {
		// Ошибка LLM (таймаут, невалидный ответ) — выбрасываем исключение
		const errorMessage = error instanceof Error ? error.message : String(error)
		console.error(`[generatePromptTags] LLM call failed: ${errorMessage}`)
		throw error
	}
}
