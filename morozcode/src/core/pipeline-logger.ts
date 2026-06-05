import * as fs from "fs"
import * as path from "path"

/**
 * Запись лога RAG-пайплайна.
 * Расширенный формат для метасознания: включает полный текст запроса/ответа
 * и метаданные модели для динамического анализа нейронкой.
 */
export interface PipelineLogEntry {
	timestamp: string
	taskId: string
	step: 1 | 2 | 3 | 4 | 5 | 6
	status: "success" | "fallback" | "error" | "error-fatal"
	durationMs: number
	details: Record<string, unknown>
	/** Полный текст запроса (user prompt) для метасознания */
	originalRequest?: string
	/** Полный текст ответа (assistant response) для метасознания */
	originalResponse?: string
	/** Использованная модель */
	modelUsed?: string
	/** Количество токенов в запросе (если доступно) */
	tokenCountPrompt?: number
	/** Количество токенов в ответе (если доступно) */
	tokenCountCompletion?: number
	/** Стоимость запроса в USD (если доступна) */
	costUsd?: number
}

/**
 * Логгер RAG-пайплайна.
 * Пишет структурированные логи в формате JSONL.
 */
export class PipelineLogger {
	private readonly logDir: string
	private readonly taskId: string
	private currentStepStart: number = 0

	constructor(taskId: string, logDir: string) {
		this.taskId = taskId
		this.logDir = logDir
	}

	/**
	 * Начать отсчёт времени для шага.
	 */
	startStep(): void {
		this.currentStepStart = Date.now()
	}

	/**
	 * Записать лог шага.
	 * @param step - Номер шага (1-6)
	 * @param status - Статус выполнения
	 * @param details - Детали шага (метаданные)
	 * @param meta - Метаданные для метасознания (опционально)
	 */
	async logStep(
		step: 1 | 2 | 3 | 4 | 5 | 6,
		status: "success" | "fallback" | "error" | "error-fatal",
		details: Record<string, unknown>,
		meta?: {
			originalRequest?: string
			originalResponse?: string
			modelUsed?: string
			tokenCountPrompt?: number
			tokenCountCompletion?: number
			costUsd?: number
		},
	): Promise<void> {
		const durationMs = Date.now() - this.currentStepStart
		const entry: PipelineLogEntry = {
			timestamp: new Date().toISOString(),
			taskId: this.taskId,
			step,
			status,
			durationMs,
			details,
			originalRequest: meta?.originalRequest,
			originalResponse: meta?.originalResponse,
			modelUsed: meta?.modelUsed,
			tokenCountPrompt: meta?.tokenCountPrompt,
			tokenCountCompletion: meta?.tokenCountCompletion,
			costUsd: meta?.costUsd,
		}
		await this.appendLog(entry)
	}

	/**
	 * Записать лог в файл (append, без буферизации).
	 */
	private async appendLog(entry: PipelineLogEntry): Promise<void> {
		try {
			const date = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
			const fileName = `pipeline-${this.taskId}-${date}.jsonl`
			const filePath = path.join(this.logDir, fileName)

			// Создаём директорию если не существует
			if (!fs.existsSync(this.logDir)) {
				fs.mkdirSync(this.logDir, { recursive: true })
			}

			const line = JSON.stringify(entry) + "\n"
			fs.appendFileSync(filePath, line, "utf8")
		} catch (error) {
			// Логгер не должен ломать основной поток
			console.error(`[PipelineLogger] Failed to write log: ${error instanceof Error ? error.message : String(error)}`)
		}
	}
}
