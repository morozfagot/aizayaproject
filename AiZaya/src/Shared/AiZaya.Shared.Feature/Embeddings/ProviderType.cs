namespace AiZaya.Shared.Feature.Embeddings;

/// <summary>
/// Тип провайдера эмбеддингов. Используется в shared infrastructure для дискриминации адаптеров.
/// Не зависит от домена Embedders: конкретные провайдеры (OpenAI, OpenRouter, Ollama) могут шарить
/// один адаптер, если они используют один и тот же протокол (например, OpenAI-совместимый REST).
/// </summary>
public enum ProviderType
{
    /// <summary>Любой OpenAI-совместимый endpoint: OpenAI, OpenRouter, Ollama (OpenAI-mode), vLLM, LM Studio.</summary>
    OpenAiCompatible = 0,
}