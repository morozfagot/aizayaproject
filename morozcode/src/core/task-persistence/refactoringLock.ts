import * as path from "path"
import * as fs from "fs/promises"

import { safeWriteJson } from "../../utils/safeWriteJson"
import { fileExistsAtPath } from "../../utils/fs"
import { getTaskDirectoryPath } from "../../utils/storage"
import { GlobalFileNames } from "../../shared/globalFileNames"

/**
 * Состояние блокировки рефакторинга БД истории сообщений.
 * Хранится в файле refactoring_lock.json в директории задачи.
 */
export interface RefactoringLockState {
	/** true — рефакторинг активен, обогащение промпта должно ждать */
	is_refactoring: boolean
	/** ISO-8601 timestamp времени установки флага */
	started_at: string | null
}

/**
 * Опции для waitForRefactoringDone
 */
export interface WaitForRefactoringDoneOptions {
	/** Интервал polling в мс (по умолчанию 200) */
	pollIntervalMs?: number
}

/**
 * Читает текущее состояние блокировки рефакторинга.
 * Если файл не существует или некорректен — возвращает состояние "не заблокировано".
 */
async function readRefactoringLockState(
	taskDir: string,
): Promise<RefactoringLockState> {
	const filePath = path.join(taskDir, GlobalFileNames.refactoringLock)

	if (await fileExistsAtPath(filePath)) {
		try {
			const raw = await fs.readFile(filePath, "utf8")
			const parsed = JSON.parse(raw) as RefactoringLockState
			if (
				parsed &&
				typeof parsed.is_refactoring === "boolean"
			) {
				return parsed
			}
		} catch {
			// Файл повреждён — считаем разблокированным
		}
	}

	return { is_refactoring: false, started_at: null }
}

/**
 * Устанавливает флаг блокировки рефакторинга.
 * Вызывается ПЕРЕД началом рефакторинга БД истории сообщений.
 * Блокирует поток обогащения промпта через waitForRefactoringDone().
 */
export async function setRefactoringFlag({
	taskId,
	globalStoragePath,
}: {
	taskId: string
	globalStoragePath: string
}): Promise<void> {
	const taskDir = await getTaskDirectoryPath(globalStoragePath, taskId)
	const filePath = path.join(taskDir, GlobalFileNames.refactoringLock)

	const lockState: RefactoringLockState = {
		is_refactoring: true,
		started_at: new Date().toISOString(),
	}

	await safeWriteJson(filePath, lockState)
}

/**
 * Снимает флаг блокировки рефакторинга.
 * Вызывается в finally-блоке после завершения рефакторинга.
 * Гарантия завершения: finally { await clearRefactoringFlag() }
 */
export async function clearRefactoringFlag({
	taskId,
	globalStoragePath,
}: {
	taskId: string
	globalStoragePath: string
}): Promise<void> {
	const taskDir = await getTaskDirectoryPath(globalStoragePath, taskId)
	const filePath = path.join(taskDir, GlobalFileNames.refactoringLock)

	const lockState: RefactoringLockState = {
		is_refactoring: false,
		started_at: null,
	}

	await safeWriteJson(filePath, lockState)
}

/**
 * Блокирующий вызов — ждёт, пока флаг is_refactoring станет false.
 * Использует polling с настраиваемым интервалом.
 *
 * Нет таймаута — полагается на гарантию завершения рефакторинга:
 * процесс рефакторинга ОБЯЗАН вызвать clearRefactoringFlag() в finally.
 *
 * Поток обогащения промпта вызывает эту функцию перед тегированием:
 *   await waitForRefactoringDone({ taskId, globalStoragePath })
 */
export async function waitForRefactoringDone({
	taskId,
	globalStoragePath,
	pollIntervalMs = 200,
}: {
	taskId: string
	globalStoragePath: string
} & WaitForRefactoringDoneOptions): Promise<void> {
	const taskDir = await getTaskDirectoryPath(globalStoragePath, taskId)

	while (true) {
		const state = await readRefactoringLockState(taskDir)
		if (!state.is_refactoring) {
			return // Разблокировано — можно продолжать
		}
		await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
	}
}
