import { QdrantClient } from "@qdrant/js-client-rest"
import * as path from "path"
import * as vscode from "vscode"

import type { EmbedderProvider } from "@roo-code/types"
import { CodeIndexManager } from "../../services/code-index/manager"
import { OpenAICompatibleEmbedder } from "../../services/code-index/embedders/openai-compatible"
import { getModelDimension } from "../../shared/embeddingModels"

/**
 * RRR (Retrieve-Refine-Retrieve) utilities for session history vector enrichment.
 */

const SESSION_COLLECTION_PREFIX = "session_"

// ─── RRR Types ─────────────────────────────────────────────────────────────────

export interface RrrChunk {
	chunkId: string
	text: string
	score: number
	messageTs: number
}

export interface RrrDiagnostics {
	findChunksResult: string[]
	extractedTsCount: number
	reasonForEmpty?: string
	rrrDurationMs?: number
}

export interface RrrResult {
	chunks: RrrChunk[]
	relevantTs: Set<number>
	enrichedContext: boolean
	diagnostics: RrrDiagnostics
	queryText: string
}

export interface WsQuery {
	systemPrompt: string
	userPrompt: string
	rrrResult: RrrResult | null
}

/**
 * Normalize workspace path for consistent collection naming.
 * Converts to lowercase, replaces path separators and special chars with dashes.
 * Example: "C:\Users\Moroz\Desktop\AIWorkFlowContext" → "c-users-moroz-desktop-aiworkflowcontext"
 */
export function normalizeWorkspacePathForCollection(workspacePath: string): string {
	const normalized = path.normalize(workspacePath).toLowerCase()
	return normalized
		.replace(/[\\/]/g, "-")
		.replace(/[^a-z0-9-]/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "")
}

/**
 * Get API key for embedding from environment variables or VS Code config.
 * Priority: env vars > VS Code config.
 */
export function getEmbedderApiKey(): string | undefined {
	// Priority 1: Environment variables (loaded from .env by extension.ts via dotenvx)
	const envKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY
	if (envKey && envKey.trim().length > 0) {
		console.log(`[sessionQdrant] API key found in process.env (${envKey.substring(0, 8)}...)`)
		return envKey.trim()
	}

	// Priority 2: VS Code configuration (roo-code.codebaseIndex)
	try {
		const config = vscode.workspace.getConfiguration("roo-code.codebaseIndex")
		const openAiKey = config.get<string>("openAiKey")
		if (openAiKey && openAiKey.trim().length > 0) {
			console.log(`[sessionQdrant] API key found in VS Code config (openAiKey, ${openAiKey.substring(0, 8)}...)`)
			return openAiKey.trim()
		}
		const openRouterKey = config.get<string>("openRouterKey", "")
		if (openRouterKey && openRouterKey.trim().length > 0) {
			console.log(`[sessionQdrant] API key found in VS Code config (openRouterKey, ${openRouterKey.substring(0, 8)}...)`)
			return openRouterKey.trim()
		}
	} catch {
		// VS Code API not available
	}

	console.warn("[sessionQdrant] No embedder API key found in process.env or VS Code config. RRR enrichment will be skipped.")
	return undefined
}

/**
 * Get embedding model ID from globalState (where UI saves codebase indexing config).
 * This reads from the same source as ClineProvider.getCodebaseIndexEmbedderModelId().
 *
 * NOTE: This requires vscode.ExtensionContext to access globalState.
 * For contexts without context access, pass modelId explicitly.
 */
export function getEmbeddingModelIdFromGlobalState(context?: vscode.ExtensionContext): string | undefined {
	if (!context) return undefined
	try {
		const config = context.globalState.get<{ codebaseIndexEmbedderModelId?: string }>("codebaseIndexConfig")
		const modelId = config?.codebaseIndexEmbedderModelId
		if (modelId && modelId.trim().length > 0) return modelId
	} catch {
		// ignore
	}
	return undefined
}

/**
 * Get embedding model ID from VS Code settings.json (fallback).
 * @deprecated Use getEmbeddingModelIdFromGlobalState() instead — UI writes to globalState, not settings.json.
 */
export function getEmbeddingModelId(): string | undefined {
	try {
		const config = vscode.workspace.getConfiguration("roo-code.codebaseIndex")
		const modelId = config.get<string>("embeddingModelId")
		if (modelId && modelId.trim().length > 0) return modelId
	} catch {
		// ignore
	}
	return undefined
}

