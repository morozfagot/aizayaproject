using AiZaya.Modules.SessionHistory.Domain.Sessions;

namespace AiZaya.Modules.SessionHistory.Domain.Messages;

/// <summary>
/// IMessageRepository — репозиторий сообщений (номинальное хранилище, TBD).
/// БЕЗ Result pattern: plain types, null если не найдено, исключения при ошибках.
/// </summary>
public interface IMessageRepository
{
    Task<Message?> GetByIdAsync(MessageId id, CancellationToken cancellationToken);

    Task<IReadOnlyList<Message>> GetBySessionIdAsync(SessionId sessionId, CancellationToken cancellationToken);

    Task<Message?> GetLatestBySessionIdAsync(SessionId sessionId, CancellationToken cancellationToken);

    void Add(Message message);

    /// <summary>
    /// Удаление сообщения + всех его чанков (из Qdrant).
    /// </summary>
    Task DeleteByMessageIdAsync(MessageId messageId, CancellationToken cancellationToken);

    Task<IReadOnlyList<Message>> GetNotIndexedInDimensionAsync(
        SessionId sessionId,
        int dimension,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<Message>> GetWithIndexingStatusAsync(
        SessionId sessionId,
        IndexingStatus status,
        CancellationToken cancellationToken);
}