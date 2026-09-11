using AiZaya.Shared.Domain.Abstractions;

namespace AiZaya.Modules.SessionHistory.Domain.Sessions.Events;

/// <summary>
/// SessionIndexedDomainEvent — сессия полностью проиндексирована в размерности.
/// Конкретное событие (вместо универсального SessionStateChanged).
/// </summary>
public sealed record SessionIndexedDomainEvent(
    string SessionId,
    int Dimension,
    DateTime Timestamp) : DomainEvent;