namespace AiZaya.Modules.SessionHistory.Domain.Sessions;

/// <summary>
/// ISessionRepository — репозиторий сессий (номинальное хранилище, TBD).
/// </summary>
public interface ISessionRepository
{
    Task<Session?> GetByIdAsync(SessionId sessionId, CancellationToken cancellationToken);

    Task<IReadOnlyList<Session>> GetAllAsync(CancellationToken cancellationToken);

    Task<IReadOnlyList<Session>> GetByStateAsync(SessionState state, CancellationToken cancellationToken);

    void Add(Session session);

    void Update(Session session);

    /// <summary>
    /// Удаление сессии + всех её чанков (из Qdrant).
    /// </summary>
    Task DeleteBySessionIdAsync(SessionId sessionId, CancellationToken cancellationToken);

    Task<SessionStateSummary> GetStateSummaryAsync(SessionId sessionId, CancellationToken cancellationToken);
}

public record SessionStateSummary
{
    public SessionId SessionId { get; init; }
    public SessionState State { get; init; }
    public int TotalMessages { get; init; }
    public int IndexedMessages { get; init; }
    public int PendingMessages { get; init; }
    public int ErrorMessages { get; init; }
    public int CurrentDimension { get; init; }
    public DateTime? LastIndexedAt { get; init; }
}