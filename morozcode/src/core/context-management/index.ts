import { Anthropic } from "@anthropic-ai/sdk"
import crypto from "crypto"

import { TelemetryService } from "@roo-code/telemetry"

import { ApiHandler, ApiHandlerCreateMessageMetadata } from "../../api"
import { MAX_CONDENSE_THRESHOLD, MIN_CONDENSE_THRESHOLD, summarizeConversation, SummarizeResponse } from "../condense"
import { ApiMessage, RelevanceTags } from "../task-persistence/apiMessages"
import { ANTHROPIC_DEFAULT_MAX_TOKENS } from "@roo-code/types"
import { RooIgnoreController } from "../ignore/RooIgnoreController"
import { trimContextByRelevance, estimateMessagesTokenCount } from "../../api/model-selection/prompt-adapter"

/**
 * Context Management
 *
 * This module provides Context Management for conversations, combining:
 * - Intelligent condensation of prior messages when approaching configured thresholds
 * - Relevance-based truncation (2.9.4.1) — removes least relevant messages by tag score
 * - Sliding window truncation as a last resort fallback
 *
 * Behavior and exports are preserved exactly from the previous sliding-window implementation.
 */

/**
 * Default percentage of the context window to use as a buffer when deciding when to truncate.
 * Used by Context Management to determine when to trigger condensation or (fallback) sliding window truncation.
 */
export const TOKEN_BUFFER_PERCENTAGE = 0.1

/**
 * Counts tokens for user content using the provider's token counting implementation.
 *
 * @param {Array<Anthropic.Messages.ContentBlockParam>} content - The content to count tokens for
 * @param {ApiHandler} apiHandler - The API handler to use for token counting
 * @returns {Promise<number>} A promise resolving to the token count
 */
export async function estimateTokenCount(
	content: Array<Anthropic.Messages.ContentBlockParam>,
	apiHandler: ApiHandler,
): Promise<number> {
	if (!content || content.length === 0) return 0
	return apiHandler.countTokens(content)
}

/**
 * Result of truncation operation, includes the truncation ID for UI events.
 */
export type TruncationResult = {
	messages: ApiMessage[]
	truncationId: string
	messagesRemoved: number
}

/**
 * Truncates a conversation by tagging messages as hidden instead of removing them.
 *
 * The first message is always retained, and a specified fraction (rounded to an even number)
 * of messages from the beginning (excluding the first) is tagged with truncationParent.
 * A truncation marker is inserted to track where truncation occurred.
 *
 * This implements non-destructive sliding window truncation, allowing messages to be
 * restored if the user rewinds past the truncation point.
 *
 * @param {ApiMessage[]} messages - The conversation messages.
 * @param {number} fracToRemove - The fraction (between 0 and 1) of messages (excluding the first) to hide.
 * @param {string} taskId - The task ID for the conversation, used for telemetry
 * @returns {TruncationResult} Object containing the tagged messages, truncation ID, and count of messages removed.
 */
