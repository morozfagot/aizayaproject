using AiZaya.Shared.Domain.Abstractions;

namespace AiZaya.Modules.SessionHistory.Domain.Chunks.Events;

/// <summary>
/// IndexClearedDomainEvent — индекс очищен в текущей размерности (кнопка "Очистить").
/// </summary>
public sealed record IndexClearedDomainEvent(
    string SessionId,
    int Dimension,
    int ChunksDeleted,
    DateTime ClearedAt) : DomainEvent;