/**
 * Get embedder provider from VS Code config or environment.
 */
export function getEmbedderProvider(): EmbedderProvider {
	try {
		const config = vscode.workspace.getConfiguration("roo-code.codebaseIndex")
		return (config.get<string>("embedderProvider", "openrouter") as EmbedderProvider)
	} catch {
		return "openrouter"
	}
}

/**
 * Get base URL for the embedder provider.
 */
export function getEmbedderBaseUrl(provider: EmbedderProvider): string {
	if (provider === "openai") {
		return "https://api.openai.com/v1"
	}
	if (provider === "openrouter") {
		return "https://openrouter.ai/api/v1"
	}
	try {
		const config = vscode.workspace.getConfiguration("roo-code.codebaseIndex")
		return config.get<string>("openAiCompatibleBaseUrl", "https://openrouter.ai/api/v1")
	} catch {
		return "https://openrouter.ai/api/v1"
	}
}

/**
 * Try to get an embedder via CodeIndexManager.
 * Falls back to null if unavailable.
 */
export async function getEmbedderFromCodeIndex(context: vscode.ExtensionContext): Promise<{ embedFunction: (text: string) => Promise<number[]> } | null> {
	try {
		const manager = CodeIndexManager.getInstance(context)
		if (!manager || !manager.isFeatureEnabled || !manager.isFeatureConfigured) {
			return null
		}

		// Try to get vector size from config
		const embedderProvider = getEmbedderProvider()
		const modelId = getEmbeddingModelId()
		if (!modelId) {
			console.warn(`[sessionQdrant] No embedding model ID configured. Set roo-code.codebaseIndex.embeddingModelId in VS Code settings (Roo Code → Code Indexing → Embedding Model).`)
			return null
		}
		const dimension = getModelDimension(embedderProvider, modelId)
		if (!dimension) {
			console.warn(`[sessionQdrant] Cannot determine vector dimension for provider=${embedderProvider}, modelId=${modelId}. Set roo-code.codebaseIndex.embeddingModelDimension manually.`)
			return null
		}

		// Get API key (env vars > VS Code config)
		const apiKey = getEmbedderApiKey()
		if (!apiKey) return null

		const baseUrl = getEmbedderBaseUrl(embedderProvider)
		const embedder = new OpenAICompatibleEmbedder(baseUrl, apiKey, modelId || undefined)
		return {
			embedFunction: async (text: string) => {
				const result = await embedder.createEmbeddings([text])
				return result.embeddings[0]!
			},
		}
	} catch {
		return null
	}
}

/**
 * Create a direct OpenAI-compatible embedder for session embedding.
 * Resolves modelId from: explicit param > globalState > settings.json fallback.
 *
 * @param apiKey - API key for the embedder
 * @param baseUrl - Base URL for the embedder API
 * @param modelId - Explicit model ID (if provided, used directly)
 * @param context - Optional ExtensionContext to read modelId from globalState
 */
export function createDirectEmbedder(
	apiKey?: string,
	baseUrl?: string,
	modelId?: string,
	context?: vscode.ExtensionContext,
): { embedFunction: (text: string) => Promise<number[]> } {
	const resolvedApiKey = apiKey || getEmbedderApiKey() || ""
	const url = baseUrl || getEmbedderBaseUrl(getEmbedderProvider())
	const model = modelId || getEmbeddingModelIdFromGlobalState(context) || getEmbeddingModelId()
	if (!model || model.trim() === "") {
		throw new Error(
			`[sessionQdrant] No embedding model ID configured. ` +
			`Please enable codebase indexing in VS Code: ` +
			`Roo Code → Code Indexing → choose an Embedding Model, then click "Save & Index". ` +
			`Alternatively set roo-code.codebaseIndex.embeddingModelId in VS Code settings.json.`
		)
	}
	const embedder = new OpenAICompatibleEmbedder(url, resolvedApiKey, model)
	return {
		embedFunction: async (text: string) => {
			const result = await embedder.createEmbeddings([text])
			return result.embeddings[0]!
		},
	}
}

/**
 * Search Qdrant with custom filter (type=session_history + taskId).
 */