export function truncateConversation(messages: ApiMessage[], fracToRemove: number, taskId: string): TruncationResult {
	TelemetryService.instance.captureSlidingWindowTruncation(taskId)

	const truncationId = crypto.randomUUID()

	// Filter to only visible messages (those not already truncated)
	// We need to track original indices to correctly tag messages in the full array
	const visibleIndices: number[] = []
	messages.forEach((msg, index) => {
		if (!msg.truncationParent && !msg.isTruncationMarker) {
			visibleIndices.push(index)
		}
	})

	// Calculate how many visible messages to truncate (excluding first visible message)
	const visibleCount = visibleIndices.length
	const rawMessagesToRemove = Math.floor((visibleCount - 1) * fracToRemove)
	const messagesToRemove = rawMessagesToRemove - (rawMessagesToRemove % 2)

	if (messagesToRemove <= 0) {
		// Nothing to truncate
		return {
			messages,
			truncationId,
			messagesRemoved: 0,
		}
	}

	// Get the indices of visible messages to truncate (skip first visible, take next N)
	const indicesToTruncate = new Set(visibleIndices.slice(1, messagesToRemove + 1))

	// Tag messages that are being "truncated" (hidden from API calls)
	const taggedMessages = messages.map((msg, index) => {
		if (indicesToTruncate.has(index)) {
			return { ...msg, truncationParent: truncationId }
		}
		return msg
	})

	// Find the actual boundary - the index right after the last truncated message
	const lastTruncatedVisibleIndex = visibleIndices[messagesToRemove] // Last visible message being truncated
	// If all visible messages except the first are truncated, insert marker at the end
	const firstKeptVisibleIndex = visibleIndices[messagesToRemove + 1] ?? taggedMessages.length

	// Insert truncation marker at the actual boundary (between last truncated and first kept)
	const firstKeptTs = messages[firstKeptVisibleIndex]?.ts ?? Date.now()
	const truncationMarker: ApiMessage = {
		role: "user",
		content: `[Sliding window truncation: ${messagesToRemove} messages hidden to reduce context]`,
		ts: firstKeptTs - 1,
		isTruncationMarker: true,
		truncationId,
	}

	// Insert marker at the boundary position
	// Find where to insert: right before the first kept visible message
	const insertPosition = firstKeptVisibleIndex
	const result = [
		...taggedMessages.slice(0, insertPosition),
		truncationMarker,
		...taggedMessages.slice(insertPosition),
	]

	return {
		messages: result,
		truncationId,
		messagesRemoved: messagesToRemove,
	}
}

/**
 * Truncates a conversation by relevance score (Context Trimming by Relevance, component 2.9.4.1).
 *
 * Uses tag-based relevance scoring to remove the least relevant messages while preserving:
 * - Protected messages (system prompt, first N messages)
 * - Recent messages (last N, for conversational continuity)
 * - Most relevant messages (highest tag overlap score)
 *
 * This is a purely mathematical operation — no LLM calls.
 *
 * @param {ApiMessage[]} messages - The conversation messages.
 * @param {RelevanceTags} promptTags - Tags of the current prompt for relevance comparison.
 * @param {number} allowedTokens - Maximum tokens allowed for the conversation history.
 * @param {string} taskId - The task ID for the conversation, used for telemetry.
 * @returns {TruncationResult} Object containing the filtered messages, truncation ID, and count of messages removed.
 */
export function truncateConversationByRelevance(
	messages: ApiMessage[],
	promptTags: RelevanceTags,
	allowedTokens: number,
	taskId: string,
): TruncationResult {
	TelemetryService.instance.captureSlidingWindowTruncation(taskId)

	const truncationId = crypto.randomUUID()

	// Filter to only visible messages (those not already truncated)
	const visibleMessages: ApiMessage[] = []
	messages.forEach((msg) => {
		if (!msg.truncationParent && !msg.isTruncationMarker) {
			visibleMessages.push(msg)
		}
	})

	// If no prompt tags — relevance trimming is not possible, return as-is
	if (!promptTags.direct || promptTags.direct.length === 0) {
		return {
			messages,
			truncationId,
			messagesRemoved: 0,
		}
	}

	// Use trimContextByRelevance to get the filtered set of visible messages
	const trimmedVisible = trimContextByRelevance(visibleMessages, {
		targetTokens: allowedTokens,
		promptTags,
		preserveLastN: 3,
		protectedIndices: new Set([0, 1]), // Protect first 2 visible messages
	})

	const messagesRemoved = visibleMessages.length - trimmedVisible.length

	if (messagesRemoved <= 0) {
		return {
			messages,
			truncationId,
			messagesRemoved: 0,
		}
	}

	// Build a set of trimmed message references for quick lookup
	const trimmedSet = new Set(trimmedVisible)

	// Map back to original messages array, tagging removed ones
	const result: ApiMessage[] = []
	let markerInserted = false

	for (let i = 0; i < messages.length; i++) {
		const msg = messages[i]
		// Skip undefined entries (noUncheckedIndexedAccess) and already-truncated messages
		if (!msg || msg.truncationParent || msg.isTruncationMarker) {
			continue
		}

		if (trimmedSet.has(msg)) {
			result.push(msg)
		} else {
			// Tag as truncated
			if (!markerInserted) {
				// Insert relevance truncation marker before the first kept message after removals
				const marker: ApiMessage = {
					role: "user",
					content: `[Relevance truncation: ${messagesRemoved} messages removed by tag score to reduce context]`,
					ts: msg.ts ? msg.ts - 1 : Date.now(),
					isTruncationMarker: true,
					truncationId,
				}
				result.push(marker)
				markerInserted = true
			}
			result.push({ ...msg, truncationParent: truncationId })
		}
	}

	return {
		messages: result,
		truncationId,
		messagesRemoved,
	}
}

