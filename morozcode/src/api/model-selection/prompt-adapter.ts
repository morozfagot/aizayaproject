/**
 * Dynamic Model Selection — Prompt Adapter
 *
 * Adapts prompts to fit within model context limits
 * by shrinking or summarizing content.
 */

import type { PromptAnalysis } from "./types"

/**
 * Result of prompt adaptation.
 */
export interface PromptAdaptationResult {
	/** Adapted prompt text */
	adaptedPrompt: string
	/** Whether the prompt was modified */
	wasAdapted: boolean
	/** Original token count */
	originalTokens: number
	/** Adapted token count */
	adaptedTokens: number
	/** Adaptation method used */
	method: "none" | "truncate" | "summarize" | "remove-examples"
}

/**
 * Prompt adapter for fitting prompts into model context limits.
 */
export class PromptAdapter {
	/**
	 * Adapt a prompt to fit within the specified token limit.
	 * Returns the original prompt if it already fits.
	 */
	adapt(
		prompt: string,
		analysis: PromptAnalysis,
		maxTokens: number
	): PromptAdaptationResult {
		const originalTokens = analysis.estimatedTokens

		// No adaptation needed
		if (originalTokens <= maxTokens) {
			return {
				adaptedPrompt: prompt,
				wasAdapted: false,
				originalTokens,
				adaptedTokens: originalTokens,
				method: "none",
			}
		}

		const ratio = maxTokens / originalTokens

		// Try different adaptation methods based on how much we need to shrink
		if (ratio >= 0.7) {
			// Light shrink: remove examples
			return this.removeExamples(prompt, originalTokens, maxTokens)
		} else if (ratio >= 0.4) {
			// Medium shrink: summarize
			return this.summarize(prompt, originalTokens, maxTokens)
		} else {
			// Heavy shrink: truncate
			return this.truncate(prompt, originalTokens, maxTokens)
		}
	}

	/**
	 * Truncate prompt to fit within token limit.
	 * Tries to preserve complete sentences.
	 */
	private truncate(
		prompt: string,
		originalTokens: number,
		maxTokens: number
	): PromptAdaptationResult {
		// Estimate characters per token
		const charsPerToken = prompt.length / originalTokens
		const maxChars = Math.floor(maxTokens * charsPerToken * 0.9) // 10% safety margin

		let truncated = prompt.substring(0, maxChars)

		// Try to end at a sentence boundary
		const lastSentenceEnd = Math.max(
			truncated.lastIndexOf("."),
			truncated.lastIndexOf("!"),
			truncated.lastIndexOf("?"),
			truncated.lastIndexOf("\n")
		)

		if (lastSentenceEnd > maxChars * 0.5) {
			truncated = truncated.substring(0, lastSentenceEnd + 1)
		}

		truncated += "\n\n[Note: Prompt was truncated to fit context limit]"

		return {
			adaptedPrompt: truncated,
			wasAdapted: true,
			originalTokens,
			adaptedTokens: Math.ceil(truncated.length / charsPerToken),
			method: "truncate",
		}
	}

	/**
	 * Summarize prompt by keeping key sections.
	 * Preserves the first and last parts, summarizes the middle.
	 */
	private summarize(
		prompt: string,
		originalTokens: number,
		maxTokens: number
	): PromptAdaptationResult {
		const charsPerToken = prompt.length / originalTokens
		const maxChars = Math.floor(maxTokens * charsPerToken * 0.9)

		// Split into paragraphs
		const paragraphs = prompt.split(/\n\n+/)

		if (paragraphs.length <= 2) {
			// Not enough paragraphs to summarize, fall back to truncate
			return this.truncate(prompt, originalTokens, maxTokens)
		}

		// Keep first and last paragraphs, summarize middle
		const firstParagraph = paragraphs[0] ?? ""
		const lastParagraph = paragraphs[paragraphs.length - 1] ?? ""
		const middleParagraphs = paragraphs.slice(1, -1)

		// Calculate how much space we have for middle summary
		const reservedChars = firstParagraph.length + lastParagraph.length + 100 // 100 for separators
		const availableChars = maxChars - reservedChars

		if (availableChars <= 0) {
			return this.truncate(prompt, originalTokens, maxTokens)
		}

		// Create summary of middle paragraphs
		const middleSummary = this.summarizeParagraphs(middleParagraphs, availableChars)

		const summarized = [
			firstParagraph,
			"\n[... middle content summarized ...]",
			middleSummary,
			"\n[... continued ...]",
			lastParagraph,
		].join("\n\n")

		return {
			adaptedPrompt: summarized,
			wasAdapted: true,
			originalTokens,
			adaptedTokens: Math.ceil(summarized.length / charsPerToken),
			method: "summarize",
		}
	}

	/**
	 * Remove example sections from prompt.
	 * Looks for common example patterns.
	 */
	private removeExamples(
		prompt: string,
		originalTokens: number,
		maxTokens: number
	): PromptAdaptationResult {
		const charsPerToken = prompt.length / originalTokens
		const maxChars = Math.floor(maxTokens * charsPerToken * 0.95)

		// Common example section patterns
		const examplePatterns = [
			/## Examples?[\s\S]*?(?=##|$)/gi,
			/### Examples?[\s\S]*?(?=###|$)/gi,
			/Examples?:[\s\S]*?(?=\n\n##|\n\n###|$)/gi,
			/For example[\s\S]*?(\n\n|$)/gi,
			/Sample (input|output|response)[\s\S]*?(\n\n|$)/gi,
		]

		let cleaned = prompt
		let removedChars = 0

		for (const pattern of examplePatterns) {
			const match = cleaned.match(pattern)
			if (match) {
				removedChars += match[0].length
				cleaned = cleaned.replace(pattern, "")
			}
		}

		// If we removed enough, return the cleaned prompt
		if (prompt.length - removedChars <= maxChars) {
			cleaned += "\n\n[Note: Examples were removed to fit context limit]"

			return {
				adaptedPrompt: cleaned,
				wasAdapted: true,
				originalTokens,
				adaptedTokens: Math.ceil(cleaned.length / charsPerToken),
				method: "remove-examples",
			}
		}

		// Not enough removed, fall back to summarize
		return this.summarize(prompt, originalTokens, maxTokens)
	}

	/**
	 * Summarize multiple paragraphs into a shorter text.
	 */
	private summarizeParagraphs(paragraphs: string[], maxChars: number): string {
		// Take first sentence from each paragraph
		const sentences = paragraphs
			.map((p) => {
				const firstSentence = p.split(/[.!?]/)[0] ?? ""
				return firstSentence.trim()
			})
			.filter((s) => s.length > 0)

		let summary = ""
		for (const sentence of sentences) {
			if (summary.length + sentence.length + 2 > maxChars) {
				break
			}
			summary += (summary ? ". " : "") + sentence
		}

		return summary || "[Content summarized]"
	}
}
