import * as path from "path"
import * as fs from "fs/promises"

import { GlobalFileNames } from "../../shared/globalFileNames"
import { getTaskDirectoryPath } from "../../utils/storage"

/**
 * Состояние блокировки рефакторинга.
 * Хранится в refactoring_lock.json в директории задачи.
 */
export interface RefactoringLockState {
	/** Активен ли процесс рефакторing */
	is_refactoring: boolean
	/** Timestamp установки флага */
	started_at?: number
	/** ID процесса рефакторинга (для отладки) */
	process_id?: string
}

const DEFAULT_LOCK_STATE: RefactoringLockState = {
	is_refactoring: false,
}

/**
 * Получить путь к файлу блокировки рефакторинга.
 */
async function getLockFilePath(taskId: string, globalStoragePath: string): Promise<string> {
	const taskDir = await getTaskDirectoryPath(globalStoragePath, taskId)
	return path.join(taskDir, GlobalFileNames.refactoringLock)
}

/**
 * Прочитать текущее состояние блокировки.
 * Если файл отсутствует или повреждён — возвращает дефолтное состояние (is_refactoring: false).
 */
async function readLockState(lockFilePath: string): Promise<RefactoringLockState> {
	try {
		const content = await fs.readFile(lockFilePath, "utf8")
		const parsed = JSON.parse(content) as RefactoringLockState
		return {
			...DEFAULT_LOCK_STATE,
			...parsed,
		}
	} catch {
		// Файл отсутствует или повреждён — считаем что блокировки нет
		return { ...DEFAULT_LOCK_STATE }
	}
}

/**
 * Записать состояние блокировки в файл.
 */
async function writeLockState(lockFilePath: string, state: RefactoringLockState): Promise<void> {
	await fs.writeFile(lockFilePath, JSON.stringify(state, null, 2), "utf8")
}

/**
 * Установить флаг рефакторинга (is_refactoring: true).
 * Вызывается перед началом процесса рефакторинга.
 */
export async function setRefactoringFlag(
	taskId: string,
	globalStoragePath: string,
	processId?: string,
): Promise<void> {
	const lockFilePath = await getLockFilePath(taskId, globalStoragePath)
	const state: RefactoringLockState = {
		is_refactoring: true,
		started_at: Date.now(),
		process_id: processId,
	}
	await writeLockState(lockFilePath, state)
}

/**
 * Снять флаг рефакторинга (is_refactoring: false).
 * Вызывается в finally блоке для гарантированного снятия блокировки.
 */
export async function clearRefactoringFlag(taskId: string, globalStoragePath: string): Promise<void> {
	const lockFilePath = await getLockFilePath(taskId, globalStoragePath)
	const state: RefactoringLockState = {
		is_refactoring: false,
	}
	await writeLockState(lockFilePath, state)
}

/**
 * Ожидание завершения рефакторинга (polling без таймаута).
 * Блокирует выполнение пока is_refactoring не станет false.
 * Гарантия завершения: процесс рефакторинга обязан вызывать clearRefactoringFlag в finally.
 */
export async function waitForRefactoringDone(
	taskId: string,
	globalStoragePath: string,
	pollIntervalMs: number = 500,
): Promise<void> {
	const lockFilePath = await getLockFilePath(taskId, globalStoragePath)

	while (true) {
		const state = await readLockState(lockFilePath)
		if (!state.is_refactoring) {
			return
		}
		// Polling с заданным интервалом
		await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
	}
}
