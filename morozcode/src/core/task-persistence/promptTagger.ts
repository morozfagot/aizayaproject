/**
 * Рефакторинг и тегирование пользовательского промпта — единый async LLM-поток.
 *
 * Функция generatePromptTags():
 * 1. Принимает systemPrompt + recentMessages + currentPrompt
 * 2. Вызывает лёгкую LLM для рефакторинга промпта (делает чётким, конкретным)
 * 3. LLM присваивает теги рефакторенному промпту
 * 4. Возвращает { refinedPrompt, tags }
 * 5. Fallback: оригинальный промпт без тегов
 *
 * Исправления относительно Roo Code:
 * - Убран фиксированный MAX_CONTEXT_MESSAGES = 3
 * - Контекст передаётся как есть (уже отобран вызывающей стороной)
 */

import { RelevanceTags } from "./apiMessages"
import { createEmptyTags } from "./relevanceTags"
import type { SingleCompletionHandler } from "../../api"

/** Системный промпт для LLM рефакторинга + тегирования */
const REFACTOR_AND_TAG_SYSTEM_PROMPT = `You are a prompt engineer and RAG specialist. Your task is to:

1. REFACTOR the user's prompt to be more specific, clear, and optimized for an AI assistant.
   - Fix vague language, add specificity
   - Preserve the original intent
   - Make it actionable

2. Extract RELEVANCE TAGS from the refactored prompt for RAG retrieval.
   - Tags should be specific and descriptive
   - Use format "domain:concept" (e.g., "tool:read_file", "lang:typescript", "api:rest")
   - Maximum 10 direct tags
   - Each tag gets a weight (0.0-1.0) indicating its importance

Return ONLY valid JSON with this exact schema:
{
  "refactoredPrompt": "the improved prompt text",
  "tags": {
    "direct": ["tag1", "tag2"],
    "weights": {
      "tag1": 0.9,
      "tag2": 0.7
    }
  }
}`

/** Результат generatePromptTags */
export interface GeneratePromptTagsResult {
	refinedPrompt: string
	tags: RelevanceTags
	source: "llm" | "fallback"
}

/** Параметры для generatePromptTags */
export interface GeneratePromptTagsOptions {
	systemPrompt: string
	recentMessages: Array<{ role: string; content: string }>
	currentPrompt: string
	apiHandler: SingleCompletionHandler
}

interface LLMTagsRaw {
	direct: string[]
	weights?: Record<string, number>
}

interface LLMResponseRaw {
	refactoredPrompt: string
	tags: LLMTagsRaw
}

function parseLLMResponse(response: string): GeneratePromptTagsResult {
	const jsonMatch = response.match(/\{[\s\S]*"refactoredPrompt"[\s\S]*\}/)
	if (!jsonMatch) {
		throw new Error(`[generatePromptTags] No JSON found in LLM response: ${response.slice(0, 200)}`)
	}

	const parsed = JSON.parse(jsonMatch[0]) as LLMResponseRaw

	if (!parsed.refactoredPrompt || typeof parsed.refactoredPrompt !== "string") {
		throw new Error("[generatePromptTags] Missing or invalid refactoredPrompt")
	}

	if (!parsed.tags || !Array.isArray(parsed.tags.direct)) {
		throw new Error("[generatePromptTags] Missing or invalid tags.direct")
	}

	const tags: RelevanceTags = {
		direct: parsed.tags.direct.slice(0, 10),
		depends_on: [],
		depended_by: [],
		references: { messages: [], files: [], nodes: [] },
		weights: parsed.tags.weights || {},
		source: "llm",
		schema_version: 1,
	}

	for (const tag of tags.direct) {
		if (!(tag in tags.weights)) {
			tags.weights[tag] = 0.5
		}
	}

	return {
		refinedPrompt: parsed.refactoredPrompt,
		tags,
		source: "llm",
	}
}

export async function generatePromptTags(
	options: GeneratePromptTagsOptions,
): Promise<GeneratePromptTagsResult> {
	const { systemPrompt, recentMessages, currentPrompt, apiHandler } = options

	try {
		// Контекст передаётся как есть — вызывающая сторона уже отобрала релевантные сообщения
		const contextText = recentMessages
			.map((msg) => `[${msg.role}]: ${msg.content}`)
			.join("\n")

		const fullPrompt = `${REFACTOR_AND_TAG_SYSTEM_PROMPT}

=== SYSTEM PROMPT ===
${systemPrompt}

=== RECENT CONTEXT ===
${contextText}

=== USER PROMPT TO REFACTOR AND TAG ===
${currentPrompt}`

		const response = await apiHandler.completePrompt(fullPrompt)
		return parseLLMResponse(response.trim())
	} catch (error) {
		console.warn(`[generatePromptTags] LLM call failed, using fallback:`, error)
		return {
			refinedPrompt: currentPrompt,
			tags: createEmptyTags("fallback"),
			source: "fallback",
		}
	}
}
