/**
 * Dynamic Model Selection — Types
 *
 * Types for the dynamic model selection system that picks the most
 * efficient LLM for prompt enrichment before API calls.
 */

/**
 * Task types supported by the model selection system.
 */
export type TaskType = "tagging" | "summarization" | "translation" | "code" | "reasoning" | "general"

/**
 * Accuracy levels for model classification.
 */
export type AccuracyLevel = "low" | "medium" | "high"

/**
 * Complexity levels for task classification.
 */
export type ComplexityLevel = "simple" | "moderate" | "complex"

/**
 * Model information for the selection registry.
 */
export interface ModelInfo {
	/** Model identifier (e.g., "claude-sonnet-4-20250514") */
	modelId: string
	/** Human-readable model name */
	name: string
	/** Maximum context window in tokens */
	maxTokens: number
	/** Cost per input token */
	costPerTokenInput: number
	/** Cost per output token */
	costPerTokenOutput: number
	/** Accuracy level for classification tasks */
	accuracyLevel: AccuracyLevel
	/** Complexity handling capability */
	complexityHandling: ComplexityLevel
	/** Task types this model is suitable for */
	taskTypeSuitability: TaskType[]
	/** API endpoint or provider identifier */
	apiEndpoint: string
	/** Whether the model is currently available */
	available: boolean
	/** Category rankings from benchmarks (taskType -> rank 1-200) */
	categoryRankings?: Partial<Record<TaskType, number>>
}

/**
 * Configuration for the dynamic model selection system.
 */
export interface ModelSelectionConfig {
	/** Whether dynamic model selection is enabled */
	enabled: boolean
	/** Minimum accuracy level required */
	minAccuracy: AccuracyLevel
	/** Maximum cost per token (input + output) */
	maxCostPerToken: number
	/** Preferred task types for the current session */
	preferredTaskTypes: TaskType[]
	/** Category rankings from OpenRouter (taskType -> modelId -> rank) */
	categoryRankings?: Record<string, Record<string, number>>
	/** Whether to allow prompt adaptation (shrink) when no model fits */
	allowPromptAdaptation: boolean
	/** Fallback model ID if no suitable model found */
	fallbackModelId?: string
}

/**
 * Result of prompt analysis.
 */
export interface PromptAnalysis {
	/** Detected task type */
	taskType: TaskType
	/** Estimated complexity */
	complexity: ComplexityLevel
	/** Estimated token count */
	estimatedTokens: number
	/** Required accuracy level */
	requiredAccuracy: AccuracyLevel
	/** Detected language (ISO 639-1) */
	language?: string
}

/**
 * Result of model selection.
 */
export interface ModelSelectionResult {
	/** Selected model info */
	model: ModelInfo
	/** Whether the prompt was adapted (shrunk) */
	promptAdapted: boolean
	/** Original prompt token count (before adaptation) */
	originalTokens?: number
	/** Adapted prompt token count (after adaptation) */
	adaptedTokens?: number
	/** Selection reason for logging */
	selectionReason: string
}

/**
 * Benchmark weight configuration.
 */
export interface BenchmarkWeights {
	/** Weight for OpenRouter rankings (0-1) */
	openRouter: number
	/** Weight for Artificial Analysis rankings (0-1) */
	artificialAnalysis: number
	/** Weight for LMSYS Arena rankings (0-1) */
	lmsys: number
	/** Weight for OpenLLM rankings (0-1) */
	openllm: number
}

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
 * Model ranking from a benchmark source.
 */
export interface ModelRanking {
	/** Model identifier */
	modelId: string
	/** Category/task type */
	category: string
	/** Normalized score (0-100) */
	score: number
	/** Rank position (1-200) */
	rank: number
}

/**
 * Benchmark source statistics.
 */
export interface BenchmarkSourceStats {
	/** Number of entries fetched */
	entriesCount: number
	/** Whether the fetch was successful */
	success: boolean
	/** Error message if failed */
	error?: string
}