/**
 * Options for checking if context management will likely run.
 * A subset of ContextManagementOptions with only the fields needed for threshold calculation.
 */
export type WillManageContextOptions = {
	totalTokens: number
	contextWindow: number
	maxTokens?: number | null
	autoCondenseContext: boolean
	autoCondenseContextPercent: number
	profileThresholds: Record<string, number>
	currentProfileId: string
	lastMessageTokens: number
}

/**
 * Checks whether context management (condensation or truncation) will likely run based on current token usage.
 *
 * This is useful for showing UI indicators before `manageContext` is actually called,
 * without duplicating the threshold calculation logic.
 *
 * @param {WillManageContextOptions} options - The options for threshold calculation
 * @returns {boolean} True if context management will likely run, false otherwise
 */
export function willManageContext({
	totalTokens,
	contextWindow,
	maxTokens,
	autoCondenseContext,
	autoCondenseContextPercent,
	profileThresholds,
	currentProfileId,
	lastMessageTokens,
}: WillManageContextOptions): boolean {
	if (!autoCondenseContext) {
		// When auto-condense is disabled, only truncation can occur
		const reservedTokens = maxTokens || ANTHROPIC_DEFAULT_MAX_TOKENS
		const prevContextTokens = totalTokens + lastMessageTokens
		const allowedTokens = contextWindow * (1 - TOKEN_BUFFER_PERCENTAGE) - reservedTokens
		return prevContextTokens > allowedTokens
	}

	const reservedTokens = maxTokens || ANTHROPIC_DEFAULT_MAX_TOKENS
	const prevContextTokens = totalTokens + lastMessageTokens
	const allowedTokens = contextWindow * (1 - TOKEN_BUFFER_PERCENTAGE) - reservedTokens

	// Determine the effective threshold to use
	let effectiveThreshold = autoCondenseContextPercent
	const profileThreshold = profileThresholds[currentProfileId]
	if (profileThreshold !== undefined) {
		if (profileThreshold === -1) {
			effectiveThreshold = autoCondenseContextPercent
		} else if (profileThreshold >= MIN_CONDENSE_THRESHOLD && profileThreshold <= MAX_CONDENSE_THRESHOLD) {
			effectiveThreshold = profileThreshold
		}
		// Invalid values fall back to global setting (effectiveThreshold already set)
	}

	const contextPercent = (100 * prevContextTokens) / contextWindow
	return contextPercent >= effectiveThreshold || prevContextTokens > allowedTokens
}

/**
 * Context Management: Conditionally manages the conversation context when approaching limits.
 *
 * Attempts intelligent condensation of prior messages when thresholds are reached.
 * Falls back to relevance-based truncation (2.9.4.1) if condensation is unavailable or fails.
 * Falls back to sliding window truncation as a last resort.
 *
 * @param {ContextManagementOptions} options - The options for truncation/condensation
 * @returns {Promise<ApiMessage[]>} The original, condensed, or truncated conversation messages.
 */

