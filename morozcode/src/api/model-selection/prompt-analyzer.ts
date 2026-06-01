/**
 * Dynamic Model Selection — Prompt Analyzer
 *
 * Analyzes prompts to determine task type, complexity,
 * and required accuracy for model selection.
 */

import type { PromptAnalysis, TaskType, ComplexityLevel, AccuracyLevel, ModelInfo } from "./types"

/**
 * Context Dependency Index (CDI) — measures how much a task
 * depends on conversation context vs. standalone prompt.
 *
 * CDI = 0.0 — fully standalone (e.g., tagging)
 * CDI = 1.0 — fully context-dependent (e.g., summarization)
 */
export type CDI = number

/**
 * Result of model-aware prompt analysis.
 */
export interface ModelAwareAnalysis extends PromptAnalysis {
	/** Context Dependency Index (0-1) */
	cdi: CDI
	/** Effective context limit considering CDI */
	effectiveContextLimit: number
	/** Whether the prompt needs shrinking for available models */
	needsShrinking: boolean
	/** Recommended shrink ratio (0-1, where 1 = no shrink) */
	recommendedShrinkRatio: number
}

/**
 * Prompt analyzer for dynamic model selection.
 */
export class PromptAnalyzer {
	/**
	 * Analyze a prompt to determine its characteristics.
	 * Basic analysis without model awareness.
	 */
	analyze(prompt: string, contextMessages?: string[]): PromptAnalysis {
		const taskType = this.detectTaskType(prompt)
		const complexity = this.detectComplexity(prompt)
		const estimatedTokens = this.estimateTokens(prompt, contextMessages)
		const requiredAccuracy = this.determineRequiredAccuracy(taskType, complexity)

		return {
			taskType,
			complexity,
			estimatedTokens,
			requiredAccuracy,
		}
	}

	/**
	 * Analyze a prompt with model awareness.
	 * Includes CDI calculation and effective context limit.
	 */
	analyzeWithModelAwareness(
		prompt: string,
		availableModels: ModelInfo[],
		contextMessages?: string[]
	): ModelAwareAnalysis {
		const baseAnalysis = this.analyze(prompt, contextMessages)
		const cdi = this.calculateCDI(prompt, contextMessages)
		const maxContextLimit = Math.max(...availableModels.map((m) => m.maxTokens), 0)
		const effectiveContextLimit = Math.floor(maxContextLimit * (1 - cdi * 0.5))

		const needsShrinking = baseAnalysis.estimatedTokens > effectiveContextLimit
		const recommendedShrinkRatio = needsShrinking
			? Math.max(0.3, effectiveContextLimit / baseAnalysis.estimatedTokens)
			: 1.0

		return {
			...baseAnalysis,
			cdi,
			effectiveContextLimit,
			needsShrinking,
			recommendedShrinkRatio,
		}
	}

	/**
	 * Detect the task type from prompt content.
	 */
	private detectTaskType(prompt: string): TaskType {
		const lower = prompt.toLowerCase()

		// Code-related keywords
		if (
			/\b(code|function|class|method|variable|debug|refactor|implement|typescript|javascript|python)\b/i.test(lower)
		) {
			return "code"
		}

		// Translation keywords
		if (/\b(translate|translation|перевод|traduire|übersetzen)\b/i.test(lower)) {
			return "translation"
		}

		// Summarization keywords
		if (/\b(summarize|summary|summary|резюме|résumé|zusammenfassung)\b/i.test(lower)) {
			return "summarization"
		}

		// Tagging keywords
		if (/\b(tag|label|classify|categorize|тег|метка|taggen)\b/i.test(lower)) {
			return "tagging"
		}

		// Reasoning keywords
		if (/\b(reason|analyze|explain|why|how|prove|доказать|analysieren)\b/i.test(lower)) {
			return "reasoning"
		}

		return "general"
	}

	/**
	 * Detect prompt complexity.
	 */
	private detectComplexity(prompt: string): ComplexityLevel {
		const wordCount = prompt.split(/\s+/).length
		const sentenceCount = prompt.split(/[.!?]+/).filter((s) => s.trim().length > 0).length

		// Simple: short, single sentence
		if (wordCount < 50 && sentenceCount <= 2) {
			return "simple"
		}

		// Complex: long, multiple sentences, or contains code blocks
		if (wordCount > 200 || sentenceCount > 10 || /```[\s\S]*```/.test(prompt)) {
			return "complex"
		}

		return "moderate"
	}

	/**
	 * Estimate token count for prompt + context.
	 */
	private estimateTokens(prompt: string, contextMessages?: string[]): number {
		// Rough estimation: ~4 chars per token for English, ~3 for Cyrillic
		const promptTokens = Math.ceil(prompt.length / 4)

		if (!contextMessages || contextMessages.length === 0) {
			return promptTokens
		}

		const contextTokens = contextMessages.reduce(
			(sum, msg) => sum + Math.ceil(msg.length / 4),
			0
		)

		return promptTokens + contextTokens
	}

	/**
	 * Determine required accuracy level based on task type and complexity.
	 */
	private determineRequiredAccuracy(taskType: TaskType, complexity: ComplexityLevel): AccuracyLevel {
		// Code and reasoning tasks require high accuracy
		if (taskType === "code" || taskType === "reasoning") {
			return "high"
		}

		// Complex tasks require at least medium accuracy
		if (complexity === "complex") {
			return "medium"
		}

		// Simple tasks can use low accuracy
		if (complexity === "simple") {
			return "low"
		}

		return "medium"
	}

	/**
	 * Calculate Context Dependency Index (CDI).
	 * Measures how much the task depends on conversation context.
	 */
	private calculateCDI(prompt: string, contextMessages?: string[]): CDI {
		if (!contextMessages || contextMessages.length === 0) {
			return 0.0
		}

		const lower = prompt.toLowerCase()
		let cdi = 0.0

		// Check for context-dependent keywords
		const contextKeywords = [
			"previous",
			"above",
			"earlier",
			"before",
			"context",
			"conversation",
			"history",
			"continue",
			"follow",
			"based on",
			"earlier we",
			"as mentioned",
			"as discussed",
		]

		for (const keyword of contextKeywords) {
			if (lower.includes(keyword)) {
				cdi += 0.2
			}
		}

		// Check for pronouns that refer to previous context
		const pronouns = ["it", "this", "that", "these", "those", "they", "them"]
		for (const pronoun of pronouns) {
			if (new RegExp(`\\b${pronoun}\\b`, "i").test(lower)) {
				cdi += 0.1
			}
		}

		// Summarization and tagging are highly context-dependent
		if (/\b(summarize|summary|tag|label|classify)\b/i.test(lower)) {
			cdi += 0.3
		}

		return Math.min(1.0, cdi)
	}
}
