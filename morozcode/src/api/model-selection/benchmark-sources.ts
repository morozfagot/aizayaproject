/**
 * Dynamic Model Selection — Benchmark Sources
 *
 * Interfaces and implementations for fetching model rankings
 * from multiple benchmark sources.
 */

import type { ModelRanking, BenchmarkWeights } from "./types"

/**
 * Default benchmark weights.
 */
export const DEFAULT_BENCHMARK_WEIGHTS: BenchmarkWeights = {
	openRouter: 0.3,
	artificialAnalysis: 0.3,
	lmsys: 0.3,
	openllm: 0.1,
}

/**
 * Unified interface for benchmark data sources.
 */
export interface BenchmarkSource {
	/** Source name for logging */
	readonly name: string
	/** Fetch rankings from this source */
	fetchRankings(): Promise<ModelRanking[]>
	/** Normalize a raw score to 0-100 scale */
	normalizeScore(rawScore: number): number
}

/**
 * OpenRouter benchmark source.
 * Uses existing OpenRouter rankings API.
 */
export class OpenRouterBenchmarkSource implements BenchmarkSource {
	readonly name = "OpenRouter"

	constructor(private readonly apiKey?: string) {}

	async fetchRankings(): Promise<ModelRanking[]> {
		try {
			const headers: Record<string, string> = {}
			if (this.apiKey) {
				headers["Authorization"] = `Bearer ${this.apiKey}`
			}

			const response = await fetch("https://openrouter.ai/api/v1/models", { headers })
			if (!response.ok) {
				console.warn(`[OpenRouterBenchmarkSource] HTTP ${response.status}: ${response.statusText}`)
				return []
			}

			const data = (await response.json()) as { data: Array<{ id: string; context_length: number; pricing: { prompt: string; completion: string } }> }
			const rankings: ModelRanking[] = []

			for (const model of data.data || []) {
				const promptPrice = parseFloat(model.pricing?.prompt || "0")
				const completionPrice = parseFloat(model.pricing?.completion || "0")
				// Use inverse of cost as score (cheaper = higher score)
				const score = promptPrice > 0 ? Math.min(100, (0.01 / promptPrice) * 100) : 50

				rankings.push({
					modelId: model.id,
					category: "general",
					score: this.normalizeScore(score),
					rank: 0, // Will be assigned after sorting
				})
			}

			// Sort by score descending and assign ranks
			rankings.sort((a, b) => b.score - a.score)
			rankings.forEach((r, i) => { r.rank = i + 1 })

			// Return top 200
			return rankings.slice(0, 200)
		} catch (error) {
			console.warn(`[OpenRouterBenchmarkSource] Fetch failed:`, error)
			return []
		}
	}

	normalizeScore(rawScore: number): number {
		return Math.min(100, Math.max(0, rawScore))
	}
}

/**
 * Artificial Analysis benchmark source.
 * API v2: intelligence_index, coding_index, math_index, mmlu_pro, gpqa, etc.
 */
export class ArtificialAnalysisBenchmarkSource implements BenchmarkSource {
	readonly name = "ArtificialAnalysis"

	constructor(private readonly apiKey?: string) {}

