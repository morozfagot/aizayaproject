namespace AiZaya.Shared.Feature.Embeddings;

/// <summary>
/// Универсальный контракт компонента генерации эмбеддингов.
/// Реализация в <c>AiZaya.Shared.Infrastructure</c> маршрутизирует запрос к нужному per-provider обработчику
/// на основе <see cref="EmbedderProviderConfig.ProviderType"/>.
/// </summary>
public interface IEmbeddingGenerator
{
    /// <summary>
    /// Генерирует эмбеддинги для каждого входного текста.
    /// Ключ возвращаемого словаря — это входная строка, значение — её вектор.
    /// Размер каждого вектора равен <see cref="EmbedderProviderConfig.VectorDimension"/>.
    /// </summary>
    Task<IReadOnlyDictionary<string, IReadOnlyList<float>>> GenerateAsync(
        EmbedderProviderConfig config,
        IReadOnlyList<string> inputs,
        CancellationToken cancellationToken = default);
}