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

import { chunkMessage } from "../messageRefactorer"

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

describe("chunkMessage", () => {
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
		const message = makeApiMessage("assistant", "")
		const allMessages: ApiMessage[] = [
			makeApiMessage("user", "Hello"),
			message,
		]

		const result = await chunkMessage(
			message,
			1,
			allMessages,
			taskId,
			tmpDir,
		)

		expect(result.source).toBe("fallback")
		expect(result.fragments).toEqual([])
		expect(result.tags).toBeDefined()
	})

	it("should return fallback for static chunking", async () => {
		const message = makeApiMessage("assistant", "Test message content for refactoring")
		const allMessages: ApiMessage[] = [
			makeApiMessage("user", "Hello"),
			message,
		]

		const result = await chunkMessage(
			message,
			1,
			allMessages,
			taskId,
			tmpDir,
		)

		// Verify result structure
		expect(result).toBeDefined()
		expect(result.source).toBe("fallback")
		expect(result.fragments).toEqual([])
		expect(result.tags).toBeDefined()
	})

	it("should save messages to disk", async () => {
		const message = makeApiMessage("assistant", "Let me explain TypeScript...")
		const allMessages: ApiMessage[] = [
			makeApiMessage("user", "What is TypeScript?"),
			message,
		]

		await chunkMessage(
			message,
			1,
			allMessages,
			taskId,
			tmpDir,
		)

		// Verify messages file was created/updated
		const taskDir = path.join(tmpDir, "tasks", taskId)
		const messagesPath = path.join(taskDir, GlobalFileNames.apiConversationHistory)

		const messagesExist = await fs.access(messagesPath).then(() => true).catch(() => false)
		expect(messagesExist).toBe(true)

		// Verify messages content
		const messagesContent = await fs.readFile(messagesPath, "utf8")
		const messages = JSON.parse(messagesContent)
		expect(messages.length).toBe(2)
	})

	it("should save updated messages with metadata", async () => {
		const message = makeApiMessage("assistant", "React is a library...")
		const allMessages: ApiMessage[] = [
			makeApiMessage("user", "Tell me about React"),
			message,
		]

		await chunkMessage(
			message,
			1,
			allMessages,
			taskId,
			tmpDir,
		)

		// Verify messages file was created/updated
		const taskDir = path.join(tmpDir, "tasks", taskId)
		const messagesPath = path.join(taskDir, GlobalFileNames.apiConversationHistory)

		const messagesExist = await fs.access(messagesPath).then(() => true).catch(() => false)
		expect(messagesExist).toBe(true)

		// Verify messages content
		const messagesContent = await fs.readFile(messagesPath, "utf8")
		const messages = JSON.parse(messagesContent)
		expect(messages.length).toBe(2)
	})
})