	async fetchRankings(): Promise<ModelRanking[]> {
		if (!this.apiKey) {
			console.warn("[ArtificialAnalysisBenchmarkSource] No API key provided, skipping")
			return []
		}

		try {
			const response = await fetch("https://artificialanalysis.ai/api/v2/data/llms/models", {
				headers: {
					"x-api-key": this.apiKey,
				},
			})

			if (!response.ok) {
				console.warn(`[ArtificialAnalysisBenchmarkSource] HTTP ${response.status}: ${response.statusText}`)
				return []
			}

			const data = (await response.json()) as Array<{
				id: string
				intelligence_index?: number
				coding_index?: number
				math_index?: number
				mmlu_pro?: number
				gpqa?: number
			}>

			const rankings: ModelRanking[] = []

			for (const model of data || []) {
				// Use intelligence_index as primary score (0-100 scale)
				const intelligenceScore = (model.intelligence_index || 0) * 100
				const codingScore = (model.coding_index || 0) * 100
				const mathScore = (model.math_index || 0) * 100

				// General ranking
				rankings.push({
					modelId: model.id,
					category: "general",
					score: this.normalizeScore(intelligenceScore),
					rank: 0,
				})

				// Code ranking
				if (model.coding_index) {
					rankings.push({
						modelId: model.id,
						category: "code",
						score: this.normalizeScore(codingScore),
						rank: 0,
					})
				}

				// Math/Reasoning ranking
				if (model.math_index) {
					rankings.push({
						modelId: model.id,
						category: "reasoning",
						score: this.normalizeScore(mathScore),
						rank: 0,
					})
				}
			}

			// Sort and assign ranks per category
			const categories = [...new Set(rankings.map((r) => r.category))]
			for (const category of categories) {
				const categoryRankings = rankings.filter((r) => r.category === category)
				categoryRankings.sort((a, b) => b.score - a.score)
				categoryRankings.forEach((r, i) => { r.rank = i + 1 })
			}

			return rankings.slice(0, 200)
		} catch (error) {
			console.warn(`[ArtificialAnalysisBenchmarkSource] Fetch failed:`, error)
			return []
		}
	}

	normalizeScore(rawScore: number): number {
		// AA scores are already 0-100
		return Math.min(100, Math.max(0, rawScore))
	}
}

/**
 * LMSYS Chatbot Arena benchmark source.
 * Uses arena-ai-leaderboards API for text/code/math Elo ratings.
 */
export class LMSYSBenchmarkSource implements BenchmarkSource {
	readonly name = "LMSYS"

	private readonly categories = ["text", "code", "math"]

	async fetchRankings(): Promise<ModelRanking[]> {
		const allRankings: ModelRanking[] = []

		for (const category of this.categories) {
			try {
				const response = await fetch(
					`https://api.wulong.dev/arena-ai-leaderboards/v1/leaderboard?name=${category}`
				)

				if (!response.ok) {
					console.warn(`[LMSYSBenchmarkSource] HTTP ${response.status} for ${category}`)
					continue
				}

				const data = (await response.json()).data as Array<{
					model: string
					elo: number
					rank: number
					ci: string
					votes: number
				}>

				for (const entry of data || []) {
					// Normalize Elo to 0-100 scale (assuming max Elo ~1400)
					const normalizedScore = this.normalizeScore((entry.elo / 1400) * 100)

					allRankings.push({
						modelId: entry.model,
						category: category === "text" ? "general" : category,
						score: normalizedScore,
						rank: entry.rank,
					})
				}
			} catch (error) {
				console.warn(`[LMSYSBenchmarkSource] Fetch failed for ${category}:`, error)
			}
		}

		return allRankings.slice(0, 200)
	}

	normalizeScore(rawScore: number): number {
		return Math.min(100, Math.max(0, rawScore))
	}
}

/**
 * OpenLLM benchmark source (HuggingFace).
 * Stub implementation — returns empty array.
 */
export class OpenLLMBenchmarkSource implements BenchmarkSource {
	readonly name = "OpenLLM"

	async fetchRankings(): Promise<ModelRanking[]> {
		// Stub: OpenLLM integration not yet implemented
		console.info("[OpenLLMBenchmarkSource] Stub — returning empty rankings")
		return []
	}

	normalizeScore(): number {
		return 0
	}
}

/**
 * Factory function to create all benchmark sources.
 */
export function createBenchmarkSources(aaApiKey?: string): BenchmarkSource[] {
	return [
		new OpenRouterBenchmarkSource(),
		new ArtificialAnalysisBenchmarkSource(aaApiKey),
		new LMSYSBenchmarkSource(),
		new OpenLLMBenchmarkSource(),
	]
}
