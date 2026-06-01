/**
 * Обратный индекс тегов: тег → массив timestamp сообщений И chunk_id фрагментов.
 *
 * Timestamp сообщения (ts) — это unix-timestamp в миллисекундах (напр. 1714000001234),
 * уникально идентифицирующий момент создания сообщения в истории.
 *
 * Формат файла `session_tag_index.json`:
 * {
 *   "version": 1,
 *   "index": {
 *     "tool:read_file": [1714000001, 1714000005, 1714000010],
 *     "api": [1714000003, 1714000007],
 *     ...
 *   },
 *   "chunk_index": {
 *     "tool:read_file": [
 *       { "chunk_id": "msg-1714000001-frag-0", "weight": 0.9 },
 *       { "chunk_id": "msg-1714000005-frag-1", "weight": 0.7 }
 *     ],
 *     "typescript": [
 *       { "chunk_id": "msg-1714000001-frag-0", "weight": 0.6 }
 *     ],
 *     ...
 *   }
 * }
 *
 * Назначение: быстрый pre-filter по тегам без полного сканирования истории.
 * - `index` — message-level поиск (tag → [message.ts])
 * - `chunk_index` — fragment-level поиск (tag → [{ chunk_id, weight }])
 *   Вес тега берётся из fragment.tags.weights[tag] — одно хранение, никаких дублирований.
 */

import * as path from "path"
import * as fs from "fs/promises"

import { safeWriteJson } from "../../utils/safeWriteJson"
import { fileExistsAtPath } from "../../utils/fs"
import { getTaskDirectoryPath } from "../../utils/storage"
import { GlobalFileNames } from "../../shared/globalFileNames"

/**
 * Entry в chunk_index: chunk_id + вес тега в данном фрагменте.
 */
export interface ChunkIndexEntry {
	chunk_id: string
	weight: number
}

/**
 * Структура индекса тегов.
 */
export interface TagIndex {
	version: 1
	/** Сообщение-уровень: tag → [message.ts] */
	index: Record<string, number[]>
	/** Фрагмент-уровень: tag → [{ chunk_id, weight }] */
	chunk_index: Record<string, ChunkIndexEntry[]>
}

/**
 * Создаёт пустой индекс тегов.
 */
export function createEmptyTagIndex(): TagIndex {
	return {
		version: 1,
		index: {},
		chunk_index: {},
	}
}

/**
 * Добавляет тег в индекс для данного сообщения (по его ts).
 * Возвращает обновлённый индекс.
 */
export function addTagToIndex(index: TagIndex, tag: string, ts: number): TagIndex {
	if (!index.index[tag]) {
		index.index[tag] = []
	}
	// Добавляем только если ещё нет
	if (!index.index[tag].includes(ts)) {
		index.index[tag].push(ts)
		index.index[tag].sort((a, b) => a - b)
	}
	return index
}

/**
 * Удаляет тег из индекса для данного сообщения (по его ts).
 * Возвращает обновлённый индекс.
 */
export function removeTagFromIndex(index: TagIndex, tag: string, ts: number): TagIndex {
	if (index.index[tag]) {
		index.index[tag] = index.index[tag].filter((t) => t !== ts)
		if (index.index[tag].length === 0) {
			delete index.index[tag]
		}
	}
	return index
}

/**
 * Находит все сообщения, содержащие хотя бы один из указанных тегов.
 * Возвращает отсортированный массив уникальных timestamp.
 */
export function lookupTags(index: TagIndex, tags: string[]): number[] {
	const result = new Set<number>()
	for (const tag of tags) {
		if (index.index[tag]) {
			for (const ts of index.index[tag]) {
				result.add(ts)
			}
		}
	}
	return Array.from(result).sort((a, b) => a - b)
}

/**
 * Добавляет тег в chunk_index для данного фрагмента.
 *
 * Алгоритм:
 * 1. Проверяем, есть ли уже массив записей для этого тега в chunk_index.
 *    Если нет — создаём пустой массив.
 * 2. Проверяем, есть ли уже entry с таким chunk_id в массиве.
 *    Если нет — добавляем новый entry { chunk_id, weight }.
 * 3. Сортируем массив по chunk_id для детерминизма.
 * 4. Возвращаем обновлённый индекс.
 *
 * Вес (weight) передаётся из fragment.tags.weights[tag] — это статический вес
 * тега относительно содержания фрагмента, вычисленный LLM при рефакторинге.
 *
 * TODO(RETROACTIVE_TAG): Ретроспективное применение новых тегов.
 * При создании нового тега в БД, механизм обновления БД должен проверить все
 * существующие фрагменты на предмет соответствия этому тегу. Если фрагмент
 * подходит — добавить тег. Это архитектурная задача, реализация отложена.
 * Потребуется:
 * - Функция scanExistingChunksForNewTag(tag: string, allFragments: MessageFragment[])
 * - Интеграция с buildTagIndex() для перестройки индекса
 * - Вызов при создании нового тега через promptTagger или messageRefactorer
 */
