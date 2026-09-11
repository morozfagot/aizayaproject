using AiZaya.Modules.SessionHistory.Domain.Messages;
using AiZaya.Modules.SessionHistory.Domain.Sessions;

namespace AiZaya.Modules.SessionHistory.Domain.Chunks;

/// <summary>
/// IVectorChunkRepository — ВЕКТОРНЫЙ репозиторий чанков (Qdrant).
/// Коллекция = chunk.Source.Value (payload["source"]), размерность из вектора.
/// Вызывается из хендлера события создания чанка: чанк создан (номинально) →
/// индексация (эмбеддинг) → сохранение вектора + метаданных чанка в Qdrant.
/// БЕЗ Result pattern: plain types, исключения при ошибках.
/// RRR-цикл (SearchByVector) — в Orchestrator BC (15.8), здесь его нет.
/// </summary>
public interface IVectorChunkRepository
{
    /// <summary>
    /// Сохраняет чанк + вектор в Qdrant. Вектор transient — не поле агрегата.
    /// </summary>
    void Add(Chunk chunk, IReadOnlyList<float> vector);

    void Delete(ChunkId id);

    Task DeleteByMessageIdAsync(MessageId messageId, CancellationToken cancellationToken);

    Task DeleteBySessionIdAsync(SessionId sessionId, CancellationToken cancellationToken);

    /// <summary>
    /// "Очистить индекс" — удаление чанков в размерности (без привязки к сессии).
    /// </summary>
    Task DeleteByDimensionAsync(int dimension, CancellationToken cancellationToken);
}