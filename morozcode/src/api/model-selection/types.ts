/**
 * Dynamic Model Selection — Core Types
 *
 * Separate interface from ModelInfo to avoid coupling with cache strategies.
 */

export type TaskType = "tagging" | "summarization" | "translation" | "code" | "reasoning" | "general"

export type ComplexityLevel = "low" | "medium" | "high" | "very_high"

export interface ModelSelectionConfig {
	id: string
	apiProvider: string
	apiEndpoint?: string
	maxTokens: number
	contextWindow: number
	inputPrice: number
	outputPrice: number
	accuracyLevel: ComplexityLevel
	complexityHandling: ComplexityLevel
	taskTypeSuitability: TaskType[]
	availability: boolean
	/**
	 * Позиции модели в категориях OpenRouter rankings.
	 * Чем меньше число — тем выше позиция в рейтинге.
	 * Пример: { "programming": 5, "reasoning": 12, "coding_python": 3 }
	 */
	categoryRankings?: Record<string, number>
	/**
	 * Эффективный предел контекста — реальный предел качественной обработки.
	 * Рассчитывается по формуле: contextWindow * CDI(accuracyLevel)
	 * где CDI (Context Digestibility Index) зависит от уровня модели:
	 *   very_high: 0.95, high: 0.85, medium: 0.70, low: 0.50
	 *
	 * Основано на исследованиях arXiv:2509.21361 (MECW) и ChromaDB Context Rot.
	 * Модели с большим контекстным окном теряют качество при полном заполнении.
	 */
	effectiveContextLimit?: number
}

export interface PromptAnalysis {
	complexity: ComplexityLevel
	taskType: TaskType
	temperature: number
	estimatedOutputTokens: number
}

export interface ModelSelectionResult {
	model: ModelSelectionConfig
	temperature: number
	adaptedPrompt?: string
}

export interface ModelSelectionOptions {
	expectedOutputTokens?: number
	preferredProvider?: string
	budgetLimit?: number
}

/**
 * Ошибка перегрузки — ни одна модель не справляется с задачей.
 * Содержит анализ для Team Leader'а на декомпозицию.
 */
export class ModelOverloadError extends Error {
	public readonly analysis: {
		promptTokens: number
		complexity: ComplexityLevel
		taskType: TaskType
		attemptedShrink: boolean
		availableModelsCount: number
	}

	constructor(analysis: ModelOverloadError["analysis"]) {
		super(
			`ModelOverload: no model can handle the task (complexity=${analysis.complexity}, taskType=${analysis.taskType}, promptTokens=${analysis.promptTokens}, shrink=${analysis.attemptedShrink})`,
		)
		this.name = "ModelOverloadError"
		this.analysis = analysis
	}
}