export function addChunkToIndex(index: TagIndex, tag: string, chunkId: string, weight: number): TagIndex {
	if (!index.chunk_index[tag]) {
		index.chunk_index[tag] = []
	}
	// Добавляем только если ещё нет entry с таким chunk_id
	const existing = index.chunk_index[tag].find((e) => e.chunk_id === chunkId)
	if (!existing) {
		index.chunk_index[tag].push({ chunk_id: chunkId, weight })
		index.chunk_index[tag].sort((a, b) => a.chunk_id.localeCompare(b.chunk_id))
	}
	return index
}

/**
 * Удаляет chunk_id из chunk_index для данного тега.
 * Возвращает обновлённый индекс.
 */
export function removeChunkFromIndex(index: TagIndex, tag: string, chunkId: string): TagIndex {
	if (index.chunk_index[tag]) {
		index.chunk_index[tag] = index.chunk_index[tag].filter((e) => e.chunk_id !== chunkId)
		if (index.chunk_index[tag].length === 0) {
			delete index.chunk_index[tag]
		}
	}
	return index
}

/**
 * Находит все chunk_id, содержащие ХОТЯ БЫ ОДИН из указанных тегов.
 * Возвращает отсортированный массив уникальных chunk_id.
 *
 * Это функция объединения (union) — для случаев когда нужно найти
 * все фрагменты связанные с любым из тегов.
 */
export function lookupChunksByTag(index: TagIndex, tags: string[]): string[] {
	const result = new Set<string>()
	for (const tag of tags) {
		if (index.chunk_index[tag]) {
			for (const entry of index.chunk_index[tag]) {
				result.add(entry.chunk_id)
			}
		}
	}
	return Array.from(result).sort()
}

/**
 * Находит все chunk_id, содержащие ВСЕ указанные теги (пересечение).
 * Возвращает [{ chunk_id, score }] — score = сумма весов совпавших тегов.
 *
 * Алгоритм:
 * 1. Для каждого тега промпта получаем список { chunk_id, weight } из chunk_index.
 * 2. Считаем сколько раз каждый chunk_id встречается (должен = количеству тегов).
 * 3. Для chunk_id со счётчиком = tags.length (все теги совпали) считаем score.
 * 4. Score = сумма (prompt_weight × fragment_weight) для всех совпавших тегов.
 * 5. Сортируем по убыванию score.
 *
 * @param index TagIndex с chunk_index
 * @param promptTags Теги промпта с весами
 * @returns Массив релевантных фрагментов, отсортированный по score
 */
export function findChunksByAllTags(
	index: TagIndex,
	promptTags: { direct: string[]; weights: Record<string, number> },
): Array<{ chunk_id: string; score: number }> {
	if (promptTags.direct.length === 0) return []

	// Шаг 1: Собираем кандидаты — chunk_id которые есть во ВСЕХ тегах промпта
	const firstTag = promptTags.direct[0]
	if (!firstTag) return []
	const firstEntries = index.chunk_index[firstTag] ?? []
	let candidates = new Set(firstEntries.map((e) => e.chunk_id))

	for (let i = 1; i < promptTags.direct.length; i++) {
		const currentTag = promptTags.direct[i]
		if (!currentTag) continue
		const tagEntries = index.chunk_index[currentTag] ?? []
		const tagChunks = new Set(tagEntries.map((e) => e.chunk_id))
		candidates = new Set([...candidates].filter((c) => tagChunks.has(c)))
	}

	// Шаг 2: Для каждого кандидата считаем score по всем тегам
	const results: Array<{ chunk_id: string; score: number }> = []

	for (const chunkId of candidates) {
		let totalScore = 0

		for (const tag of promptTags.direct) {
			const promptWeight = promptTags.weights[tag] ?? 0.5
			const entries = index.chunk_index[tag] ?? []
			const entry = entries.find((e) => e.chunk_id === chunkId)

			if (entry) {
				totalScore += promptWeight * entry.weight
			}
		}

		results.push({ chunk_id: chunkId, score: totalScore })
	}

	// Шаг 3: Сортируем по убыванию score
	return results.sort((a, b) => b.score - a.score)
}

/**
 * Находит chunk_id по формуле score = Σ(weight_prompt × weight_fragment) для всех совпавших тегов.
 * В отличие от findChunksByAllTags(), НЕ требует пересечения всех тегов — собирает ВСЕ chunk_id
 * по ВСЕМ тегам промпта (union), считает score и фильтрует по порогу k.
 *
 * Алгоритм:
 * 1. Собираем ВСЕ уникальные chunk_id по ВСЕМ тегам промпта (union)
 * 2. Для каждого chunk_id считаем score = Σ(weight_prompt(t) × weight_fragment(t))
 * 3. Фильтруем: score >= threshold
 * 4. Сортируем по убыванию score
 */
