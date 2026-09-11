using AiZaya.Shared.Domain.Abstractions;

namespace AiZaya.Modules.SessionHistory.Domain.Messages.Events;

/// <summary>
/// IndexingCompletedDomainEvent — индексация завершена успешно.
/// </summary>
public sealed record IndexingCompletedDomainEvent(
    string MessageId,
    string SessionId,
    int Dimension,
    int ChunksCreated,
    DateTime CompletedAt) : DomainEvent;