export async function searchWithFilter(
	client: QdrantClient,
	collectionName: string,
	queryVector: number[],
	taskId: string,
	minScore?: number,
	limit?: number,
): Promise<Array<{ payload: Record<string, unknown>; score: number }>> {
	const searchRequest = {
		query: queryVector,
		filter: {
			must: [
				{ key: "type", match: { value: "session_history" } },
				{ key: "taskId", match: { value: taskId } },
			],
		},
		score_threshold: minScore ?? 0.0,
		limit: limit ?? 3,
		params: {
			hnsw_ef: 128,
			exact: false,
		},
		with_payload: true,
	}

	const operationResult = await client.query(collectionName, searchRequest)
	return operationResult.points.map((p) => ({
		payload: (p.payload as Record<string, unknown>) || {},
		score: p.score ?? 0,
	}))
}

/**
 * Search Qdrant for messages similar to the given query text.
 * Returns message timestamps with their similarity scores.
 * Used by RRR-predictor to extract relevance tags from Qdrant.
 */
export async function searchSimilarMessages(
	embedFunction: (text: string) => Promise<number[]>,
	client: QdrantClient,
	collectionName: string,
	queryText: string,
	taskId: string,
	limit: number = 5,
): Promise<Array<{ messageTs: string; score: number }>> {
	const queryVector = await embedFunction(queryText)
	const results = await searchWithFilter(client, collectionName, queryVector, taskId, 0.0, limit)
	return results
		.filter((r) => r.payload.messageTs && typeof r.payload.messageTs === "string")
		.map((r) => ({
			messageTs: r.payload.messageTs as string,
			score: r.score,
		}))
		.sort((a, b) => b.score - a.score)
}

/**
 * RRR (Retrieve-Refine-Retrieve) iterative vector search.
 *
 * Algorithm:
 * - Iteration 1: search by `queryText + systemPrompt`
 * - Iteration 2: search by `queryText + systemPrompt + foundMessage1`
 * - Iteration 3: search by `queryText + systemPrompt + foundMessage1 + foundMessage2`
 *
 * Each iteration embeds the concatenated text (not vector averaging).
 * Only NEW unique messages from each iteration are added to the query for the next iteration.
 */
export async function rrrSearch(
	embedFunction: (text: string) => Promise<number[]>,
	client: QdrantClient,
	collectionName: string,
	queryText: string,
	taskId: string,
	maxIterations: number = 3,
	fragmentsPerIteration: number = 3,
	scoreThreshold: number = 0.0,
	systemPrompt?: string,
): Promise<RrrResult> {
	const messageTsSet = new Set<number>()
	const chunks: RrrChunk[] = []
	const seenChunkIds = new Set<string>()
	const seenIds = new Set<string>()
	
	// Collect texts from found messages to append to query on each iteration
	const foundMessageTexts: string[] = []
	
	// Build initial query: queryText + systemPrompt (if provided)
	let currentQueryText = systemPrompt
		? `${queryText}\n\n${systemPrompt}`
		: queryText

	console.log(`[rrrSearch] Starting RRR cycle: query="${currentQueryText.substring(0, 100)}...", threshold=${scoreThreshold}, maxIter=${maxIterations}, limit=${fragmentsPerIteration}, hasSystemPrompt=${!!systemPrompt}`)

	for (let iter = 0; iter < maxIterations; iter++) {
		// Embed the concatenated text for this iteration
		const currentVector = await embedFunction(currentQueryText)
		
		const results = await searchWithFilter(client, collectionName, currentVector, taskId, scoreThreshold, fragmentsPerIteration)

		console.log(`[rrrSearch] Iteration ${iter + 1}/${maxIterations}: found ${results.length} results`)

		if (results.length === 0) {
			console.log(`[rrrSearch] No results at iteration ${iter + 1}, stopping RRR cycle`)
			break
		}

		// Log scores for diagnostics
		const scores = results.map((r) => r.score.toFixed(4))
		console.log(`[rrrSearch] Iteration ${iter + 1} scores: [${scores.join(", ")}]`)

		let foundNew = false

		for (const result of results) {
			const payload = result.payload
			const messageTs = payload.messageTs as string | undefined
			const chunkId = payload.chunkId as string | undefined
			const uniqueId = messageTs ? `${messageTs}_${chunkId ?? ""}` : null

			if (uniqueId && !seenIds.has(uniqueId)) {
				seenIds.add(uniqueId)
				foundNew = true
				if (messageTs) {
					const tsNum = Number(messageTs)
					if (!isNaN(tsNum)) {
						messageTsSet.add(tsNum)
					}
				}
				
				// Collect the message text for the next iteration's query
				if (payload.text && typeof payload.text === "string") {
					foundMessageTexts.push(payload.text)
				}
			}

			// Collect unique chunks for RrrResult
			if (chunkId && !seenChunkIds.has(chunkId)) {
				seenChunkIds.add(chunkId)
				chunks.push({
					chunkId,
					text: (payload.text as string) || "",
					score: result.score,
					messageTs: messageTs ? Number(messageTs) : 0,
				})
			}
		}

		if (!foundNew) {
			console.log(`[rrrSearch] No new unique results at iteration ${iter + 1}, stopping RRR cycle`)
			break
		}

		// Build query for next iteration: queryText + systemPrompt + all found message texts
		currentQueryText = systemPrompt
			? `${queryText}\n\n${systemPrompt}\n\n${foundMessageTexts.join("\n\n")}`
			: `${queryText}\n\n${foundMessageTexts.join("\n\n")}`
		
		console.log(`[rrrSearch] Next iteration query length: ${currentQueryText.length} chars, ${foundMessageTexts.length} found messages`)
	}

	console.log(`[rrrSearch] RRR cycle complete: ${messageTsSet.size} unique messageTs, ${chunks.length} chunks`)

	return {
		chunks,
		relevantTs: messageTsSet,
		enrichedContext: messageTsSet.size > 0,
		diagnostics: {
			findChunksResult: chunks.map((c) => c.chunkId),
			extractedTsCount: messageTsSet.size,
		},
		queryText,
	}
}

