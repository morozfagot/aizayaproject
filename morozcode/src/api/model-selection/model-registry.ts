/**
 * Dynamic Model Selection — Model Registry
 *
 * Registry of available LLM models with benchmark-based rankings
 * and automatic refresh capabilities.
 */

import type { ModelInfo, TaskType, ModelSelectionConfig } from "./types"
import { BenchmarkAggregator } from "./benchmark-aggregator"
import { createBenchmarkSources } from "./benchmark-sources"

/**
 * Model registry with benchmark integration.
 */
export class ModelRegistry {
	private models: Map<string, ModelInfo> = new Map()
	private aggregator: BenchmarkAggregator
	private refreshPromise: Promise<void> | null = null

	/**
	 * Create a new ModelRegistry.
	 * @param cacheTtlMs Cache TTL in milliseconds (default: 5 minutes)
	 * @param aaApiKey Artificial Analysis API key (optional)
	 */
	constructor(
		private readonly cacheTtlMs: number = 5 * 60 * 1000,
		aaApiKey?: string
	) {
		const sources = createBenchmarkSources(aaApiKey)
		this.aggregator = new BenchmarkAggregator(sources, { ttlMs: cacheTtlMs })
	}

	/**
	 * Get all available models.
	 * Fetches from cache or triggers refresh if expired.
	 */
	async getAvailableModels(): Promise<ModelInfo[]> {
		if (this.models.size === 0) {
			await this.refreshAll()
		}
		return Array.from(this.models.values())
	}

	/**
	 * Get a specific model by ID.
	 */
	getModel(modelId: string): ModelInfo | undefined {
		return this.models.get(modelId)
	}

	/**
	 * Register a model manually.
	 */
	registerModel(model: ModelInfo): void {
		this.models.set(model.modelId, model)
	}

	/**
	 * Refresh all models and rankings from benchmark sources.
	 * Uses a single flight pattern to prevent concurrent refreshes.
	 */
	async refreshAll(): Promise<void> {
		if (this.refreshPromise) {
			return this.refreshPromise
		}

		this.refreshPromise = this.doRefresh()
		try {
			await this.refreshPromise
		} finally {
			this.refreshPromise = null
		}
	}

	/**
	 * Internal refresh implementation.
	 */
	private async doRefresh(): Promise<void> {
		console.info("[ModelRegistry] Refreshing models and benchmarks...")

		try {
			const rankings = await this.aggregator.getAggregatedRankings()

			// Update category rankings for existing models
			for (const ranking of rankings) {
				const model = this.models.get(ranking.modelId)
				if (model) {
					if (!model.categoryRankings) {
						model.categoryRankings = {}
					}
					const taskType = ranking.category as TaskType
					model.categoryRankings[taskType] = ranking.rank
				}
			}

			console.info(`[ModelRegistry] Refreshed ${rankings.length} benchmark entries for ${this.models.size} models`)
		} catch (error) {
			console.warn("[ModelRegistry] Benchmark refresh failed, using cached data:", error)
		}
	}

	/**
	 * Get category rankings for a specific task type.
	 * Returns model IDs sorted by rank (best first).
	 */
	getCategoryRankings(taskType: TaskType): string[] {
		const ranked: Array<{ modelId: string; rank: number }> = []

		for (const [modelId, model] of this.models) {
			const rank = model.categoryRankings?.[taskType]
			if (rank !== undefined) {
				ranked.push({ modelId, rank })
			}
		}

		ranked.sort((a, b) => a.rank - b.rank)
		return ranked.map((r) => r.modelId)
	}

	/**
	 * Get the default configuration for model selection.
	 */
	getDefaultConfig(): ModelSelectionConfig {
		return {
			enabled: true,
			minAccuracy: "medium",
			maxCostPerToken: 0.0001,
			preferredTaskTypes: ["general"],
			allowPromptAdaptation: true,
		}
	}
}
