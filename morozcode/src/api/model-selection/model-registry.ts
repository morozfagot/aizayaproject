import { type ModelInfo } from "@roo-code/types"
import { getOpenRouterModels } from "../providers/fetchers/openrouter"
import type { ApiHandlerOptions } from "../../shared/api"
import { type ModelSelectionConfig, type ComplexityLevel, type TaskType } from "./types"

const RANKING_CATEGORY_TO_TASK_TYPE: Record<string, TaskType> = {
	"programming": "code",
	"reasoning": "reasoning",
	"translation": "translation",
	"summarization": "summarization",
	"general": "general",
}

interface OpenRouterRankingEntry {
	id: string
	rank: number
	category: string
}

async function fetchOpenRouterRankings(): Promise<Record<string, Record<string, number>>> {
	const rankings: Record<string, Record<string, number>> = {}

	try {
		const response = await fetch("https://openrouter.ai/api/v1/rankings", {
			headers: { "Content-Type": "application/json" },
		})

		if (!response.ok) {
			console.warn("[ModelRegistry] OpenRouter rankings API unavailable, using fallback")
			return rankings
		}

		const data = await response.json()
		const entries: OpenRouterRankingEntry[] = data?.data ?? data?.rankings ?? []

		for (const entry of entries) {
			if (!entry?.id || entry.rank == null) continue

			const modelId = entry.id.toLowerCase()
			const category = entry.category?.toLowerCase() ?? "general"
			const taskType = RANKING_CATEGORY_TO_TASK_TYPE[category] ?? "general"

			if (!rankings[modelId]) {
				rankings[modelId] = {}
			}
			rankings[modelId][taskType] = entry.rank
		}
	} catch (err) {
		console.warn("[ModelRegistry] Failed to fetch OpenRouter rankings:", err)
	}

	return rankings
}

function getModelCapabilities(modelId: string): Pick<
	ModelSelectionConfig,
	"accuracyLevel" | "complexityHandling" | "taskTypeSuitability"
> {
	const id = modelId.toLowerCase()

	if (
		id.includes("claude-opus") ||
		id.includes("gpt-4.5") ||
		id.includes("o3") ||
		id.includes("o1") ||
		id.includes("deepseek-r1") ||
		id.includes("gemini-2.5-pro")
	) {
		return {
			accuracyLevel: "very_high",
			complexityHandling: "very_high",
			taskTypeSuitability: ["reasoning", "code", "translation", "summarization", "tagging", "general"],
		}
	}

	if (
		id.includes("claude-sonnet") ||
		id.includes("gpt-4o") ||
		id.includes("gemini-2.0-pro") ||
		id.includes("gemini-1.5-pro") ||
		id.includes("deepseek-v3") ||
		id.includes("qwen-qwq") ||
		id.includes("llama-3.1-405b") ||
		id.includes("llama-4-maverick")
	) {
		return {
			accuracyLevel: "high",
			complexityHandling: "high",
			taskTypeSuitability: ["code", "reasoning", "translation", "summarization", "tagging", "general"],
		}
	}

	if (
		id.includes("claude-haiku") ||
		id.includes("gpt-4o-mini") ||
		id.includes("gemini-2.0-flash") ||
		id.includes("gemini-1.5-flash") ||
		id.includes("deepseek-chat") ||
		id.includes("llama-3.1-70b") ||
		id.includes("llama-3.1-8b") ||
		id.includes("llama-4-scout")
	) {
		return {
			accuracyLevel: "medium",
			complexityHandling: "medium",
			taskTypeSuitability: ["general", "summarization", "tagging", "translation"],
		}
	}

	return {
		accuracyLevel: "low",
		complexityHandling: "low",
		taskTypeSuitability: ["general", "tagging", "summarization"],
	}
}

function calculateEffectiveContextLimit(
	contextWindow: number,
	accuracyLevel: ComplexityLevel,
): number {
	const cdi: Record<ComplexityLevel, number> = {
		very_high: 0.95,
		high: 0.85,
		medium: 0.70,
		low: 0.50,
	}

	return Math.floor(contextWindow * (cdi[accuracyLevel] ?? 0.70))
}

