import { ApiMessage, RelevanceTags } from "./apiMessages"

/**
 * Константы для системы весов тегов.
 */
const TAG_WEIGHTS = {
	tool: 0.3,
	tool_result: 0.3,
	file_full_path: 0.8,
	file_name_only: 0.5,
	session_node: 0.7,
	llm_content: 0.6,
	generic: 0.1, // user, assistant, system
	default: 0.5,
} as const

/** Максимальное количество прямых тегов на сообщение */
const MAX_DIRECT_TAGS = 10

/**
 * Генерирует автоматические теги для сообщения на основе его структуры.
 * Вызывается мгновенно при сохранении любого сообщения.
 * Не требует LLM — извлекает информацию из структуры сообщения.
 */
export function generateAutoTags(message: ApiMessage): RelevanceTags {
	const direct: string[] = []
	const depends_on: string[] = []
	const references: RelevanceTags["references"] = {
		messages: [],
		files: [],
		nodes: [],
	}
	const weights: Record<string, number> = {}

	// Определяем тип сообщения и присваиваем базовые теги
	const content = extractContent(message)
	const role = message.role

	if (role === "user") {
		direct.push("user")
		weights["user"] = TAG_WEIGHTS.generic
	} else if (role === "assistant") {
		direct.push("assistant")
		weights["assistant"] = TAG_WEIGHTS.generic

		// Извлекаем tool calls из контента ассистента
		if (Array.isArray(content)) {
			for (const block of content) {
				const blockObj = block as Record<string, unknown>
				if (blockObj.type === "tool_use") {
					const toolName = blockObj.name as string | undefined
					if (toolName) {
						const toolTag = `tool:${toolName}`
						direct.push(toolTag)
						weights[toolTag] = TAG_WEIGHTS.tool

						// Извлекаем файлы из параметров инструмента
						const input = blockObj.input
						if (input && typeof input === "object" && !Array.isArray(input)) {
							const filePaths = extractFilePathsFromObject(input as Record<string, unknown>)
							for (const filePath of filePaths) {
								references.files.push(filePath)
								weights[filePath] = TAG_WEIGHTS.file_full_path
							}
						}
					}
				} else if (blockObj.type === "tool_result") {
					const toolUseId = blockObj.tool_use_id as string | undefined
					if (toolUseId) {
						const resultTag = `tool_result:${toolUseId}`
						direct.push(resultTag)
						weights[resultTag] = TAG_WEIGHTS.tool_result
						depends_on.push(String(message.ts ?? 0))
					}
				}
			}
		}
	} else {
		direct.push("system")
		weights["system"] = TAG_WEIGHTS.generic
	}

	// Убираем дубликаты из direct
	const uniqueTags = [...new Set(direct)]

	return {
		direct: uniqueTags.slice(0, MAX_DIRECT_TAGS),
		depends_on,
		depended_by: [],
		references,
		weights,
		source: "auto",
		schema_version: 1,
	}
}

/**
 * Валидирует теги релевантности.
 * Возвращает true если теги корректны, иначе false.
 *
 * Правила валидации:
 * - Максимум 10 direct тегов
 * - Нет дублирующихся тегов в direct
 * - Все веса в диапазоне 0.0–1.0
 * - Поле source содержит допустимое значение
 * - schema_version === 1
 */
export function validateTags(tags: RelevanceTags): boolean {
	if (!tags || typeof tags !== "object") return false

	// Проверка schema_version
	if (tags.schema_version !== 1) return false

	// Проверка source
	if (!["llm", "auto", "fallback"].includes(tags.source)) return false

	// Проверка direct: не более MAX_DIRECT_TAGS
	if (!Array.isArray(tags.direct)) return false
	if (tags.direct.length > MAX_DIRECT_TAGS) return false

	// Проверка на дубликаты в direct
	const uniqueDirect = new Set(tags.direct)
	if (uniqueDirect.size !== tags.direct.length) return false

	// Проверка весов: все значения 0.0–1.0
	if (typeof tags.weights !== "object" || tags.weights === null) return false
	for (const [key, value] of Object.entries(tags.weights)) {
		if (typeof value !== "number" || value < 0.0 || value > 1.0) {
			return false
		}
	}

	// Проверка references
	if (!tags.references || typeof tags.references !== "object") return false
	if (!Array.isArray(tags.references.messages)) return false
	if (!Array.isArray(tags.references.files)) return false
	if (!Array.isArray(tags.references.nodes)) return false

	// Проверка массивов
	if (!Array.isArray(tags.depends_on)) return false
	if (!Array.isArray(tags.depended_by)) return false

	return true
}

/**
 * Вычисляет множитель релевантности на основе пересечения тегов сообщения и промпта.
 *
 * Формула:
 * - Если нет пересечений → 1.0 (нейтральный множитель)
 * - Если есть пересечения → 1.0 + max(вес_совпавшего_тега)
 *
 * Результат в диапазоне [1.0, 2.0]
 */
export function tagWeightBoost(msgTags: RelevanceTags, promptTags: RelevanceTags): number {
	const intersection = msgTags.direct.filter((t) => promptTags.direct.includes(t))

	if (intersection.length === 0) {
		return 1.0
	}

	const maxWeight = Math.max(...intersection.map((t) => msgTags.weights[t] ?? TAG_WEIGHTS.default))

	return 1.0 + maxWeight
}

/**
 * Создаёт пустые теги релевантности с значениями по умолчанию.
 * Используется как fallback при валидации.
 */
export function createEmptyTags(source: "auto" | "fallback" = "fallback"): RelevanceTags {
	return {
		direct: [],
		depends_on: [],
		depended_by: [],
		references: {
			messages: [],
			files: [],
			nodes: [],
		},
		weights: {},
		source,
		schema_version: 1,
	}
}

/**
 * Извлекает текстовое содержимое из сообщения.
 */
function extractContent(message: ApiMessage): string | Array<unknown> {
	if (message.content) {
		return message.content
	}
	if (message.text) {
		return message.text
	}
	return ""
}

/**
 * Рекурсивно извлекает файловые пути из объекта параметров инструмента.
 * Ищет ключи: path, file_path, filePath, file, files
 */
function extractFilePathsFromObject(obj: Record<string, unknown>): string[] {
	const filePaths: string[] = []
	const fileKeys = ["path", "file_path", "filePath", "file", "files"]

	for (const [key, value] of Object.entries(obj)) {
		if (fileKeys.includes(key)) {
			if (typeof value === "string" && value.length > 0) {
				filePaths.push(value)
			} else if (Array.isArray(value)) {
				for (const item of value) {
					if (typeof item === "string" && item.length > 0) {
						filePaths.push(item)
					}
				}
			}
		} else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
			// Рекурсивный поиск вложенных объектов
			filePaths.push(...extractFilePathsFromObject(value as Record<string, unknown>))
		}
	}

	return filePaths
}
