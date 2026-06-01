import {
	type ModelSelectionConfig,
	type PromptAnalysis,
	type ModelSelectionResult,
	type ModelSelectionOptions,
	ModelOverloadError,
} from "./types"
import { ModelRegistry, complexityGte } from "./model-registry"
import { PromptAnalyzer } from "./prompt-analyzer"
import { estimateTokenCount, shrinkPrompt } from "./prompt-adapter"

export class DynamicModelSelector {
	private registry: ModelRegistry
	private analyzer: PromptAnalyzer

	constructor(registry: ModelRegistry, analyzer: PromptAnalyzer) {
		this.registry = registry
		this.analyzer = analyzer
	}

	async select(
		enrichedPrompt: string,
		options?: ModelSelectionOptions,
	): Promise<ModelSelectionResult> {
		const allModels = await this.registry.getAvailableModels()
		console.log(`[DynamicModelSelector] availableModels=`, allModels.length)

		const modelAwareResult = await this.analyzer.analyzeWithModelAwareness(enrichedPrompt, allModels)
		const analysis = modelAwareResult.analysis
		let promptTokens = estimateTokenCount(modelAwareResult.adaptedPrompt || enrichedPrompt)
		let adaptedPrompt = modelAwareResult.adaptedPrompt

		console.log(`[DynamicModelSelector] analysis=`, analysis, `promptTokens=`, promptTokens, `cdi=`, modelAwareResult.cdi)

		let candidates = this.filterModels(allModels, analysis, promptTokens, options)
		console.log(`[DynamicModelSelector] candidates after filter=`, candidates.length)

		if (candidates.length > 0) {
			const model = this.pickMostEfficient(candidates, promptTokens, analysis.estimatedOutputTokens, analysis.complexity, analysis.taskType)
			console.log(`[DynamicModelSelector] selected without adaptation:`, model.id)
			return { model, temperature: analysis.temperature, adaptedPrompt }
		}

		if (!adaptedPrompt) {
			const capabilityMatches = this.filterByCapability(allModels, analysis, options)
			console.log(`[DynamicModelSelector] capabilityMatches=`, capabilityMatches.length)

			if (capabilityMatches.length > 0) {
				const mostEfficient = this.pickMostEfficient(capabilityMatches, promptTokens, analysis.estimatedOutputTokens, analysis.complexity)
				const targetTokens = Math.floor(mostEfficient.contextWindow * 0.9)

				if (targetTokens < promptTokens) {
					adaptedPrompt = shrinkPrompt(enrichedPrompt, { targetTokens, strategy: "middle" })
					const adaptedTokens = estimateTokenCount(adaptedPrompt)
					console.log(`[DynamicModelSelector] shrink to most efficient model context=${mostEfficient.contextWindow} adaptedTokens=${adaptedTokens}`)

					candidates = this.filterModels(allModels, analysis, adaptedTokens, options)
					if (candidates.length > 0) {
						const model = this.pickMostEfficient(candidates, adaptedTokens, analysis.estimatedOutputTokens, analysis.complexity, analysis.taskType)
						console.log(`[DynamicModelSelector] selected after shrink:`, model.id)
						return { model, temperature: analysis.temperature, adaptedPrompt }
					}
				}
			}
		} else {
			console.log(`[DynamicModelSelector] CDI already shrunk prompt but no candidates found`)
		}

		throw new ModelOverloadError({
			promptTokens,
			complexity: analysis.complexity,
			taskType: analysis.taskType,
			attemptedShrink: true,
			availableModelsCount: allModels.filter((m) => m.availability).length,
		})
	}

	private filterModels(
		models: ModelSelectionConfig[],
		analysis: PromptAnalysis,
		promptTokens: number,
		options?: ModelSelectionOptions,
	): ModelSelectionConfig[] {
		return models.filter((m) => {
			if (!m.availability) return false
			if (options?.preferredProvider && m.apiProvider !== options.preferredProvider) return false
			if (!complexityGte(m.accuracyLevel, analysis.complexity)) return false
			if (!complexityGte(m.complexityHandling, analysis.complexity)) return false
			if (!m.taskTypeSuitability.includes(analysis.taskType)) return false
			const effectiveLimit = m.effectiveContextLimit ?? Math.floor(m.contextWindow * 0.70)
			if (effectiveLimit < promptTokens) return false

			if (m.categoryRankings && m.categoryRankings[analysis.taskType] !== undefined) {
				if (m.categoryRankings[analysis.taskType] > 200) return false
			}

			if (options?.budgetLimit !== undefined) {
				const estimatedCost =
					(promptTokens * m.inputPrice + analysis.estimatedOutputTokens * m.outputPrice) / 1_000_000
				if (estimatedCost > options.budgetLimit) return false
			}
			return true
		})
	}

