import * as fs from "fs"
import * as path from "path"

/**
 * Запись лога RAG-пайплайна.
 */
export interface PipelineLogEntry {
	timestamp: string
	taskId: string
	step: 1 | 2 | 3 | 4 | 5 | 6
	status: "success" | "fallback" | "error" | "error-fatal"
	durationMs: number
	details: Record<string, unknown>
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
	 */
	async logStep(
		step: 1 | 2 | 3 | 4 | 5 | 6,
		status: "success" | "fallback" | "error" | "error-fatal",
		details: Record<string, unknown>,
	): Promise<void> {
		const durationMs = Date.now() - this.currentStepStart
		const entry: PipelineLogEntry = {
			timestamp: new Date().toISOString(),
			taskId: this.taskId,
			step,
			status,
			durationMs,
			details,
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
