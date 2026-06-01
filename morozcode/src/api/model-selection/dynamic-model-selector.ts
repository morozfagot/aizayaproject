/**
 * Dynamic Model Selection — Dynamic Model Selector
 *
 * Selects the most efficient model for a given prompt
 * using multi-criteria filtering and cost optimization.
 */

import type {
	ModelInfo,
	ModelSelectionConfig,
	ModelSelectionResult,
	PromptAnalysis,
	TaskType,
	AccuracyLevel,
} from "./types"
import { PromptAnalyzer, type CDI, type ModelAwareAnalysis } from "./prompt-analyzer"
import { PromptAdapter, type PromptAdaptationResult } from "./prompt-adapter"

/**
 * Error thrown when all models are overloaded or unavailable.
 */
export class ModelOverloadError extends Error {
	constructor(
		message: string,
		public readonly taskType: TaskType,
		public readonly estimatedTokens: number
	) {
		super(message)
		this.name = "ModelOverloadError"
	}
}

/**
 * Dynamic model selector with multi-criteria optimization.
 */
export class DynamicModelSelector {
	private readonly analyzer: PromptAnalyzer
	private readonly adapter: PromptAdapter

	constructor() {
		this.analyzer = new PromptAnalyzer()
		this.adapter = new PromptAdapter()
	}

	/**
	 * Pick the most efficient model for the given prompt.
	 * Uses Formula B: efficiency = (accuracy * benchmark_score) / cost
	 *
	 * @param prompt The prompt to analyze
	 * @param availableModels List of available models
	 * @param config Selection configuration
	 * @param contextMessages Optional context messages for CDI calculation
	 * @returns Selected model and adaptation info
	 * @throws ModelOverloadError if no suitable model found
	 */
	pickMostEfficient(
		prompt: string,
		availableModels: ModelInfo[],
		config: ModelSelectionConfig,
		contextMessages?: string[]
	): ModelSelectionResult {
		if (!config.enabled) {
			return this.createFallbackResult(availableModels, config)
		}

		// Step 1: Analyze prompt with model awareness (includes CDI)
		const analysis = this.analyzer.analyzeWithModelAwareness(
			prompt,
			availableModels,
			contextMessages
		)

		// Step 2: Filter by accuracy, complexity, task type, availability
		let candidates = this.filterByCriteria(availableModels, analysis, config)

		// Step 3: Filter by token limit (considering CDI)
		candidates = this.filterByTokenLimit(candidates, analysis)

		// Step 4: If no candidates, try prompt adaptation
		if (candidates.length === 0 && config.allowPromptAdaptation) {
			return this.tryWithAdaptation(prompt, availableModels, analysis, config, contextMessages)
		}

		// Step 5: If still no candidates, throw ModelOverloadError
		if (candidates.length === 0) {
			throw new ModelOverloadError(
				`No suitable model found for task type "${analysis.taskType}" with ${analysis.estimatedTokens} tokens`,
				analysis.taskType,
				analysis.estimatedTokens
			)
		}

		// Step 6: Optimize by cost using Formula B
		const selected = this.optimizeByEfficiency(candidates, analysis, config)

		return {
			model: selected,
			promptAdapted: false,
			selectionReason: this.buildSelectionReason(selected, analysis),
		}
	}

	/**
	 * Filter models by accuracy, complexity, task type, and availability.
	 */
	private filterByCriteria(
		models: ModelInfo[],
		analysis: ModelAwareAnalysis,
		config: ModelSelectionConfig
	): ModelInfo[] {
		const accuracyRank: Record<AccuracyLevel, number> = { low: 1, medium: 2, high: 3 }
		const minAccuracyRank = accuracyRank[config.minAccuracy]

		return models.filter((model) => {
			// Must be available
			if (!model.available) return false

			// Must meet minimum accuracy
			if (accuracyRank[model.accuracyLevel] < minAccuracyRank) return false

			// Must support the task type
			if (!model.taskTypeSuitability.includes(analysis.taskType)) return false

			// Must handle the complexity
			if (!this.canHandleComplexity(model, analysis.complexity)) return false

			return true
		})
	}

	/**
	 * Filter models by token limit, considering CDI.
	 */
	private filterByTokenLimit(
		models: ModelInfo[],
		analysis: ModelAwareAnalysis
	): ModelInfo[] {
		return models.filter((model) => {
			// Use effective context limit if CDI is available
			const effectiveLimit = analysis.effectiveContextLimit || model.maxTokens
			return effectiveLimit >= analysis.estimatedTokens
		})
	}