export type ContextManagementOptions = {
	messages: ApiMessage[]
	totalTokens: number
	contextWindow: number
	maxTokens?: number | null
	apiHandler: ApiHandler
	autoCondenseContext: boolean
	autoCondenseContextPercent: number
	systemPrompt: string
	taskId: string
	customCondensingPrompt?: string
	profileThresholds: Record<string, number>
	currentProfileId: string
	/** Optional metadata to pass through to the condensing API call (tools, taskId, etc.) */
	metadata?: ApiHandlerCreateMessageMetadata
	/** Optional environment details string to include in the condensed summary */
	environmentDetails?: string
	/** Optional array of file paths read by Roo during the task (will be folded via tree-sitter) */
	filesReadByRoo?: string[]
	/** Optional current working directory for resolving file paths (required if filesReadByRoo is provided) */
	cwd?: string
	/** Optional controller for file access validation */
	rooIgnoreController?: RooIgnoreController
	/** Optional prompt tags for relevance-based truncation (2.9.4.1). If provided, relevance trimming is attempted before sliding window. */
	promptTags?: RelevanceTags
}

export type ContextManagementResult = SummarizeResponse & {
	prevContextTokens: number
	truncationId?: string
	messagesRemoved?: number
	newContextTokensAfterTruncation?: number
}

/**
 * Conditionally manages conversation context (condense and fallback truncation).
 *
 * Truncation priority:
 * 1. Relevance-based truncation (if promptTags provided) — removes least relevant messages
 * 2. Sliding window truncation (last resort) — removes oldest messages
 *
 * @param {ContextManagementOptions} options - The options for truncation/condensation
 * @returns {Promise<ApiMessage[]>} The original, condensed, or truncated conversation messages.
 */
