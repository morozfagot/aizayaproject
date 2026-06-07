import * as vscode from "vscode"
import path from "path"

import { Task } from "../task/Task"
import { CodeIndexManager } from "../../services/code-index/manager"
import { getWorkspacePath } from "../../utils/path"
import { formatResponse } from "../prompts/responses"
import { VectorStoreSearchResult } from "../../services/code-index/interfaces"
import { QdrantVectorStore } from "../../services/code-index/vector-store/qdrant-client"
import { OpenAICompatibleEmbedder } from "../../services/code-index/embedders/openai-compatible"
import type { ToolUse } from "../../shared/tools"

import { BaseTool, ToolCallbacks } from "./BaseTool"

interface CodebaseSearchParams {
	query: string
	path?: string
}

export class CodebaseSearchTool extends BaseTool<"codebase_search"> {
	readonly name = "codebase_search" as const

	async execute(params: CodebaseSearchParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { askApproval, handleError, pushToolResult } = callbacks
		const { query, path: directoryPrefix } = params

		const workspacePath = task.cwd && task.cwd.trim() !== "" ? task.cwd : getWorkspacePath()

		if (!workspacePath) {
			await handleError("codebase_search", new Error("Could not determine workspace path."))
			return
		}

		if (!query) {
			task.consecutiveMistakeCount++
			task.didToolFailInCurrentTurn = true
			pushToolResult(await task.sayAndCreateMissingParamError("codebase_search", "query"))
			return
		}

		const sharedMessageProps = {
			tool: "codebaseSearch",
			query: query,
			path: directoryPrefix,
			isOutsideWorkspace: false,
		}

		const didApprove = await askApproval("tool", JSON.stringify(sharedMessageProps))
		if (!didApprove) {
			pushToolResult(formatResponse.toolDenied())
			return
		}

		task.consecutiveMistakeCount = 0

		// Try 1: CodeIndexManager (standard path)
		let searchResults: VectorStoreSearchResult[] | null = null
		let usedDirectQdrant = false

		try {
			const context = task.providerRef.deref()?.context
			if (context) {
				const manager = CodeIndexManager.getInstance(context)
				if (manager && manager.isFeatureEnabled && manager.isFeatureConfigured) {
					searchResults = await manager.searchIndex(query, directoryPrefix)
				}
			}
		} catch (err) {
			console.warn("[codebase_search] CodeIndexManager failed:", err instanceof Error ? err.message : String(err))
		}

		// Try 2: Direct QdrantVectorStore (fallback if CodeIndexManager failed)
		if (!searchResults || searchResults.length === 0) {
			try {
				const config = vscode.workspace.getConfiguration("roo-code.codebaseIndex")
				const qdrantUrl = config.get<string>("qdrantUrl", "http://localhost:6333")
				const qdrantApiKey = config.get<string>("qdrantApiKey")
				const modelId = config.get<string>("embeddingModelId")
				const openAiKey = config.get<string>("openAiKey") || config.get<string>("openRouterKey", "")
				const baseUrl = config.get<string>("openAiCompatibleBaseUrl", "https://api.openai.com/v1")

				// Use default vector size 1024 (common for text-embedding-3-small, Qwen3, etc.)
				const vectorSize: number = 1024

				const vectorStore = new QdrantVectorStore(workspacePath, qdrantUrl, vectorSize, qdrantApiKey)
				await vectorStore.initialize()

				// Create embedder for the query
				const embedder = new OpenAICompatibleEmbedder(baseUrl, openAiKey, modelId || undefined)
				const { embeddings } = await embedder.createEmbeddings([query])
				const queryVector = embeddings[0]

				if (queryVector) {
					const directResults = await vectorStore.search(queryVector, directoryPrefix)
					if (directResults && directResults.length > 0) {
						searchResults = directResults
						usedDirectQdrant = true
					}
				}
			} catch (qdrantErr) {
				console.warn("[codebase_search] Direct Qdrant access failed:", qdrantErr instanceof Error ? qdrantErr.message : String(qdrantErr))
			}
		}

		// Try 3: Fallback — no results from either Qdrant or CodeIndexManager
		if (!searchResults || searchResults.length === 0) {
			pushToolResult(`No relevant code snippets found for the query: "${query}"`)
			return
		}

		// Format and output results
		const jsonResult = {
			query,
			results: [],
		} as {
			query: string
			results: Array<{
				filePath: string
				score: number
				startLine: number
				endLine: number
				codeChunk: string
			}>
		}

		searchResults.forEach((result) => {
			if (!result.payload) return
			if (!("filePath" in result.payload)) return

			const relativePath = vscode.workspace.asRelativePath(result.payload.filePath, false)

			jsonResult.results.push({
				filePath: relativePath,
				score: result.score,
				startLine: result.payload.startLine,
				endLine: result.payload.endLine,
				codeChunk: result.payload.codeChunk.trim(),
			})
		})

		const payload = { tool: "codebaseSearch", content: jsonResult, directQdrant: usedDirectQdrant }
		await task.say("codebase_search_result", JSON.stringify(payload))

		const output = `Query: ${query}
Results:

${jsonResult.results
	.map(
		(result) => `File path: ${result.filePath}
Score: ${result.score}
Lines: ${result.startLine}-${result.endLine}
Code Chunk: ${result.codeChunk}
`,
	)
	.join("\n")}`

		pushToolResult(output)
	}

	override async handlePartial(task: Task, block: ToolUse<"codebase_search">): Promise<void> {
		const query: string | undefined = block.params.query
		const directoryPrefix: string | undefined = block.params.path

		const sharedMessageProps = {
			tool: "codebaseSearch",
			query: query,
			path: directoryPrefix,
			isOutsideWorkspace: false,
		}

		await task.ask("tool", JSON.stringify(sharedMessageProps), block.partial).catch(() => {})
	}
}

export const codebaseSearchTool = new CodebaseSearchTool()
