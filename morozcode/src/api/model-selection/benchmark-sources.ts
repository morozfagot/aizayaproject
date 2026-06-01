/**
 * Multi-Source Benchmark Sources
 *
 * Агрегация бенчмарков из нескольких источников для более объективной оценки моделей.
 *
 * Источники:
 * 1. OpenRouter Rankings — уже реализован (categoryRankings)
 * 2. Artificial Analysis — https://artificialanalysis.ai/api/v2/data/llms/models
 * 3. LMSYS Chatbot Arena (через arena-ai-leaderboards) — https://api.wulong.dev/arena-ai-leaderboards/v1/leaderboard?name=text
 * 4. OpenLLM Leaderboard (HuggingFace) — заглушка для будущей интеграции
 */

import type { TaskType } from "./types"

// =============================================================================
// ИНТЕРФЕЙСЫ
// =============================================================================

export interface ModelRanking {
	modelId: string
	category: string
	score: number
	rank: number
}

export interface BenchmarkWeights {
	openrouter: number
	artificialAnalysis: number
	lmsys: number
	openllm: number
}

export const DEFAULT_BENCHMARK_WEIGHTS: BenchmarkWeights = {
	openrouter: 0.3,
	artificialAnalysis: 0.3,
	lmsys: 0.3,
	openllm: 0.1,
}

export interface BenchmarkSource {
	readonly name: string
	fetchRankings(): Promise<ModelRanking[]>
	normalizeScore(score: number, maxPossible: number): number
}

// =============================================================================
// МАППИНГ КАТЕГОРИЙ
// =============================================================================

const AA_CATEGORY_TO_TASK_TYPE: Record<string, TaskType> = {
	artificial_analysis_intelligence_index: "general",
	artificial_analysis_coding_index: "code",
	artificial_analysis_math_index: "reasoning",
	mmlu_pro: "general",
	gpqa: "reasoning",
	hle: "reasoning",
	livecodebench: "code",
	scicode: "code",
	math_500: "reasoning",
	aime: "reasoning",
}

const LMSYS_CATEGORY_TO_TASK_TYPE: Record<string, TaskType> = {
	overall: "general",
	code: "code",
	math: "reasoning",
	hard_prompt: "reasoning",
	longer_query: "summarization",
	multi_turn: "general",
}

// =============================================================================
// ИСТОЧНИК 1: OPENROUTER RANKINGS
// =============================================================================

export class OpenRouterBenchmarkSource implements BenchmarkSource {
	readonly name = "openrouter"

	constructor(
		private readonly fetchRankingsFn: () => Promise<Record<string, Record<string, number>>>,
	) {}

	async fetchRankings(): Promise<ModelRanking[]> {
		const rankings: ModelRanking[] = []
		try {
			const data = await this.fetchRankingsFn()
			for (const [modelId, categories] of Object.entries(data)) {
				for (const [category, rank] of Object.entries(categories)) {
					rankings.push({
						modelId: modelId.toLowerCase(),
						category,
						score: this.normalizeScore(rank, 500),
						rank,
					})
				}
			}
		} catch (err) {
			console.warn("[OpenRouterBenchmarkSource] Failed to fetch rankings:", err)
		}
		return rankings
	}

	normalizeScore(score: number, maxPossible: number): number {
		const normalized = 1 - (score - 1) / (maxPossible - 1)
		return Math.max(0, Math.min(1, normalized))
	}
}

// =============================================================================
// ИСТОЧНИК 2: ARTIFICIAL ANALYSIS
// =============================================================================

interface AAModelEvaluation {
	artificial_analysis_intelligence_index?: number
	artificial_analysis_coding_index?: number
	artificial_analysis_math_index?: number
	mmlu_pro?: number
	gpqa?: number
	hle?: number
	livecodebench?: number
	scicode?: number
	math_500?: number
	aime?: number
}

interface AAModelEntry {
	id: string
	name: string
	slug: string
	evaluations?: AAModelEvaluation
}

interface AAResponse {
	status: number
	data: AAModelEntry[]
}

function normalizeAAModelName(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "")
}

interface AAMetricMapping {
	category: string
	maxScore: number
}

const AA_METRIC_MAPPINGS: Record<string, AAMetricMapping> = {
	artificial_analysis_intelligence_index: { category: "general", maxScore: 100 },
	artificial_analysis_coding_index: { category: "code", maxScore: 100 },
	artificial_analysis_math_index: { category: "reasoning", maxScore: 100 },
	mmlu_pro: { category: "general", maxScore: 1 },
	gpqa: { category: "reasoning", maxScore: 1 },
	hle: { category: "reasoning", maxScore: 1 },
	livecodebench: { category: "code", maxScore: 1 },
	scicode: { category: "code", maxScore: 1 },
	math_500: { category: "reasoning", maxScore: 1 },
	aime: { category: "reasoning", maxScore: 1 },
}

