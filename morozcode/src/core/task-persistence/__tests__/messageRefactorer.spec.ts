// pnpm --filter roo-cline test core/task-persistence/__tests__/messageRefactorer.spec.ts

import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"

import type { ApiHandler } from "../../../api"
import type { ApiStream } from "../../../api/transform/stream"
import type { ApiMessage } from "../apiMessages"
import { GlobalFileNames } from "../../../shared/globalFileNames"

// Mock safeWriteJson to use plain fs writes in tests
vi.mock("../../../utils/safeWriteJson", () => ({
	safeWriteJson: vi.fn().mockImplementation(async (filePath: string, data: any) => {
		await fs.mkdir(path.dirname(filePath), { recursive: true })
		await fs.writeFile(filePath, JSON.stringify(data, null, "\t"), "utf8")
	}),
}))

// Mock getTaskDirectoryPath
vi.mock("../../../utils/storage", () => ({
	getStorageBasePath: vi.fn().mockImplementation((defaultPath: string) => defaultPath),
	getTaskDirectoryPath: vi.fn().mockImplementation(async (globalStoragePath: string, taskId: string) => {
		const taskDir = path.join(globalStoragePath, "tasks", taskId)
		await fs.mkdir(taskDir, { recursive: true })
		return taskDir
	}),
}))

import { refactorAndTagMessage } from "../messageRefactorer"

function createMockApiHandler(responseText: string): ApiHandler {
	return {
		createMessage: vi.fn().mockImplementation((): ApiStream => {
			async function* generator() {
				yield { type: "text" as const, text: responseText }
			}
			return generator()
		}),
		getModel: vi.fn().mockReturnValue({ id: "test-model", info: {} as any }),
		countTokens: vi.fn().mockResolvedValue(100),
	}
}

function makeApiMessage(role: "user" | "assistant", content: string, ts?: number): ApiMessage {
	return {
		role,
		content,
		ts: ts ?? Date.now(),
	}
}

describe("refactorAndTagMessage", () => {
	let tmpDir: string
	let taskId: string

	beforeEach(async () => {
		tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "refactor-test-"))
		taskId = `test-task-${Date.now()}`
	})

	afterEach(async () => {
		await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
	})

	it("should return fallback for empty message", async () => {
		const mockHandler = createMockApiHandler("")
		const message = makeApiMessage("assistant", "")
		const allMessages: ApiMessage[] = [
			makeApiMessage("user", "Hello"),
			message,
		]

		const result = await refactorAndTagMessage(
			message,
			1,
			allMessages,
			mockHandler,
			taskId,
			tmpDir,
		)

		expect(result.source).toBe("fallback")
		expect(result.fragments).toEqual([])
		expect(result.tags).toBeDefined()
	})

	it("should call LLM and parse response", async () => {
		const llmResponse = JSON.stringify({
			fragments: [
				{
					chunk_id: "test-chunk-1",
					text: "This is a test fragment",
					summary: "Test summary",
					tags: {
						direct: ["topic:test", "tool:read_file"],
						depends_on: [],
						depended_by: [],
						weights: { "topic:test": 0.9, "tool:read_file": 0.7 },
					},
				},
			],
		})

		const mockHandler = createMockApiHandler(llmResponse)
		const message = makeApiMessage("assistant", "Test message content for refactoring")
		const allMessages: ApiMessage[] = [
			makeApiMessage("user", "Hello"),
			message,
		]

		const result = await refactorAndTagMessage(
			message,
			1,
			allMessages,
			mockHandler,
			taskId,
			tmpDir,
		)

		// Verify LLM was called
		expect(mockHandler.createMessage).toHaveBeenCalledTimes(1)

		// Verify result structure
		expect(result).toBeDefined()
		expect(result.source).toBe("llm")
		expect(result.fragments.length).toBeGreaterThan(0)
		expect(result.tags).toBeDefined()
		expect(result.tags.direct.length).toBeGreaterThan(0)
	})

	it("should save tag index to disk", async () => {
		const llmResponse = JSON.stringify({
			fragments: [
				{
					chunk_id: "test-chunk-1",
					text: "Fragment about TypeScript",
					summary: "TypeScript discussion",
					tags: {
						direct: ["topic:typescript"],
						depends_on: [],
						depended_by: [],
						weights: { "topic:typescript": 0.9 },
					},
				},
			],
		})

		const mockHandler = createMockApiHandler(llmResponse)
		const message = makeApiMessage("assistant", "Let me explain TypeScript...")
		const allMessages: ApiMessage[] = [
			makeApiMessage("user", "What is TypeScript?"),
			message,
		]

		await refactorAndTagMessage(
			message,
			1,
			allMessages,
			mockHandler,
			taskId,
			tmpDir,
		)

		// Verify tag index file was created
		const taskDir = path.join(tmpDir, "tasks", taskId)
		const tagIndexPath = path.join(taskDir, GlobalFileNames.sessionTagIndex)

		const tagIndexExists = await fs.access(tagIndexPath).then(() => true).catch(() => false)
		expect(tagIndexExists).toBe(true)

		// Verify tag index content
		const tagIndexContent = await fs.readFile(tagIndexPath, "utf8")
		const tagIndex = JSON.parse(tagIndexContent)
		expect(tagIndex.version).toBe(1)
		expect(tagIndex.chunk_index).toBeDefined()
		expect(tagIndex.chunk_index["topic:typescript"]).toBeDefined()
	})

	it("should save updated messages with tags", async () => {
		const llmResponse = JSON.stringify({
			fragments: [
				{
					chunk_id: "test-chunk-1",
					text: "Fragment about React",
					summary: "React discussion",
					tags: {
						direct: ["topic:react", "library:react"],
						depends_on: [],
						depended_by: [],
						weights: { "topic:react": 0.9, "library:react": 0.8 },
					},
				},
			],
		})

		const mockHandler = createMockApiHandler(llmResponse)
		const message = makeApiMessage("assistant", "React is a library...")
		const allMessages: ApiMessage[] = [
			makeApiMessage("user", "Tell me about React"),
			message,
		]

		await refactorAndTagMessage(
			message,
			1,
			allMessages,
			mockHandler,
			taskId,
			tmpDir,
		)

		// Verify messages file was created/updated
		const taskDir = path.join(tmpDir, "tasks", taskId)
		const messagesPath = path.join(taskDir, GlobalFileNames.apiConversationHistory)

		const messagesExist = await fs.access(messagesPath).then(() => true).catch(() => false)
		expect(messagesExist).toBe(true)

		// Verify messages content has tags
		const messagesContent = await fs.readFile(messagesPath, "utf8")
		const messages = JSON.parse(messagesContent)
		expect(messages.length).toBe(2)
		expect(messages[1].relevance_tags).toBeDefined()
		expect(messages[1].fragments).toBeDefined()
	})
})