function modelInfoToSelectionConfig(
	id: string,
	info: ModelInfo,
	rankings?: Record<string, Record<string, number>>,
): ModelSelectionConfig {
	const categoryRankings = rankings?.[id.toLowerCase()]
	const contextWindow = info.contextWindow ?? 8192

	if (categoryRankings && Object.keys(categoryRankings).length > 0) {
		const bestRank = Math.min(...Object.values(categoryRankings))
		let accuracyLevel: ComplexityLevel
		let complexityHandling: ComplexityLevel

		if (bestRank <= 10) {
			accuracyLevel = "very_high"
			complexityHandling = "very_high"
		} else if (bestRank <= 30) {
			accuracyLevel = "high"
			complexityHandling = "high"
		} else if (bestRank <= 100) {
			accuracyLevel = "medium"
			complexityHandling = "medium"
		} else {
			accuracyLevel = "low"
			complexityHandling = "low"
		}

		const taskTypeSuitability = Object.keys(categoryRankings) as TaskType[]

		return {
			id,
			apiProvider: "openrouter",
			apiEndpoint: undefined,
			maxTokens: info.maxTokens ?? 4096,
			contextWindow,
			inputPrice: info.inputPrice ?? 0,
			outputPrice: info.outputPrice ?? 0,
			accuracyLevel,
			complexityHandling,
			taskTypeSuitability,
			availability: true,
			categoryRankings,
			effectiveContextLimit: calculateEffectiveContextLimit(contextWindow, accuracyLevel),
		}
	}

	const capabilities = getModelCapabilities(id)

	return {
		id,
		apiProvider: "openrouter",
		apiEndpoint: undefined,
		maxTokens: info.maxTokens ?? 4096,
		contextWindow,
		inputPrice: info.inputPrice ?? 0,
		outputPrice: info.outputPrice ?? 0,
		accuracyLevel: capabilities.accuracyLevel,
		complexityHandling: capabilities.complexityHandling,
		taskTypeSuitability: capabilities.taskTypeSuitability,
		availability: true,
		categoryRankings: undefined,
		effectiveContextLimit: calculateEffectiveContextLimit(contextWindow, capabilities.accuracyLevel),
	}
}

export class ModelRegistry {
	private cache: ModelSelectionConfig[] | undefined
	private cacheTimestamp = 0
	private readonly ttlMs: number
	private rankingsCache: Record<string, Record<string, number>> | undefined
	private rankingsCacheTimestamp = 0

	constructor(ttlMs = 5 * 60 * 1000) {
		this.ttlMs = ttlMs
	}

	async getAvailableModels(options?: ApiHandlerOptions): Promise<ModelSelectionConfig[]> {
		const now = Date.now()
		if (this.cache && now - this.cacheTimestamp < this.ttlMs) {
			return this.cache
		}

		const openRouterModels = await getOpenRouterModels(options)

		if (!this.rankingsCache || now - this.rankingsCacheTimestamp > this.ttlMs * 2) {
			this.rankingsCache = await fetchOpenRouterRankings()
			this.rankingsCacheTimestamp = now
		}

		const configs: ModelSelectionConfig[] = []

		for (const [id, info] of Object.entries(openRouterModels)) {
			configs.push(modelInfoToSelectionConfig(id, info as ModelInfo, this.rankingsCache))
		}

		this.cache = configs
		this.cacheTimestamp = now
		return configs
	}

	async refresh(options?: ApiHandlerOptions): Promise<ModelSelectionConfig[]> {
		this.cache = undefined
		return this.getAvailableModels(options)
	}

	clearCache(): void {
		this.cache = undefined
		this.cacheTimestamp = 0
	}
}

export function complexityGte(a: ComplexityLevel, b: ComplexityLevel): boolean {
	const order: Record<ComplexityLevel, number> = {
		low: 0,
		medium: 1,
		high: 2,
		very_high: 3,
	}
	return order[a] >= order[b]
}
