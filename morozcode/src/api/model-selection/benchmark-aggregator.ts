/**
 * Multi-Source Benchmark Aggregator
 *
 * Агрегация бенчмарков из нескольких источников с взвешенным средним.
 * Кэширование результатов (TTL 24 часа) чтобы не долбить API при каждом запросе.
 */

import type { BenchmarkSource, BenchmarkWeights, ModelRanking } from "./benchmark-sources"
import { DEFAULT_BENCHMARK_WEIGHTS } from "./benchmark-sources"

export type AggregatedBenchmarks = Record<string, Record<string, number>>

export interface BenchmarkSourceStats {
	name: string
	entriesCount: number
	success: boolean
	error?: string
}

export interface AggregationResult {
	benchmarks: AggregatedBenchmarks
	sourceStats: BenchmarkSourceStats[]
	aggregationTimeMs: number
	fromCache: boolean
}

export const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000

interface BenchmarkCache {
	data: AggregatedBenchmarks
	timestamp: number
	sourceStats: BenchmarkSourceStats[]
}

export class BenchmarkAggregator {
	private cache: BenchmarkCache | undefined
	private readonly ttlMs: number
	private readonly weights: BenchmarkWeights
	private readonly sources: BenchmarkSource[]

	constructor(
		sources: BenchmarkSource[],
		weights: BenchmarkWeights = DEFAULT_BENCHMARK_WEIGHTS,
		ttlMs: number = DEFAULT_CACHE_TTL_MS,
	) {
		this.sources = sources
		this.weights = weights
		this.ttlMs = ttlMs
	}

	async getAggregatedBenchmarks(): Promise<AggregationResult> {
		const now = Date.now()
		if (this.cache && now - this.cache.timestamp < this.ttlMs) {
			return {
				benchmarks: this.cache.data,
				sourceStats: this.cache.sourceStats,
				aggregationTimeMs: 0,
				fromCache: true,
			}
		}

		const startTime = Date.now()
		const result = await this.aggregate()
		const aggregationTimeMs = Date.now() - startTime

		this.cache = {
			data: result.benchmarks,
			timestamp: now,
			sourceStats: result.sourceStats,
		}

		return { ...result, aggregationTimeMs, fromCache: false }
	}

	async refresh(): Promise<AggregationResult> {
		this.invalidateCache()
		return this.getAggregatedBenchmarks()
	}

	invalidateCache(): void {
		this.cache = undefined
	}

	private async aggregate(): Promise<AggregationResult> {
		const sourceResults = await Promise.allSettled(
			this.sources.map(async (source) => {
				const rankings = await source.fetchRankings()
				return { source, rankings }
			}),
		)

		const sourceStats: BenchmarkSourceStats[] = []
		const successfulResults: { source: BenchmarkSource; rankings: ModelRanking[] }[] = []

		for (const result of sourceResults) {
			if (result.status === "fulfilled") {
				const { source, rankings } = result.value
				sourceStats.push({ name: source.name, entriesCount: rankings.length, success: true })
				if (rankings.length > 0) {
					successfulResults.push({ source, rankings })
				}
			} else {
				sourceStats.push({ name: "unknown", entriesCount: 0, success: false, error: String(result.reason) })
			}
		}

		const benchmarks = this.computeWeightedAverage(successfulResults)
		return { benchmarks, sourceStats, aggregationTimeMs: 0, fromCache: false }
	}

	private computeWeightedAverage(
		results: { source: BenchmarkSource; rankings: ModelRanking[] }[],
	): AggregatedBenchmarks {
		const weightMap: Record<string, number> = {
			openrouter: this.weights.openrouter,
			artificial_analysis: this.weights.artificialAnalysis,
			lmsys: this.weights.lmsys,
			openllm: this.weights.openllm,
		}

		const accumulator = new Map<string, Map<string, { weightedSum: number; weightSum: number }>>()

		for (const { source, rankings } of results) {
			const sourceWeight = weightMap[source.name] ?? 0.1
			for (const ranking of rankings) {
				const modelId = ranking.modelId.toLowerCase()
				const category = ranking.category

				if (!accumulator.has(modelId)) {
					accumulator.set(modelId, new Map())
				}
				const modelCategories = accumulator.get(modelId)!
				if (!modelCategories.has(category)) {
					modelCategories.set(category, { weightedSum: 0, weightSum: 0 })
				}
				const catData = modelCategories.get(category)!
				catData.weightedSum += sourceWeight * ranking.score
				catData.weightSum += sourceWeight
			}
		}

		const benchmarks: AggregatedBenchmarks = {}
		for (const [modelId, categories] of accumulator) {
			benchmarks[modelId] = {}
			for (const [category, data] of categories) {
				if (data.weightSum > 0) {
					const weightedScore = data.weightedSum / data.weightSum
					benchmarks[modelId][category] = Math.round(1 + (1 - weightedScore) * 199)
				}
			}
		}
		return benchmarks
	}
}
