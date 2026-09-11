using AiZaya.Shared.Domain.Abstractions;

namespace AiZaya.Modules.SessionHistory.Domain.Messages.Events;

/// <summary>
/// MessageCreatedDomainEvent — сообщение сохранено в номинальном хранилище.
/// Триггер создания чанков (индексация запускается через IndexingStartedDomainEvent
/// из хендлера SessionChunkCreatedDomainEvent — единый вызов эмбеддера).
/// </summary>
public sealed record MessageCreatedDomainEvent(
    string MessageId,
    string SessionId,
    string Source,
    int Role,
    int Kind,
    string ContentHash,
    DateTime Timestamp,
    string? Mode,
    string? ParentMessageId) : DomainEvent;