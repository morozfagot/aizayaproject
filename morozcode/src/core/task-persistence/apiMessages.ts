import { safeWriteJson } from "../../utils/safeWriteJson"
import * as path from "path"
import * as fs from "fs/promises"

import { Anthropic } from "@anthropic-ai/sdk"

import { fileExistsAtPath } from "../../utils/fs"

import { GlobalFileNames } from "../../shared/globalFileNames"
import { getTaskDirectoryPath } from "../../utils/storage"
import { setRefactoringFlag, clearRefactoringFlag } from "./refactoringLock"

/**
 * Структура тегов релевантности для гибридного RAG-поиска.
 * Используется как pre-filter для векторного поиска + графовые ссылки.
 * Схема версии 1.
 */
export type RelevanceTags = {
	/** Прямые теги — описывают содержание сообщения (макс. 10) */
	direct: string[]

	/** Зависимости — темы, от которых зависит текущее сообщение */
	depends_on: string[]

	/** Зависимые — темы, которые зависят от текущего сообщения */
	depended_by: string[]

	/** Контекстные ссылки — имитация графовых связей */
	references: {
		/** Timestamp (ts) связанных сообщений */
		messages: number[]
		/** Упомянутые файлы (полные пути) */
		files: string[]
		/** Узлы session-tree (напр. "2.9.2") */
		nodes: string[]
	}

	/**
	 * Веса тегов (0.0–1.0) — для дифференцированной фильтрации.
	 * Ключ — имя тега, значение — вес.
	 * Теги без явного веса по умолчанию имеют 0.5.
	 */
	weights: Record<string, number>

	/** Источник тегирования */
	source: "llm" | "auto" | "fallback"

	/** Версия схемы тегов (для миграций) */
	schema_version: 1
}

/** Фрагмент сообщения с тегами релевантности (для chunk-level RAG) */
export type MessageFragment = {
	chunk_id: string
	tags?: RelevanceTags
}

/** ApiMessage с расширенной системой тегов релевантности */
export type TaggedApiMessage = ApiMessage & {
	relevance_tags?: RelevanceTags
	fragments?: MessageFragment[]
}

export type ApiMessage = Anthropic.MessageParam & {
	ts?: number
	isSummary?: boolean
	id?: string
	// For reasoning items stored in API history
	type?: "reasoning"
	summary?: any[]
	encrypted_content?: string
	text?: string
	// For OpenRouter reasoning_details array format (used by Gemini 3, etc.)
	reasoning_details?: any[]
	// For DeepSeek/Z.ai interleaved thinking: reasoning_content that must be preserved during tool call sequences
	// See: https://api-docs.deepseek.com/guides/thinking_mode#tool-calls
	reasoning_content?: string
	// For non-destructive condense: unique identifier for summary messages
	condenseId?: string
	// For non-destructive condense: points to the condenseId of the summary that replaces this message
	// Messages with condenseParent are filtered out when sending to API if the summary exists
	condenseParent?: string
	// For non-destructive truncation: unique identifier for truncation marker messages
	truncationId?: string
	// For non-destructive truncation: points to the truncationId of the marker that hides this message
	// Messages with truncationParent are filtered out when sending to API if the marker exists
	truncationParent?: string
	// Identifies a message as a truncation boundary marker
	isTruncationMarker?: boolean
	// Relevance tags for hybrid RAG search
	relevance_tags?: RelevanceTags
	// Message fragments for chunk-level RAG
	fragments?: MessageFragment[]
}

export async function readApiMessages({
	taskId,
	globalStoragePath,
}: {
	taskId: string
	globalStoragePath: string
}): Promise<ApiMessage[]> {
	const taskDir = await getTaskDirectoryPath(globalStoragePath, taskId)
	const filePath = path.join(taskDir, GlobalFileNames.apiConversationHistory)

	if (await fileExistsAtPath(filePath)) {
		const fileContent = await fs.readFile(filePath, "utf8")
		try {
			const parsedData = JSON.parse(fileContent)
			if (!Array.isArray(parsedData)) {
				console.warn(
					`[readApiMessages] Parsed data is not an array (got ${typeof parsedData}), returning empty. TaskId: ${taskId}, Path: ${filePath}`,
				)
				return []
			}
			if (parsedData.length === 0) {
				console.error(
					`[Roo-Debug] readApiMessages: Found API conversation history file, but it's empty (parsed as []). TaskId: ${taskId}, Path: ${filePath}`,
				)
			}
			return parsedData
		} catch (error) {
			console.warn(
				`[readApiMessages] Error parsing API conversation history file, returning empty. TaskId: ${taskId}, Path: ${filePath}, Error: ${error}`,
			)
			return []
		}
	} else {
		const oldPath = path.join(taskDir, "claude_messages.json")

		if (await fileExistsAtPath(oldPath)) {
			const fileContent = await fs.readFile(oldPath, "utf8")
			try {
				const parsedData = JSON.parse(fileContent)
				if (!Array.isArray(parsedData)) {
					console.warn(
						`[readApiMessages] Parsed OLD data is not an array (got ${typeof parsedData}), returning empty. TaskId: ${taskId}, Path: ${oldPath}`,
					)
					return []
				}
				if (parsedData.length === 0) {
					console.error(
						`[Roo-Debug] readApiMessages: Found OLD API conversation history file (claude_messages.json), but it's empty (parsed as []). TaskId: ${taskId}, Path: ${oldPath}`,
					)
				}
				await fs.unlink(oldPath)
				return parsedData
			} catch (error) {
				console.warn(
					`[readApiMessages] Error parsing OLD API conversation history file (claude_messages.json), returning empty. TaskId: ${taskId}, Path: ${oldPath}, Error: ${error}`,
				)
				// DO NOT unlink oldPath if parsing failed.
				return []
			}
		}
	}

	// If we reach here, neither the new nor the old history file was found.
	console.error(
		`[Roo-Debug] readApiMessages: API conversation history file not found for taskId: ${taskId}. Expected at: ${filePath}`,
	)
	return []
}

export async function saveApiMessages({
	messages,
	taskId,
	globalStoragePath,
}: {
	messages: ApiMessage[]
	taskId: string
	globalStoragePath: string
}) {
	const taskDir = await getTaskDirectoryPath(globalStoragePath, taskId)
	const filePath = path.join(taskDir, GlobalFileNames.apiConversationHistory)
	await safeWriteJson(filePath, messages)
}

/**
 * Трансформация API-сообщений с блокировкой рефакторинга.
 * Потокобезопасная обёртка: setFlag → read → transform → save → finally { clearFlag }.
 *
 * @param taskId - ID задачи
 * @param globalStoragePath - путь к глобальному хранилищу
 * @param transformFn - функция трансформации сообщений
 * @param processId - опциональный ID процесса для отладки
 */
export async function refactorApiMessagesWithLock({
	taskId,
	globalStoragePath,
	transformFn,
	processId,
}: {
	taskId: string
	globalStoragePath: string
	transformFn: (messages: ApiMessage[]) => ApiMessage[] | Promise<ApiMessage[]>
	processId?: string
}): Promise<ApiMessage[]> {
	await setRefactoringFlag(taskId, globalStoragePath, processId)

	try {
		const messages = await readApiMessages({ taskId, globalStoragePath })
		const transformed = await transformFn(messages)
		await saveApiMessages({ messages: transformed, taskId, globalStoragePath })
		return transformed
	} finally {
		await clearRefactoringFlag(taskId, globalStoragePath)
	}
}
