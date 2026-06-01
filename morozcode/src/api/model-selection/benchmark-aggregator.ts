/**
 * Dynamic Model Selection — Benchmark Aggregator
 *
 * Aggregates model rankings from multiple benchmark sources
 * with caching and graceful degradation.
 */

import type { ModelRanking, BenchmarkWeights, BenchmarkSourceStats } from "./types"
import { DEFAULT_BENCHMARK_WEIGHTS } from "./benchmark-sources"
import type { BenchmarkSource } from "./benchmark-sources"

/** Default cache TTL: 24 hours */
export const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000

/**
 * Aggregated model score from multiple sources.
 */
export interface AggregatedModelScore {
	/** Model identifier */
	modelId: string
	/** Category/task type */
	category: string
	/** Weighted average score (0-100) */
	weightedScore: number
	/** Computed rank (1-200) */
	rank: number
	/** Number of sources that contributed */
	sourcesCount: number
}

/**
 * Benchmark aggregator with caching and parallel fetching.
 */
export class BenchmarkAggregator {
	private cache: Map<string, ModelRanking[]> = new Map()
	private cacheTimestamp: number = 0
	private readonly ttlMs: number
	private readonly weights: BenchmarkWeights

	constructor(
		private readonly sources: BenchmarkSource[],
		options?: {
			ttlMs?: number
			weights?: BenchmarkWeights
		}
	) {
		this.ttlMs = options?.ttlMs ?? DEFAULT_CACHE_TTL_MS
		this.weights = options?.weights ?? DEFAULT_BENCHMARK_WEIGHTS
	}

	/**
	 * Get aggregated rankings for all models.
	 * Uses cache if not expired.
	 */
	async getAggregatedRankings(): Promise<AggregatedModelScore[]> {
		if (this.isCacheValid()) {
			console.info("[BenchmarkAggregator] Using cached rankings")
			return this.computeAggregatedScores(this.cache)
		}

		console.info("[BenchmarkAggregator] Fetching fresh rankings from all sources...")
		const stats = await this.fetchAll()
		this.logStats(stats)

		return this.computeAggregatedScores(this.cache)
	}

	/**
	 * Force refresh all rankings (bypasses cache).
	 */
	async refreshAll(): Promise<AggregatedModelScore[]> {
		this.cache.clear()
		this.cacheTimestamp = 0
		return this.getAggregatedRankings()
	}

	/**
	 * Check if cache is still valid.
	 */
	private isCacheValid(): boolean {
		if (this.cache.size === 0) return false
		return Date.now() - this.cacheTimestamp < this.ttlMs
	}

	/**
	 * Fetch rankings from all sources in parallel.
	 */
	private async fetchAll(): Promise<BenchmarkSourceStats[]> {
		const results = await Promise.allSettled(
			this.sources.map(async (source) => {
				const rankings = await source.fetchRankings()
				return { source: source.name, rankings }
			})
		)

		const stats: BenchmarkSourceStats[] = []

		for (const result of results) {
			if (result.status === "fulfilled") {
				const { source, rankings } = result.value
				this.cache.set(source, rankings)
				stats.push({
					entriesCount: rankings.length,
					success: true,
				})
			} else {
				stats.push({
					entriesCount: 0,
					success: false,
					error: result.reason?.message || "Unknown error",
				})
			}
		}

		this.cacheTimestamp = Date.now()
		return stats
	}

	/**
	 * Log fetch statistics.
	 */
	private logStats(stats: BenchmarkSourceStats[]): void {
		for (let i = 0; i < stats.length; i++) {
			const source = this.sources[i]
			const stat = stats[i]
			if (stat.success) {
				console.info(`[BenchmarkAggregator] ${source.name}: ${stat.entriesCount} entries`)
			} else {
				console.warn(`[BenchmarkAggregator] ${source.name}: FAILED - ${stat.error}`)
			}
		}
	}

	/**
	 * Compute aggregated scores from cached rankings.
	 */
	private computeAggregatedScores(cache: Map<string, ModelRanking[]>): AggregatedModelScore[] {
		// Group rankings by modelId + category
		const grouped = new Map<string, { modelId: string; category: string; scores: Array<{ score: number; weight: number }> }>()

		for (const [sourceName, rankings] of cache) {
			const weight = this.getWeightForSource(sourceName)
			for (const ranking of rankings) {
				const key = `${ranking.modelId}::${ranking.category}`
				if (!grouped.has(key)) {
					grouped.set(key, {
						modelId: ranking.modelId,
						category: ranking.category,
						scores: [],
					})
				}
				grouped.get(key)!.scores.push({ score: ranking.score, weight })
			}
		}

		// Compute weighted average for each model
		const aggregated: AggregatedModelScore[] = []

		for (const [, data] of grouped) {
			const totalWeight = data.scores.reduce((sum, s) => sum + s.weight, 0)
			if (totalWeight === 0) continue

			const weightedScore = data.scores.reduce((sum, s) => sum + s.score * s.weight, 0) / totalWeight

			aggregated.push({
				modelId: data.modelId,
				category: data.category,
				weightedScore,
				rank: 0, // Will be assigned after sorting
				sourcesCount: data.scores.length,
			})
		}

		// Sort by category, then by weightedScore descending
		const categories = [...new Set(aggregated.map((a) => a.category))]
		const sorted: AggregatedModelScore[] = []

		for (const category of categories) {
			const categoryItems = aggregated.filter((a) => a.category === category)
			categoryItems.sort((a, b) => b.weightedScore - a.weightedScore)
			categoryItems.forEach((item, i) => { item.rank = i + 1 })
			sorted.push(...categoryItems)
		}

		// Return top 200 per category
		return sorted.filter((a) => a.rank <= 200)
	}

	/**
	 * Get weight for a source by name.
	 */
	private getWeightForSource(sourceName: string): number {
		switch (sourceName) {
			case "OpenRouter":
				return this.weights.openRouter
			case "ArtificialAnalysis":
				return this.weights.artificialAnalysis
			case "LMSYS":
				return this.weights.lmsys
			case "OpenLLM":
				return this.weights.openllm
			default:
				return 0.1
		}
	}
}
