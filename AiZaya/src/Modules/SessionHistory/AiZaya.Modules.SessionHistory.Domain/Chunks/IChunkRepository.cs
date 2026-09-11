using AiZaya.Modules.SessionHistory.Domain.Messages;
using AiZaya.Modules.SessionHistory.Domain.Sessions;

namespace AiZaya.Modules.SessionHistory.Domain.Chunks;

/// <summary>
/// IChunkRepository — репозиторий чанков (НОМИНАЛЬНОЕ хранилище).
/// Сюда сохраняются чанки после чанкования (агрегат Chunk).
/// БЕЗ Result pattern: plain types, null если не найдено, исключения при ошибках.
/// Вектор НЕ хранится здесь — он transient, сохраняется в IVectorChunkRepository
/// (векторное хранилище) из хендлера события создания чанка.
/// </summary>
public interface IChunkRepository
{
    Task<Chunk?> GetByIdAsync(ChunkId id, CancellationToken cancellationToken);

    Task<IReadOnlyList<Chunk>> GetBySessionIdAsync(SessionId sessionId, CancellationToken cancellationToken);

    Task<IReadOnlyList<Chunk>> GetByMessageIdAsync(MessageId messageId, CancellationToken cancellationToken);

    void Add(Chunk chunk);

    void Delete(ChunkId id);

    Task<int> CountBySessionIdAsync(SessionId sessionId, CancellationToken cancellationToken);
}