export async function manageContext({
	messages,
	totalTokens,
	contextWindow,
	maxTokens,
	apiHandler,
	autoCondenseContext,
	autoCondenseContextPercent,
	systemPrompt,
	taskId,
	customCondensingPrompt,
	profileThresholds,
	currentProfileId,
	metadata,
	environmentDetails,
	filesReadByRoo,
	cwd,
	rooIgnoreController,
	promptTags,
}: ContextManagementOptions): Promise<ContextManagementResult> {
	let error: string | undefined
	let errorDetails: string | undefined
	let cost = 0
	// Calculate the maximum tokens reserved for response
	const reservedTokens = maxTokens || ANTHROPIC_DEFAULT_MAX_TOKENS

	// Estimate tokens for the last message (which is always a user message)
	const lastMessage = messages[messages.length - 1]
	if (!lastMessage) {
		// Empty messages array — nothing to manage
		return { messages, summary: "", cost, prevContextTokens: totalTokens, error, errorDetails }
	}
	const lastMessageContent = lastMessage.content
	const lastMessageTokens = Array.isArray(lastMessageContent)
		? await estimateTokenCount(lastMessageContent, apiHandler)
		: await estimateTokenCount([{ type: "text", text: lastMessageContent as string }], apiHandler)

	// Calculate total effective tokens (totalTokens never includes the last message)
	const prevContextTokens = totalTokens + lastMessageTokens

	// Calculate available tokens for conversation history
	// Truncate if we're within TOKEN_BUFFER_PERCENTAGE of the context window
	const allowedTokens = contextWindow * (1 - TOKEN_BUFFER_PERCENTAGE) - reservedTokens

	// Determine the effective threshold to use
	let effectiveThreshold = autoCondenseContextPercent
	const profileThreshold = profileThresholds[currentProfileId]
	if (profileThreshold !== undefined) {
		if (profileThreshold === -1) {
			// Special case: -1 means inherit from global setting
			effectiveThreshold = autoCondenseContextPercent
		} else if (profileThreshold >= MIN_CONDENSE_THRESHOLD && profileThreshold <= MAX_CONDENSE_THRESHOLD) {
			// Valid custom threshold
			effectiveThreshold = profileThreshold
		} else {
			// Invalid threshold value, fall back to global setting
			console.warn(
				`Invalid profile threshold ${profileThreshold} for profile "${currentProfileId}". Using global default of ${autoCondenseContextPercent}%`,
			)
			effectiveThreshold = autoCondenseContextPercent
		}
	}
	// If no specific threshold is found for the profile, fall back to global setting

	if (autoCondenseContext) {
		const contextPercent = (100 * prevContextTokens) / contextWindow
		if (contextPercent >= effectiveThreshold || prevContextTokens > allowedTokens) {
			// Attempt to intelligently condense the context
			const result = await summarizeConversation({
				messages,
				apiHandler,
				systemPrompt,
				taskId,
				isAutomaticTrigger: true,
				customCondensingPrompt,
				metadata,
				environmentDetails,
				filesReadByRoo,
				cwd,
				rooIgnoreController,
			})
			if (result.error) {
				error = result.error
				errorDetails = result.errorDetails
				cost = result.cost
			} else {
				return { ...result, prevContextTokens }
			}
		}
	}

	// Fall back to truncation if needed
	if (prevContextTokens > allowedTokens) {
		// Strategy 1: Relevance-based truncation (2.9.4.1) — if prompt tags are available
		if (promptTags && promptTags.direct && promptTags.direct.length > 0) {
			const relevanceResult = truncateConversationByRelevance(
				messages,
				promptTags,
				allowedTokens,
				taskId,
			)

			// Calculate new context tokens after relevance truncation
			const effectiveMessages = relevanceResult.messages.filter(
				(msg) => !msg.truncationParent && !msg.isTruncationMarker,
			)

			// Include system prompt tokens so this value matches what we send to the API.
			let newContextTokensAfterTruncation = await estimateTokenCount(
				[{ type: "text", text: systemPrompt }],
				apiHandler,
			)

			for (const msg of effectiveMessages) {
				const content = msg.content
				if (Array.isArray(content)) {
					newContextTokensAfterTruncation += await estimateTokenCount(content, apiHandler)
				} else if (typeof content === "string") {
					newContextTokensAfterTruncation += await estimateTokenCount(
						[{ type: "text", text: content }],
						apiHandler,
					)
				}
			}

			return {
				messages: relevanceResult.messages,
				prevContextTokens,
				summary: "",
				cost,
				error,
				errorDetails,
				truncationId: relevanceResult.truncationId,
				messagesRemoved: relevanceResult.messagesRemoved,
				newContextTokensAfterTruncation,
			}
		}

		// Strategy 2: Sliding window truncation (last resort)
		const truncationResult = truncateConversation(messages, 0.5, taskId)

		// Calculate new context tokens after truncation by counting non-truncated messages
		// Messages with truncationParent are hidden, so we count only those without it
		const effectiveMessages = truncationResult.messages.filter(
			(msg) => !msg.truncationParent && !msg.isTruncationMarker,
		)

		// Include system prompt tokens so this value matches what we send to the API.
		// Note: `prevContextTokens` is computed locally here (totalTokens + lastMessageTokens).
		let newContextTokensAfterTruncation = await estimateTokenCount(
			[{ type: "text", text: systemPrompt }],
			apiHandler,
		)

		for (const msg of effectiveMessages) {
			const content = msg.content
			if (Array.isArray(content)) {
				newContextTokensAfterTruncation += await estimateTokenCount(content, apiHandler)
			} else if (typeof content === "string") {
				newContextTokensAfterTruncation += await estimateTokenCount(
					[{ type: "text", text: content }],
					apiHandler,
				)
			}
		}

		return {
			messages: truncationResult.messages,
			prevContextTokens,
			summary: "",
			cost,
			error,
			errorDetails,
			truncationId: truncationResult.truncationId,
			messagesRemoved: truncationResult.messagesRemoved,
			newContextTokensAfterTruncation,
		}
	}
	// No truncation or condensation needed
	return { messages, summary: "", cost, prevContextTokens, error, errorDetails }
}
