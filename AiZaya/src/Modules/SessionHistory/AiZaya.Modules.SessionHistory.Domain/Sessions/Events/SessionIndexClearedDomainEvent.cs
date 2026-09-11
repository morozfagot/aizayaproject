using AiZaya.Shared.Domain.Abstractions;

namespace AiZaya.Modules.SessionHistory.Domain.Sessions.Events;

/// <summary>
/// SessionIndexClearedDomainEvent — индекс сессии очищен в размерности.
/// Конкретное событие (вместо универсального SessionStateChanged).
/// </summary>
public sealed record SessionIndexClearedDomainEvent(
    string SessionId,
    int Dimension,
    DateTime Timestamp) : DomainEvent;