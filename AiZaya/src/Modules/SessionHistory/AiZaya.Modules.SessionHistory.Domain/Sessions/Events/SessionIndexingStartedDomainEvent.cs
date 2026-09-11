using AiZaya.Shared.Domain.Abstractions;

namespace AiZaya.Modules.SessionHistory.Domain.Sessions.Events;

/// <summary>
/// SessionIndexingStartedDomainEvent — в сессии началась индексация.
/// Конкретное событие (не универсальное SessionStateChanged).
/// </summary>
public sealed record SessionIndexingStartedDomainEvent(
    string SessionId,
    DateTime Timestamp) : DomainEvent;