	private filterByCapability(
		models: ModelSelectionConfig[],
		analysis: PromptAnalysis,
		options?: ModelSelectionOptions,
	): ModelSelectionConfig[] {
		return models.filter((m) => {
			if (!m.availability) return false
			if (options?.preferredProvider && m.apiProvider !== options.preferredProvider) return false
			if (!complexityGte(m.accuracyLevel, analysis.complexity)) return false
			if (!complexityGte(m.complexityHandling, analysis.complexity)) return false
			if (!m.taskTypeSuitability.includes(analysis.taskType)) return false
			if (options?.budgetLimit !== undefined) {
				const estimatedCost =
					(m.contextWindow * m.inputPrice + analysis.estimatedOutputTokens * m.outputPrice) / 1_000_000
				if (estimatedCost > options.budgetLimit) return false
			}
			return true
		})
	}

	private pickMostEfficient(
		candidates: ModelSelectionConfig[],
		inputTokens: number,
		outputTokens: number,
		complexity: PromptAnalysis["complexity"],
		taskType?: string,
	): ModelSelectionConfig {
		const complexityScore = this.complexityToScore(complexity)

		return candidates.reduce((best, current) => {
			const bestCost = inputTokens * best.inputPrice + outputTokens * best.outputPrice
			const currentCost = inputTokens * current.inputPrice + outputTokens * current.outputPrice

			const bestAccuracyScore = this.complexityToScore(best.accuracyLevel)
			const currentAccuracyScore = this.complexityToScore(current.accuracyLevel)

			const bestEfficiency = this.calculateEfficiency(bestAccuracyScore, bestCost, complexityScore)
			const currentEfficiency = this.calculateEfficiency(currentAccuracyScore, currentCost, complexityScore)

			const bestRank = taskType ? best.categoryRankings?.[taskType] ?? Infinity : Infinity
			const currentRank = taskType ? current.categoryRankings?.[taskType] ?? Infinity : Infinity

			const efficiencyDiff = Math.abs(currentEfficiency - bestEfficiency) / Math.max(bestEfficiency, 0.0001)
			if (efficiencyDiff < 0.1) {
				return currentRank < bestRank ? current : best
			}

			return currentEfficiency > bestEfficiency ? current : best
		})
	}

	private calculateEfficiency(accuracyScore: number, cost: number, complexityScore: number): number {
		const matchPenalty = Math.abs(accuracyScore - complexityScore)
		const denominator = cost * (matchPenalty === 0 ? 0.01 : matchPenalty)
		const safeDenominator = Math.max(denominator, 0.0001)
		return accuracyScore / safeDenominator
	}

	private complexityToScore(level: PromptAnalysis["complexity"]): number {
		switch (level) {
			case "low":
				return 1
			case "medium":
				return 2
			case "high":
				return 3
			case "very_high":
				return 4
			default:
				return 2
		}
	}

	private findMaxContextModel(
		models: ModelSelectionConfig[],
		analysis: PromptAnalysis,
		options?: ModelSelectionOptions,
	): ModelSelectionConfig | undefined {
		return this.filterByCapability(models, analysis, options)
			.reduce<ModelSelectionConfig | undefined>((max, m) => {
				if (!max || m.contextWindow > max.contextWindow) return m
				return max
			}, undefined)
	}
}

export async function dynamicModelSelection(
	enrichedPrompt: string,
	registry: ModelRegistry,
	analyzer: PromptAnalyzer,
	options?: ModelSelectionOptions,
): Promise<ModelSelectionResult> {
	const selector = new DynamicModelSelector(registry, analyzer)
	return selector.select(enrichedPrompt, options)
}