export function findChunksByScore(
	index: TagIndex,
	promptTags: { direct: string[]; weights: Record<string, number> },
	threshold: number = 0.5,
): Array<{ chunk_id: string; score: number }> {
	if (promptTags.direct.length === 0) return []

	const allChunks = new Set<string>()
	for (const tag of promptTags.direct) {
		const entries = index.chunk_index[tag] ?? []
		for (const entry of entries) {
			allChunks.add(entry.chunk_id)
		}
	}

	const results: Array<{ chunk_id: string; score: number }> = []

	for (const chunkId of allChunks) {
		let totalScore = 0

		for (const tag of promptTags.direct) {
			const promptWeight = promptTags.weights[tag] ?? 0.5
			const entries = index.chunk_index[tag] ?? []
			const entry = entries.find((e) => e.chunk_id === chunkId)

			if (entry) {
				totalScore += promptWeight * entry.weight
			}
		}

		if (totalScore >= threshold) {
			results.push({ chunk_id: chunkId, score: totalScore })
		}
	}

	return results.sort((a, b) => b.score - a.score)
}

/**
 * Строит полный индекс тегов из массива сообщений с тегами и фрагментами.
 * Используется для начальной индексации или полной перестройки.
 */
export function buildTagIndex(
	messages: Array<{
		ts?: number
		relevance_tags?: any
		fragments?: Array<{ chunk_id?: string; tags?: any }>
	}>,
): TagIndex {
	const index = createEmptyTagIndex()
	for (const msg of messages) {
		if (!msg.ts || !msg.relevance_tags) continue
		const tags = msg.relevance_tags
		for (const tag of tags.direct ?? []) {
			addTagToIndex(index, tag, msg.ts)
		}
		for (const tag of tags.depends_on ?? []) {
			addTagToIndex(index, tag, msg.ts)
		}
		for (const tag of tags.depended_by ?? []) {
			addTagToIndex(index, tag, msg.ts)
		}

		for (const frag of msg.fragments ?? []) {
			if (!frag.chunk_id || !frag.tags) continue
			for (const tag of frag.tags.direct ?? []) {
				const weight = frag.tags.weights?.[tag] ?? 0.5
				addChunkToIndex(index, tag, frag.chunk_id, weight)
			}
			for (const tag of frag.tags.depends_on ?? []) {
				const weight = frag.tags.weights?.[tag] ?? 0.5
				addChunkToIndex(index, tag, frag.chunk_id, weight)
			}
			for (const tag of frag.tags.depended_by ?? []) {
				const weight = frag.tags.weights?.[tag] ?? 0.5
				addChunkToIndex(index, tag, frag.chunk_id, weight)
			}
		}
	}
	return index
}

/**
 * Читает текущий TagIndex из файла session_tag_index.json.
 * Если файл не существует или повреждён — возвращает пустой индекс.
 */
export async function readTagIndex({
	taskId,
	globalStoragePath,
}: {
	taskId: string
	globalStoragePath: string
}): Promise<TagIndex> {
	const taskDir = await getTaskDirectoryPath(globalStoragePath, taskId)
	const filePath = path.join(taskDir, GlobalFileNames.sessionTagIndex)

	if (await fileExistsAtPath(filePath)) {
		try {
			const raw = await fs.readFile(filePath, "utf8")
			const parsed = JSON.parse(raw) as TagIndex
			if (parsed && parsed.version === 1 && typeof parsed.index === "object") {
				if (parsed.chunk_index) {
					for (const tag of Object.keys(parsed.chunk_index)) {
						const entries = parsed.chunk_index[tag]
						if (entries) {
							parsed.chunk_index[tag] = entries.map((entry: string | ChunkIndexEntry) =>
								typeof entry === "string" ? { chunk_id: entry, weight: 0.5 } : entry,
							)
						}
					}
				} else {
					parsed.chunk_index = {}
				}
				return parsed
			}
		} catch {
			// Файл повреждён — считаем пустым
		}
	}

	return createEmptyTagIndex()
}

/**
 * Сохраняет TagIndex в файл session_tag_index.json.
 */
export async function persistTagIndex({
	index,
	taskId,
	globalStoragePath,
}: {
	index: TagIndex
	taskId: string
	globalStoragePath: string
}): Promise<void> {
	const taskDir = await getTaskDirectoryPath(globalStoragePath, taskId)
	const filePath = path.join(taskDir, GlobalFileNames.sessionTagIndex)
	await safeWriteJson(filePath, index)
}
