namespace AiZaya.Shared.Feature.Embeddings;

/// <summary>
/// Универсальная конфигурация эмбеддера в POCO-форме.
/// Не зависит от домена Embedders. Формируется модулем-владельцем (SessionHistory / Workspace)
/// из дублированной интеграционными событиями конфигурации домена Embedders.
/// </summary>
/// <param name="ProviderType">
/// Тип провайдера. Используется в shared infrastructure для выбора адаптера.
/// </param>
/// <param name="BaseUrl">Базовый URL API провайдера.</param>
/// <param name="ApiKey">API-ключ (опционально — Ollama его не требует).</param>
/// <param name="ModelName">Имя модели эмбеддингов у провайдера.</param>
/// <param name="VectorDimension">Размерность выходного вектора.</param>
/// <param name="TimeoutMs">Таймаут HTTP-запроса в миллисекундах.</param>
/// <param name="TokensPerMinute">Лимит токенов в минуту (опционально).</param>
/// <param name="RequestsPerMinute">Лимит запросов в минуту (опционально).</param>
public sealed record EmbedderProviderConfig(
    ProviderType ProviderType,
    string BaseUrl,
    string? ApiKey,
    string ModelName,
    int VectorDimension,
    int TimeoutMs,
    int? TokensPerMinute,
    int? RequestsPerMinute);