/**
 * Average multiple vectors element-wise.
 */
export function averageVectors(vectors: number[][]): number[] {
	if (vectors.length === 0) return []
	if (vectors.length === 1) return vectors[0]!

	const dim = vectors[0]!.length
	const avg = new Array(dim).fill(0)
	for (const vec of vectors) {
		for (let i = 0; i < dim; i++) {
			avg[i] += vec[i]!
		}
	}
	for (let i = 0; i < dim; i++) {
		avg[i] /= vectors.length
	}
	return avg
}

/**
 * Ensure the session history collection exists in Qdrant.
 * Creates it if necessary.
 */
export async function ensureSessionCollection(
	workspacePath: string,
	qdrantUrl: string,
	vectorSize: number,
	apiKey?: string,
): Promise<{ client: QdrantClient; collectionName: string }> {
	// Normalize workspace path for consistent collection naming
	const safeName = normalizeWorkspacePathForCollection(workspacePath)
	const collectionName = `${SESSION_COLLECTION_PREFIX}${safeName}`

	console.log(`[ensureSessionCollection] workspacePath="${workspacePath}", collectionName="${collectionName}"`)

	const client = new QdrantClient({
		url: qdrantUrl || "http://localhost:6333",
		apiKey,
		timeout: 3000, // 3s timeout — fallback if Qdrant configured but not running
		headers: {
			"User-Agent": "Zoo-Code",
		},
	})

	try {
		const collectionInfo = await client.getCollection(collectionName)
		if (!collectionInfo) {
			await client.createCollection(collectionName, {
				vectors: {
					size: vectorSize,
					distance: "Cosine",
					on_disk: true,
				},
				hnsw_config: {
					m: 64,
					ef_construct: 512,
					on_disk: true,
				},
			})
			console.log(`[sessionQdrant] Created session collection: ${collectionName}`)
		}
	} catch (err: any) {
		// Collection doesn't exist → create
		if (err.status === 404 || err.message?.includes("Not found")) {
			await client.createCollection(collectionName, {
				vectors: {
					size: vectorSize,
					distance: "Cosine",
					on_disk: true,
				},
				hnsw_config: {
					m: 64,
					ef_construct: 512,
					on_disk: true,
				},
			})
			console.log(`[sessionQdrant] Created session collection: ${collectionName}`)
		} else {
			console.warn(`[sessionQdrant] Collection check warning: ${err.message}`)
		}
	}

	return { client, collectionName }
}

/**
 * Guard: проверяет, можно ли запускать RRR-цикл.
 * Возвращает true если в настройках есть URL Qdrant.
 */
