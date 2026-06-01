export {
	type ApiMessage,
	type TaggedApiMessage,
	type RelevanceTags,
	type MessageFragment,
	readApiMessages,
	saveApiMessages,
} from "./apiMessages"
export { readTaskMessages, saveTaskMessages } from "./taskMessages"
export { taskMetadata } from "./taskMetadata"
export { TaskHistoryStore } from "./TaskHistoryStore"
export {
	type TagIndex,
	type ChunkIndexEntry,
	createEmptyTagIndex,
	addTagToIndex,
	removeTagFromIndex,
	lookupTags,
	addChunkToIndex,
	removeChunkFromIndex,
	lookupChunksByTag,
	findChunksByAllTags,
	findChunksByScore,
	buildTagIndex,
	readTagIndex,
	persistTagIndex,
} from "./tagIndex"
export {
	refactorAndTagMessage,
	extractMessageText,
	extractRelevantContext,
	buildRefactoringPrompt,
	parseLLMResponse,
	convertToMessageFragment,
	aggregateFragmentTags,
	saveMessagesWithIndex,
	type RefactoredFragment,
	type RefactorAndTagResult,
	type RefactorAndTagOptions,
} from "./messageRefactorer"
export {
	generatePromptTags,
	createPromptTaggerClient,
	type GeneratePromptTagsResult,
	type GeneratePromptTagsOptions,
} from "./promptTagger"
export { waitForRefactoringDone } from "./refactoringLock"
