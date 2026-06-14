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
 * Get embedding model ID from VS Code config or environment.
 */
export function getEmbeddingModelId(): string | undefined {
	try {
		const config = vscode.workspace.getConfiguration("roo-code.codebaseIndex")
		const modelId = config.get<string>("embeddingModelId")
		if (modelId) return modelId
	} catch {
		// ignore
	}
	return process.env.EMBEDDING_MODEL_ID || undefined
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
			console.warn(`[sessionQdrant] No embedding model ID configured. Set roo-code.codebaseIndex.embeddingModelId or EMBEDDING_MODEL_ID.`)
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
 * Uses environment-based configuration with VS Code config fallback.
 */
export function createDirectEmbedder(apiKey?: string, baseUrl?: string, modelId?: string): { embedFunction: (text: string) => Promise<number[]> } {
	const resolvedApiKey = apiKey || getEmbedderApiKey() || ""
	const url = baseUrl || getEmbedderBaseUrl(getEmbedderProvider())
	const model = modelId || getEmbeddingModelId() || "qwen/qwen3-embedding-8b"
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
): Promise<{ messageTsSet: Set<string>; chunkIds: string[] }> {
	const messageTsSet = new Set<string>()
	const chunkIds: string[] = []
	const seenChunkIds = new Set<string>()
	let currentVector = await embedFunction(queryText)
	const seenIds = new Set<string>()

	console.log(`[rrrSearch] Starting RRR cycle: query="${queryText.substring(0, 100)}...", threshold=${scoreThreshold}, maxIter=${maxIterations}, limit=${fragmentsPerIteration}`)

	for (let iter = 0; iter < maxIterations; iter++) {
		const results = await searchWithFilter(client, collectionName, currentVector, taskId, scoreThreshold, fragmentsPerIteration)

		console.log(`[rrrSearch] Iteration ${iter + 1}/${maxIterations}: found ${results.length} results`)

		if (results.length === 0) {
			console.log(`[rrrSearch] No results at iteration ${iter + 1}, stopping RRR cycle`)
			break
		}

		// Log scores for diagnostics
		const scores = results.map((r) => r.score.toFixed(4))
		console.log(`[rrrSearch] Iteration ${iter + 1} scores: [${scores.join(", ")}]`)

		const newVectors: number[][] = [currentVector]
		let foundNew = false

		for (const result of results) {
			const payload = result.payload
			const messageTs = payload.messageTs as string | undefined
			const chunkId = payload.chunkId as string | undefined
			const uniqueId = messageTs ? `${messageTs}_${chunkId ?? ""}` : null

			if (uniqueId && !seenIds.has(uniqueId)) {
				seenIds.add(uniqueId)
				foundNew = true
				if (messageTs) messageTsSet.add(messageTs)
			}

			// Collect unique chunk IDs for diagnostics
			if (chunkId && !seenChunkIds.has(chunkId)) {
				seenChunkIds.add(chunkId)
				chunkIds.push(chunkId)
			}

			// Try to embed the fragment text to refine the query vector
			if (payload.text && typeof payload.text === "string") {
				try {
					const fragVector = await embedFunction(payload.text)
					newVectors.push(fragVector)
				} catch {
					// Skip if embedding fails for a fragment
				}
			}
		}

		if (!foundNew) {
			console.log(`[rrrSearch] No new unique results at iteration ${iter + 1}, stopping RRR cycle`)
			break
		}

		// Refine: average current vector with fragment vectors
		currentVector = averageVectors(newVectors)
	}

	console.log(`[rrrSearch] RRR cycle complete: ${messageTsSet.size} unique messageTs, ${chunkIds.length} unique chunkIds`)

	return { messageTsSet, chunkIds }
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
 * Get embedding vector dimension from VS Code settings.
 */
export function getVectorSize(): number {
	const embedderProvider = getEmbedderProvider()
	const modelId = getEmbeddingModelId()
	if (!modelId) {
		throw new Error(
			`[sessionQdrant] No embedding model ID configured. ` +
			`Please set roo-code.codebaseIndex.embeddingModelId in VS Code settings or EMBEDDING_MODEL_ID environment variable.`
		)
	}
	const dimension = getModelDimension(embedderProvider, modelId)
	if (!dimension) {
		throw new Error(
			`[sessionQdrant] Cannot determine vector dimension for provider="${embedderProvider}", modelId="${modelId}". ` +
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

export interface WorkspaceSearchResult {
	fragments: WorkspaceSearchFragment[]
	count: number
	error?: string
}

export interface WorkspaceSearchFragment {
	filePath: string
	startLine: number
	endLine: number
	codeChunk: string
	score: number
}

/**
 * Search workspace code fragments using Qdrant vector search.
 * Enhanced with comprehensive logging for diagnostics.
 */
export async function workspaceSearch(
	query: string,
	workspacePath: string,
	limit: number = 5,
	minScore: number = 0.3,
	embedderApiKey?: string,
	embedderModelId?: string,
): Promise<WorkspaceSearchResult> {
	const startTime = Date.now()
	
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
				error: "No embedding model ID configured. Set the embedding model in Roo Code settings (Code Indexing → Embedding Model) or set EMBEDDING_MODEL_ID environment variable."
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

		const searchResults = await vectorStore.search(queryVector, undefined, minScore, limit)

		const fragments: WorkspaceSearchFragment[] = searchResults.map((r) => ({
			filePath: r.payload?.filePath as string,
			startLine: r.payload?.startLine as number,
			endLine: r.payload?.endLine as number,
			codeChunk: r.payload?.codeChunk as string,
			score: r.score ?? 0,
		}))

		const elapsed = Date.now() - startTime
		console.log(`[workspaceSearch] SUCCESS: Found ${fragments.length} fragments in ${elapsed}ms, collection="${vectorStore.getCollectionName()}", workspacePath="${workspacePath}"`)

		return { fragments, count: fragments.length }
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		const elapsed = Date.now() - startTime
		console.error(`[workspaceSearch] FAILED after ${elapsed}ms: ${errorMessage}, workspacePath="${workspacePath}"`)
		return { fragments: [], count: 0, error: errorMessage }
	}
}