export function isQdrantConfigured(): boolean {
	try {
		const config = vscode.workspace.getConfiguration("roo-code.codebaseIndex")
		const url = config.get<string>("qdrantUrl", "http://localhost:6333")
		if (!url || url.trim() === "") return false
		return true
	} catch {
		return false
	}
}

/**
 * Get Qdrant URL and API key from VS Code settings.
 */
export function getQdrantConfig(): { url: string; apiKey?: string } {
	try {
		const config = vscode.workspace.getConfiguration("roo-code.codebaseIndex")
		const url = config.get<string>("qdrantUrl", "http://localhost:6333")
		const apiKey = config.get<string>("qdrantApiKey")
		return { url, apiKey }
	} catch {
		return { url: "http://localhost:6333" }
	}
}

/**
 * Get embedding vector dimension for a given modelId.
 * Throws with actionable error message if modelId is missing or dimension unknown.
 *
 * @param modelId - The embedding model ID (e.g. "openai/text-embedding-3-small")
 * @param context - Optional ExtensionContext to read from globalState if modelId not provided
 */
export function getVectorSize(modelId?: string, context?: vscode.ExtensionContext): number {
	const embedderProvider = getEmbedderProvider()
	const resolvedModelId = modelId || getEmbeddingModelIdFromGlobalState(context) || getEmbeddingModelId()
	if (!resolvedModelId) {
		throw new Error(
			`[sessionQdrant] No embedding model ID configured. ` +
			`Please enable codebase indexing in VS Code: ` +
			`Roo Code → Code Indexing → choose an Embedding Model, then click "Save & Index". ` +
			`Alternatively set roo-code.codebaseIndex.embeddingModelId in VS Code settings.json.`
		)
	}
	const dimension = getModelDimension(embedderProvider, resolvedModelId)
	if (!dimension) {
		throw new Error(
			`[sessionQdrant] Cannot determine vector dimension for provider="${embedderProvider}", modelId="${resolvedModelId}". ` +
			`Please check that the model is supported or set roo-code.codebaseIndex.embeddingModelDimension manually.`
		)
	}
	return dimension
}

/**
 * Извлекает messageTs из chunk_id произвольного формата.
 */
export function extractTsFromChunkId(chunkId: string): string | null {
	if (!chunkId || typeof chunkId !== "string") return null

	// Формат: msg-{messageTs}-frag-{index}
	const msgPattern = /^msg-(.+)-frag-\d+$/
	const match = chunkId.match(msgPattern)
	if (match && match[1]) {
		return match[1]
	}

	// Если формат не распознан — chunk_id произвольный, ts не извлекается
	return null
}

// ─── Workspace RAG Search ─────────────────────────────────────────────────────

export interface WorkspaceSearchStats {
	typeDistribution: { code: number; config: number; doc: number; other: number }
	weightImpact: { avgScoreDelta: number; maxScoreDelta: number; avgWeightApplied: number }
	rankingChanges: { promoted: number; demoted: number; unchanged: number }
	weightsUsed: { code: number; config: number; doc: number; other: number }
}

export interface WorkspaceSearchResult {
	fragments: WorkspaceSearchFragment[]
	count: number
	error?: string
	stats?: WorkspaceSearchStats
}

export interface WorkspaceSearchFragment {
	filePath: string
	fileType: string
	startLine: number
	endLine: number
	codeChunk: string
	score: number
	adjustedScore?: number
}

export interface FileTypeWeights {
	code?: number
	config?: number
	doc?: number
	other?: number
}

export const DEFAULT_FILE_TYPE_WEIGHTS: FileTypeWeights = {
	code: 1.0,
	config: 0.8,
	doc: 0.6,
	other: 0.4,
}

/**
 * Search workspace code fragments using Qdrant vector search.
 * Enhanced with comprehensive logging for diagnostics.
 */