	/**
	 * Try prompt adaptation when no model fits.
	 */
	private tryWithAdaptation(
		prompt: string,
		availableModels: ModelInfo[],
		analysis: ModelAwareAnalysis,
		config: ModelSelectionConfig,
		contextMessages?: string[]
	): ModelSelectionResult {
		// Find the model with the largest context window
		const sortedByContext = [...availableModels].sort((a, b) => b.maxTokens - a.maxTokens)
		const bestModel = sortedByContext[0]

		if (!bestModel) {
			throw new ModelOverloadError(
				"No models available for prompt adaptation",
				analysis.taskType,
				analysis.estimatedTokens
			)
		}

		// Adapt the prompt
		const adaptation = this.adapter.adapt(prompt, analysis, bestModel.maxTokens)

		return {
			model: bestModel,
			promptAdapted: true,
			originalTokens: adaptation.originalTokens,
			adaptedTokens: adaptation.adaptedTokens,
			selectionReason: `Prompt adapted (${adaptation.method}) to fit ${bestModel.name}`,
		}
	}

	/**
	 * Optimize model selection using Formula B.
	 * Formula B: efficiency = (accuracy * benchmark_score) / cost
	 */
	private optimizeByEfficiency(
		candidates: ModelInfo[],
		analysis: ModelAwareAnalysis,
		config: ModelSelectionConfig
	): ModelInfo {
		const accuracyScore: Record<AccuracyLevel, number> = { low: 0.5, medium: 0.75, high: 1.0 }

		let bestModel = candidates[0]
		let bestEfficiency = -1

		for (const model of candidates) {
			// Get benchmark score from category rankings (lower rank = higher score)
			const rank = model.categoryRankings?.[analysis.taskType] || 100
			const benchmarkScore = Math.max(0, 1 - rank / 200) // Convert rank to 0-1 score

			// Calculate total cost (input + expected output)
			const expectedOutputTokens = Math.min(analysis.estimatedTokens * 0.5, 4096)
			const totalCost =
				analysis.estimatedTokens * model.costPerTokenInput +
				expectedOutputTokens * model.costPerTokenOutput

			// Formula B: efficiency = (accuracy * benchmark_score) / cost
			const efficiency = totalCost > 0
				? (accuracyScore[model.accuracyLevel] * benchmarkScore) / totalCost
				: 0

			// Apply category ranking bonus from config
			const configRank = config.categoryRankings?.[analysis.taskType]?.[model.modelId]
			const rankBonus = configRank ? (200 - configRank) / 200 : 0

			const adjustedEfficiency = efficiency * (1 + rankBonus)

			if (adjustedEfficiency > bestEfficiency) {
				bestEfficiency = adjustedEfficiency
				bestModel = model
			}
		}

		return bestModel
	}

	/**
	 * Check if a model can handle the given complexity.
	 */
	private canHandleComplexity(
		model: ModelInfo,
		complexity: string
	): boolean {
		const complexityRank: Record<string, number> = { simple: 1, moderate: 2, complex: 3 }
		const modelRank = complexityRank[model.complexityHandling] || 1
		const requiredRank = complexityRank[complexity] || 1
		return modelRank >= requiredRank
	}

	/**
	 * Create a fallback result when selection is disabled.
	 */
	private createFallbackResult(
		availableModels: ModelInfo[],
		config: ModelSelectionConfig
	): ModelSelectionResult {
		const fallback = config.fallbackModelId
			? availableModels.find((m) => m.modelId === config.fallbackModelId)
			: availableModels.find((m) => m.available)

		if (!fallback) {
			throw new ModelOverloadError("No fallback model available", "general", 0)
		}

		return {
			model: fallback,
			promptAdapted: false,
			selectionReason: "Using fallback model (selection disabled)",
		}
	}

	/**
	 * Build a human-readable selection reason.
	 */
	private buildSelectionReason(model: ModelInfo, analysis: ModelAwareAnalysis): string {
		const rank = model.categoryRankings?.[analysis.taskType]
		const rankInfo = rank ? ` (rank #${rank})` : ""
		return `Selected ${model.name}${rankInfo} for ${analysis.taskType} task`
	}
}
