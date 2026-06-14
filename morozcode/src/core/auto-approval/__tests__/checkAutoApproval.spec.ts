import { checkAutoApproval } from "../index"

describe("checkAutoApproval — command with alwaysAllowExecute", () => {
	const baseState: any = {
		autoApprovalEnabled: true,
		alwaysAllowExecute: true,
	}

	it("should approve any command when alwaysAllowExecute is true and no denylist", async () => {
		const result = await checkAutoApproval({
			state: baseState,
			ask: "command",
			text: "rm -rf /some/path",
		})
		expect(result.decision).toBe("approve")
	})

	it("should approve unknown command not in any list", async () => {
		const result = await checkAutoApproval({
			state: baseState,
			ask: "command",
			text: "custom-tool --flag value",
		})
		expect(result.decision).toBe("approve")
	})

	it("should approve command that was previously only in allowlist", async () => {
		const result = await checkAutoApproval({
			state: {
				...baseState,
				allowedCommands: ["npm", "git"],
			},
			ask: "command",
			text: "docker build -t myimage .",
		})
		expect(result.decision).toBe("approve")
	})

	it("should deny command in denylist even when alwaysAllowExecute is true", async () => {
		const result = await checkAutoApproval({
			state: {
				...baseState,
				deniedCommands: ["rm -rf", "sudo"],
			},
			ask: "command",
			text: "rm -rf /",
		})
		expect(result.decision).toBe("deny")
	})

	it("should deny command matching denylist prefix", async () => {
		const result = await checkAutoApproval({
			state: {
				...baseState,
				deniedCommands: ["sudo"],
			},
			ask: "command",
			text: "sudo apt update",
		})
		expect(result.decision).toBe("deny")
	})

	it("should approve command not matching denylist", async () => {
		const result = await checkAutoApproval({
			state: {
				...baseState,
				deniedCommands: ["rm -rf"],
			},
			ask: "command",
			text: "npm install",
		})
		expect(result.decision).toBe("approve")
	})

	it("should approve when denylist is empty", async () => {
		const result = await checkAutoApproval({
			state: {
				...baseState,
				deniedCommands: [],
			},
			ask: "command",
			text: "any-command --anything",
		})
		expect(result.decision).toBe("approve")
	})

	it("should ask when alwaysAllowExecute is false", async () => {
		const result = await checkAutoApproval({
			state: {
				autoApprovalEnabled: true,
				alwaysAllowExecute: false,
				allowedCommands: ["npm"],
			} as any,
			ask: "command",
			text: "docker ps",
		})
		expect(result.decision).toBe("ask")
	})

	it("should ask when text is empty", async () => {
		const result = await checkAutoApproval({
			state: baseState,
			ask: "command",
			text: "",
		})
		expect(result.decision).toBe("ask")
	})

	it("should ask when autoApprovalEnabled is false", async () => {
		const result = await checkAutoApproval({
			state: {
				...baseState,
				autoApprovalEnabled: false,
			},
			ask: "command",
			text: "npm install",
		})
		expect(result.decision).toBe("ask")
	})

	it("should approve complex command chains when alwaysAllowExecute is true", async () => {
		const result = await checkAutoApproval({
			state: baseState,
			ask: "command",
			text: "cd /tmp && wget https://example.com/file.tar.gz && tar xzf file.tar.gz",
		})
		expect(result.decision).toBe("approve")
	})

	it("should deny if any sub-command matches denylist", async () => {
		const result = await checkAutoApproval({
			state: {
				...baseState,
				deniedCommands: ["wget"],
			},
			ask: "command",
			text: "cd /tmp && wget https://example.com/file.tar.gz",
		})
		expect(result.decision).toBe("deny")
	})
})