export async function workspaceSearch(
	query: string,
	workspacePath: string,
	limit: number = 5,
	minScore: number = 0.15,
	embedderApiKey?: string,
	embedderModelId?: string,
	fileTypeWeights?: FileTypeWeights,
): Promise<WorkspaceSearchResult> {
	const startTime = Date.now()
	const weights = { ...DEFAULT_FILE_TYPE_WEIGHTS, ...fileTypeWeights }

	try {
		if (!query || query.trim().length === 0) {
			console.log(`[workspaceSearch] ERROR: Empty query, workspacePath="${workspacePath}"`)
			return { fragments: [], count: 0, error: "Empty query" }
		}

		if (!isQdrantConfigured()) {
			console.log(`[workspaceSearch] ERROR: Qdrant not configured, workspacePath="${workspacePath}"`)
			return { fragments: [], count: 0, error: "Qdrant not configured" }
		}

		const qdrantConfig = getQdrantConfig()
		console.log(`[workspaceSearch] START: query="${query.substring(0, 50)}...", workspacePath="${workspacePath}", qdrantUrl="${qdrantConfig.url}"`)

		// Use provided key first, fallback to config/env resolution
		const apiKey = embedderApiKey || getEmbedderApiKey()
		if (!apiKey) {
			console.log(`[workspaceSearch] ERROR: No embedder API key, workspacePath="${workspacePath}"`)
			return { fragments: [], count: 0, error: "No embedder API key" }
		}

		const { OpenAICompatibleEmbedder } = await import("../../services/code-index/embedders/openai-compatible")
		const embedderProvider = getEmbedderProvider()
		// Use provided modelId first, then fallback to config/env resolution
		const modelId = embedderModelId || getEmbeddingModelId()
		if (!modelId) {
			console.log(`[workspaceSearch] ERROR: No embedding model ID configured, workspacePath="${workspacePath}"`)
			return {
				fragments: [],
				count: 0,
				error: "No embedding model ID configured. Enable codebase indexing in VS Code settings (Roo Code → Code Indexing → Embedding Model)."
			}
		}
		const baseUrl = getEmbedderBaseUrl(embedderProvider)
		const embedder = new OpenAICompatibleEmbedder(baseUrl, apiKey, modelId)

		// Create embedding first to determine actual vector dimension
		const { embeddings } = await embedder.createEmbeddings([query])
		const queryVector = embeddings[0]

		if (!queryVector || queryVector.length === 0) {
			console.log(`[workspaceSearch] ERROR: Failed to create embedding, workspacePath="${workspacePath}"`)
			return { fragments: [], count: 0, error: "Failed to create embedding" }
		}

		// Use actual embedding dimension (not config-based) to match Qdrant collection
		const vectorSize = queryVector.length

		const { QdrantVectorStore } = await import("../../services/code-index/vector-store/qdrant-client")
		const vectorStore = new QdrantVectorStore(workspacePath, qdrantConfig.url, vectorSize, qdrantConfig.apiKey)
		
		console.log(`[workspaceSearch] Collection name: "${vectorStore.getCollectionName()}", vectorSize: ${vectorSize}, workspacePath: "${workspacePath}"`)
		
		await vectorStore.initialize()

		// Get workspace path from collection metadata for diagnostics
		const metadataWorkspacePath = await vectorStore.getWorkspacePathFromMetadata()
		if (metadataWorkspacePath) {
			console.log(`[workspaceSearch] Collection metadata workspace_path: "${metadataWorkspacePath}"`)
			if (metadataWorkspacePath !== workspacePath) {
				console.warn(`[workspaceSearch] WARNING: workspacePath mismatch! Passed="${workspacePath}", Collection metadata="${metadataWorkspacePath}"`)
			}
		} else {
			console.log(`[workspaceSearch] Collection has no workspace_path metadata`)
		}

		const hasData = await vectorStore.hasIndexedData()
		if (!hasData) {
			console.log(`[workspaceSearch] ERROR: Workspace not indexed yet, collection="${vectorStore.getCollectionName()}", workspacePath="${workspacePath}"`)
			return { fragments: [], count: 0, error: "Workspace not indexed yet" }
		}

		// Search with expanded limit to allow for deduplication
		// We request more results than needed since duplicates by filePath will be removed
		const expandedLimit = Math.max(limit * 3, 15)
		const searchResults = await vectorStore.search(queryVector, undefined, minScore, expandedLimit)

		console.log(`[workspaceSearch] Qdrant returned ${searchResults.length} raw results (expandedLimit=${expandedLimit}, minScore=${minScore})`)
		if (searchResults.length > 0) {
			const typeCounts: Record<string, number> = {}
			for (const r of searchResults) {
				const ft = (r.payload?.fileType as string) || 'unknown'
				typeCounts[ft] = (typeCounts[ft] || 0) + 1
			}
			console.log(`[workspaceSearch] Result types: ${JSON.stringify(typeCounts)}`)
		}

		// Build fragments with adjusted score based on file type weights
		const fragments: WorkspaceSearchFragment[] = searchResults.map((r) => {
			const fileType = (r.payload?.fileType as string) || 'other'
			const originalScore = r.score ?? 0
			const weight = weights[fileType as keyof FileTypeWeights] ?? 1.0
			const adjustedScore = originalScore * weight
			return {
				filePath: r.payload?.filePath as string,
				fileType,
				startLine: r.payload?.startLine as number,
				endLine: r.payload?.endLine as number,
				codeChunk: r.payload?.codeChunk as string,
				score: originalScore,
				adjustedScore,
			}
		})

		// Sort by adjusted score (descending)
		fragments.sort((a, b) => (b.adjustedScore ?? 0) - (a.adjustedScore ?? 0))

		// Deduplicate by filePath — keep only the highest-scored fragment per file
		const seenFilePaths = new Set<string>()
		const dedupedFragments: WorkspaceSearchFragment[] = []
		for (const fragment of fragments) {
			if (fragment.filePath && !seenFilePaths.has(fragment.filePath)) {
				seenFilePaths.add(fragment.filePath)
				dedupedFragments.push(fragment)
			}
		}

		// Take top-k after deduplication
		const topFragments = dedupedFragments.slice(0, limit)

		console.log(`[workspaceSearch] After dedup: ${dedupedFragments.length} unique files (from ${fragments.length} total), returning top ${limit}`)

		// ─── Compute ranking statistics ───────────────────────────────────────
		const typeDistribution = { code: 0, config: 0, doc: 0, other: 0 }
		let totalScoreDelta = 0
		let maxScoreDelta = 0
		let totalWeightApplied = 0
		for (const f of topFragments) {
			typeDistribution[f.fileType as keyof typeof typeDistribution]++
			const delta = Math.abs((f.adjustedScore ?? f.score) - f.score)
			totalScoreDelta += delta
			if (delta > maxScoreDelta) maxScoreDelta = delta
			const w = f.score > 0 ? (f.adjustedScore ?? f.score) / f.score : 1.0
			totalWeightApplied += w
		}
		const avgScoreDelta = topFragments.length > 0 ? totalScoreDelta / topFragments.length : 0
		const avgWeightApplied = topFragments.length > 0 ? totalWeightApplied / topFragments.length : 1.0

		// Ranking changes: compare original order vs adjusted order
		const originalOrder = [...fragments].sort((a, b) => b.score - a.score)
		const adjustedOrder = [...fragments].sort((a, b) => (b.adjustedScore ?? 0) - (a.adjustedScore ?? 0))
		let promoted = 0, demoted = 0, unchanged = 0
		for (let i = 0; i < Math.min(originalOrder.length, limit); i++) {
			const origIdx = originalOrder.indexOf(adjustedOrder[i]!)
			if (origIdx === i) unchanged++
			else if (origIdx > i) promoted++
			else demoted++
		}

		const stats: WorkspaceSearchStats = {
			typeDistribution,
			weightImpact: { avgScoreDelta, maxScoreDelta, avgWeightApplied },
			rankingChanges: { promoted, demoted, unchanged },
			weightsUsed: { code: weights.code!, config: weights.config!, doc: weights.doc!, other: weights.other! },
		}

		const elapsed = Date.now() - startTime
		console.log(`[workspaceSearch] SUCCESS: Found ${topFragments.length} fragments in ${elapsed}ms, collection="${vectorStore.getCollectionName()}", workspacePath="${workspacePath}"`)
		console.log(`[workspaceSearch] Weights applied: code=${weights.code}, config=${weights.config}, doc=${weights.doc}, other=${weights.other}`)
		for (const f of topFragments) {
			console.log(`[workspaceSearch]   ${f.filePath}: original=${f.score.toFixed(4)}, adjusted=${f.adjustedScore?.toFixed(4)}, type=${f.fileType}`)
		}
		console.log(`[WS_STATS] ${JSON.stringify(stats)}`)

		return { fragments: topFragments, count: topFragments.length, stats }
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		const elapsed = Date.now() - startTime
		console.error(`[workspaceSearch] FAILED after ${elapsed}ms: ${errorMessage}, workspacePath="${workspacePath}"`)
		return { fragments: [], count: 0, error: errorMessage }
	}
}
