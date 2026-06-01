import { type PromptAnalysis, type ComplexityLevel, type TaskType, type ModelSelectionConfig } from "./types"
import { estimateTokenCount, shrinkPrompt } from "./prompt-adapter"

const ANALYZER_SYSTEM_PROMPT = `Analyze the following user prompt and return a strictly valid JSON object with no markdown formatting, no code blocks, and no extra text.

Required JSON schema:
{
  "complexity": "low|medium|high|very_high",
  "taskType": "tagging|summarization|translation|code|reasoning|general",
  "temperature": number,
  "estimatedOutputTokens": number
}

Evaluation criteria:
- complexity: low = simple factual question; medium = multi-step instructions; high = analysis, debugging, or moderate code; very_high = architecture, deep reasoning, complex math.
- taskType: infer from the primary intent of the prompt.
- temperature: lower (0.1-0.3) for code/tagging/translation; medium (0.4-0.6) for analysis/summarization; higher (0.6-0.8) for creative reasoning or open-ended tasks.
- estimatedOutputTokens: approximate expected response length in tokens (1 token ~= 4 English characters).`

export interface PromptAnalyzerClient {
	completePrompt(prompt: string): Promise<string>
}

export class PromptAnalyzer {
	private client: PromptAnalyzerClient

	constructor(client: PromptAnalyzerClient) {
		this.client = client
	}

	async analyze(enrichedPrompt: string): Promise<PromptAnalysis> {
		const prompt = `${ANALYZER_SYSTEM_PROMPT}\n\nPrompt to analyze:\n"""\n${enrichedPrompt}\n"""`
		const response = await this.client.completePrompt(prompt)

		return this.parseResponse(response.trim())
	}

	async analyzeWithModelAwareness(
		enrichedPrompt: string,
		availableModels: ModelSelectionConfig[],
	): Promise<{ analysis: PromptAnalysis; adaptedPrompt?: string; cdi?: number }> {
		const promptTokens = estimateTokenCount(enrichedPrompt)

		const availableModelsFiltered = availableModels.filter((m) => m.availability)
		const bestModel = availableModelsFiltered.length > 0
			? availableModelsFiltered.reduce((best, m) => {
				const currentLimit = m.effectiveContextLimit ?? Math.floor(m.contextWindow * 0.70)
				const bestLimit = best ? (best.effectiveContextLimit ?? Math.floor(best.contextWindow * 0.70)) : 0
				if (currentLimit > bestLimit) return m
				return best
			}, undefined as ModelSelectionConfig | undefined)
			: undefined

		let adaptedPrompt: string | undefined
		let cdi: number | undefined

		if (bestModel) {
			const effectiveLimit = bestModel.effectiveContextLimit ?? Math.floor(bestModel.contextWindow * 0.70)
			cdi = effectiveLimit / bestModel.contextWindow

			if (promptTokens > effectiveLimit) {
				const targetTokens = effectiveLimit
				adaptedPrompt = shrinkPrompt(enrichedPrompt, { targetTokens, strategy: "middle" })
				console.log(
					`[PromptAnalyzer] promptTokens=${promptTokens} > effectiveLimit=${effectiveLimit} (CDI=${cdi?.toFixed(2)}), shrunk to ${estimateTokenCount(adaptedPrompt)}`,
				)
			}
		}

		const promptToAnalyze = adaptedPrompt || enrichedPrompt
		const analysis = await this.analyze(promptToAnalyze)

		return { analysis, adaptedPrompt, cdi }
	}

	private parseResponse(raw: string): PromptAnalysis {
		const jsonText = raw
			.replace(/^```(?:json)?\s*/, "")
			.replace(/\s*```$/, "")
			.trim()

		let parsed: unknown
		try {
			parsed = JSON.parse(jsonText)
		} catch {
			throw new Error(`PromptAnalyzer: invalid JSON response: ${raw.slice(0, 200)}`)
		}

		if (!isPromptAnalysisLike(parsed)) {
			throw new Error(`PromptAnalyzer: response does not match expected schema: ${jsonText.slice(0, 200)}`)
		}

		return validatePromptAnalysis(parsed as Record<string, unknown>)
	}
}

function isPromptAnalysisLike(v: unknown): v is Record<string, unknown> {
	return (
		typeof v === "object" &&
		v !== null &&
		"complexity" in v &&
		"taskType" in v &&
		"temperature" in v &&
		"estimatedOutputTokens" in v
	)
}

function clamp(n: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, n))
}

const VALID_COMPLEXITIES: ComplexityLevel[] = ["low", "medium", "high", "very_high"]
const VALID_TASK_TYPES: TaskType[] = ["tagging", "summarization", "translation", "code", "reasoning", "general"]

export function validatePromptAnalysis(raw: Record<string, unknown>): PromptAnalysis {
	const complexity = (raw.complexity as string) ?? "medium"
	const taskType = (raw.taskType as string) ?? "general"
	const temperature = typeof raw.temperature === "number" ? raw.temperature : 0.7
	const estimatedOutputTokens = typeof raw.estimatedOutputTokens === "number" ? raw.estimatedOutputTokens : 1024

	const normalizedComplexity: ComplexityLevel = VALID_COMPLEXITIES.includes(complexity as ComplexityLevel)
		? (complexity as ComplexityLevel)
		: "medium"

	const normalizedTaskType: TaskType = VALID_TASK_TYPES.includes(taskType as TaskType)
		? (taskType as TaskType)
		: "general"

	return {
		complexity: normalizedComplexity,
		taskType: normalizedTaskType,
		temperature: clamp(temperature, 0, 1),
		estimatedOutputTokens: Math.max(1, Math.floor(estimatedOutputTokens)),
	}
}
