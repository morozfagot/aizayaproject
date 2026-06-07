import { QdrantClient } from "@qdrant/js-client-rest"
import { createHash } from "crypto"
import * as vscode from "vscode"

import { CodeIndexManager } from "../../services/code-index/manager"
import { OpenAICompatibleEmbedder } from "../../services/code-index/embedders/openai-compatible"
import { getModelDimension } from "../../shared/embeddingModels"

/**
 * RRR (Retrieve-Refine-Retrieve) utilities for session history vector enrichment.
 */

const SESSION_COLLECTION_PREFIX = "session_"

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
		const config = vscode.workspace.getConfiguration("roo-code.codebaseIndex")
		const embedderProvider = config.get<string>("embedderProvider", "openai")
		const modelId = config.get<string>("embeddingModelId")
		const dimension = modelId ? getModelDimension(embedderProvider, modelId) : getModelDimension(embedderProvider)

		// We cannot access the internal embedder directly from manager,
		// so we create a lightweight one using the same config
		const openAiKey = config.get<string>("openAiKey") || config.get<string>("openAiNativeApiKey", "")
		const openRouterKey = config.get<string>("openRouterKey", "")
		const apiKey = openAiKey || openRouterKey

		if (!apiKey) return null

		// Determine base URL
		let baseUrl: string
		if (embedderProvider === "openai") {
			baseUrl = "https://api.openai.com/v1"
		} else if (embedderProvider === "openrouter") {
			baseUrl = "https://openrouter.ai/api/v1"
		} else {
			baseUrl = config.get<string>("openAiCompatibleBaseUrl", "https://api.openai.com/v1")
		}

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
 * Uses environment-based configuration.
 */
export function createDirectEmbedder(apiKey: string, baseUrl?: string, modelId?: string): { embedFunction: (text: string) => Promise<number[]> } {
	const url = baseUrl || "https://openrouter.ai/api/v1"
	const model = modelId || "qwen/qwen3-embedding-8b"
	const embedder = new OpenAICompatibleEmbedder(url, apiKey, model)
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
	*
	* @param embedFunction - Function that converts text to embedding vector
	* @param client - Qdrant client
	* @param collectionName - Qdrant collection name
	* @param queryText - Text to search for
	* @param taskId - Task ID filter
	* @param limit - Max results to return (default: 5)
	* @returns Array of { messageTs, score } sorted by score descending
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
 * @param embedFunction - Function that converts text to embedding vector
 * @param client - Qdrant client
 * @param collectionName - Qdrant collection name
 * @param queryText - Text to search for
 * @param taskId - Task ID filter
 * @param maxIterations - Maximum RRR iterations (default: 3)
 * @param fragmentsPerIteration - Fragments to retrieve per iteration (default: 3)
 * @param scoreThreshold - Minimum score threshold (default: 0.0)
 * @returns Object with messageTsSet (Set of unique messageTs) and chunkIds (array of unique chunk IDs)
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

	for (let iter = 0; iter < maxIterations; iter++) {
		const results = await searchWithFilter(client, collectionName, currentVector, taskId, scoreThreshold, fragmentsPerIteration)

		if (results.length === 0) break

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

		if (!foundNew) break

		// Refine: average current vector with fragment vectors
		currentVector = averageVectors(newVectors)
	}

	return { messageTsSet, chunkIds }
}

/**
 * Ensure the session history collection exists in Qdrant.
 * Creates it if necessary.
 *
 * @param workspacePath - Workspace path for collection name generation
 * @param qdrantUrl - Qdrant server URL
 * @param vectorSize - Embedding vector dimension
 * @param apiKey - Optional Qdrant API key
 * @returns QdrantClient and collection name
 */
export async function ensureSessionCollection(
	workspacePath: string,
	qdrantUrl: string,
	vectorSize: number,
	apiKey?: string,
): Promise<{ client: QdrantClient; collectionName: string }> {
	const hash = createHash("sha256").update(workspacePath).digest("hex")
	const collectionName = `${SESSION_COLLECTION_PREFIX}${hash.substring(0, 16)}`

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
 * Если URL пустой — Qdrant не настроен, не лезем чтобы не зависнуть. а почему мы должны зависнуть сразу? если докера нет действительно и мы зависаем в ожидании докера, то надо таймаут ставить по которому будет включаться красный флажок в интерфейсе на индексе с ошибкой. в общем эта фича уже вроде как есть, я хуй знает как там тожно зависнуть
 */
export function isQdrantConfigured(): boolean {
	try {
		const config = vscode.workspace.getConfiguration("roo-code.codebaseIndex")
		const url = config.get<string>("qdrantUrl", "")
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
	try {
		const config = vscode.workspace.getConfiguration("roo-code.codebaseIndex")
		const embedderProvider = config.get<string>("embedderProvider", "openai")
		const modelId = config.get<string>("embeddingModelId")
		return modelId ? getModelDimension(embedderProvider, modelId) : getModelDimension(embedderProvider)
	} catch {
		return 1024 // fallback default
	}
}

/**
	* Извлекает messageTs из chunk_id произвольного формата.
	*
	* Поддерживаемые форматы:
	* - `msg-{messageTs}-frag-{index}` — стандартный формат из messageRefactorer
	* - Любой другой формат — возвращает null (chunk_id может быть произвольной строкой)
	*
	* @param chunkId - Идентификатор чанка (chunk_id из payload Qdrant)
	* @returns Извлечённый messageTs (строка) или null, если формат не распознан
	*
	* @example
	* extractTsFromChunkId("msg-1704067200000-frag-0") // "1704067200000"
	* extractTsFromChunkId("msg-abc123-frag-2")         // "abc123"
	* extractTsFromChunkId("custom-chunk-id")           // null
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