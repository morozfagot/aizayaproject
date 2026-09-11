using AiZaya.Shared.Domain.Abstractions;

namespace AiZaya.Modules.SessionHistory.Domain.Messages.Events;

/// <summary>
/// MessageIndexedDomainEvent — сообщение проиндексировано в размерности.
/// </summary>
public sealed record MessageIndexedDomainEvent(
    string MessageId,
    string SessionId,
    int Dimension,
    DateTime IndexedAt) : DomainEvent;