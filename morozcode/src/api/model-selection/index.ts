/**
 * Dynamic Model Selection
 *
 * Exports for the dynamic model selection system.
 */

// Types
export type {
	ModelSelectionConfig,
	ModelInfo,
	TaskType,
	AccuracyLevel,
	ComplexityLevel,
	PromptAnalysis,
	ModelSelectionResult,
	BenchmarkWeights,
	ModelRanking,
	BenchmarkSourceStats,
} from "./types"

export { DEFAULT_BENCHMARK_WEIGHTS } from "./types"

// Benchmark sources
export type { BenchmarkSource } from "./benchmark-sources"
export {
	OpenRouterBenchmarkSource,
	ArtificialAnalysisBenchmarkSource,
	LMSYSBenchmarkSource,
	OpenLLMBenchmarkSource,
	createBenchmarkSources,
} from "./benchmark-sources"

// Benchmark aggregator
export { BenchmarkAggregator, DEFAULT_CACHE_TTL_MS } from "./benchmark-aggregator"
export type { AggregatedModelScore } from "./benchmark-aggregator"

// Model registry
export { ModelRegistry } from "./model-registry"

// Prompt analyzer
export { PromptAnalyzer } from "./prompt-analyzer"
export type { CDI, ModelAwareAnalysis } from "./prompt-analyzer"

// Prompt adapter
export { PromptAdapter } from "./prompt-adapter"
export type { PromptAdaptationResult } from "./prompt-adapter"

// Dynamic model selector
export { DynamicModelSelector, ModelOverloadError } from "./dynamic-model-selector"