export class ArtificialAnalysisBenchmarkSource implements BenchmarkSource {
	readonly name = "artificial_analysis"
	private readonly apiKey: string | undefined
	private readonly baseUrl = "https://artificialanalysis.ai/api/v2"

	constructor(apiKey?: string) {
		this.apiKey = apiKey
	}

	async fetchRankings(): Promise<ModelRanking[]> {
		const rankings: ModelRanking[] = []
		try {
			const headers: Record<string, string> = { "Content-Type": "application/json" }
			if (this.apiKey) {
				headers["x-api-key"] = this.apiKey
			}

			const response = await fetch(`${this.baseUrl}/data/llms/models`, { headers })
			if (!response.ok) {
				console.warn(`[ArtificialAnalysis] API returned ${response.status}`)
				return rankings
			}

			const data: AAResponse = await response.json()
			if (!data.data || !Array.isArray(data.data)) return rankings

			for (const model of data.data) {
				const modelId = normalizeAAModelName(model.name)
				const evaluations = model.evaluations
				if (!evaluations) continue

				for (const [metricName, mapping] of Object.entries(AA_METRIC_MAPPINGS)) {
					const rawScore = evaluations[metricName as keyof AAModelEvaluation]
					if (rawScore == null) continue

					rankings.push({
						modelId,
						category: mapping.category,
						score: this.normalizeScore(rawScore, mapping.maxScore),
						rank: 0,
					})
				}
			}
		} catch (err) {
			console.warn("[ArtificialAnalysis] Failed to fetch rankings:", err)
		}
		return rankings
	}

	normalizeScore(score: number, maxPossible: number): number {
		return Math.max(0, Math.min(1, score / maxPossible))
	}
}

// =============================================================================
// ИСТОЧНИК 3: LMSYS CHATBOT ARENA
// =============================================================================

interface LMSYSModelEntry {
	rank: number
	model: string
	vendor?: string
	score: number | null
	ci?: number | null
	votes?: number | null
}

interface LMSYSLeaderboardResponse {
	meta: { leaderboard: string; fetched_at: string; model_count: number }
	models: LMSYSModelEntry[]
}

const LMSYS_CATEGORIES = [
	{ name: "text", taskType: "general" as TaskType },
	{ name: "code", taskType: "code" as TaskType },
	{ name: "math", taskType: "reasoning" as TaskType },
]

function normalizeLMSYSModelName(name: string): string {
	return name
		.toLowerCase()
		.replace(/\s*\([^)]*\)\s*/g, "")
		.replace(/[^a-z0-9\s-]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "")
}

export class LMSYSBenchmarkSource implements BenchmarkSource {
	readonly name = "lmsys"
	private readonly baseUrl = "https://api.wulong.dev/arena-ai-leaderboards/v1"

	async fetchRankings(): Promise<ModelRanking[]> {
		const rankings: ModelRanking[] = []

		for (const category of LMSYS_CATEGORIES) {
			try {
				const response = await fetch(`${this.baseUrl}/leaderboard?name=${category.name}`)
				if (!response.ok) continue

				const data: LMSYSLeaderboardResponse = await response.json()
				if (!data.models || !Array.isArray(data.models)) continue

				const eloScores = data.models.map((m) => m.score).filter((s): s is number => s != null)
				if (eloScores.length === 0) continue

				const maxElo = Math.max(...eloScores)
				const minElo = Math.min(...eloScores)
				const eloRange = maxElo - minElo || 1

				for (const model of data.models) {
					if (model.score == null) continue
					rankings.push({
						modelId: normalizeLMSYSModelName(model.model),
						category: category.taskType,
						score: this.normalizeScore(model.score - minElo, eloRange),
						rank: model.rank,
					})
				}
			} catch (err) {
				console.warn(`[LMSYS] Failed to fetch category "${category.name}":`, err)
			}
		}
		return rankings
	}

	normalizeScore(score: number, maxPossible: number): number {
		return Math.max(0, Math.min(1, score / maxPossible))
	}
}

// =============================================================================
// ИСТОЧНИК 4: OPENLLM LEADERBOARD (заглушка)
// =============================================================================

export class OpenLLMBenchmarkSource implements BenchmarkSource {
	readonly name = "openllm"

	async fetchRankings(): Promise<ModelRanking[]> {
		return []
	}

	normalizeScore(score: number, maxPossible: number): number {
		return Math.max(0, Math.min(1, score / maxPossible))
	}
}

// =============================================================================
// ФАБРИКА
// =============================================================================

export function createBenchmarkSources(
	openRouterFetchFn: () => Promise<Record<string, Record<string, number>>>,
	aaApiKey?: string,
): BenchmarkSource[] {
	return [
		new OpenRouterBenchmarkSource(openRouterFetchFn),
		new ArtificialAnalysisBenchmarkSource(aaApiKey),
		new LMSYSBenchmarkSource(),
		new OpenLLMBenchmarkSource(),
	]
}
