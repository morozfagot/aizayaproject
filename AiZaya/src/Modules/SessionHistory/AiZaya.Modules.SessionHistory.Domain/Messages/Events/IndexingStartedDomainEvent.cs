using AiZaya.Shared.Domain.Abstractions;

namespace AiZaya.Modules.SessionHistory.Domain.Messages.Events;

/// <summary>
/// IndexingStartedDomainEvent — индексация запущена.
/// Единая точка вызова эмбеддера: публикуется из хендлера SessionChunkCreatedDomainEvent
/// (чанк создан → индексируем его текст) и при нажатии кнопки "Начать" (легаси).
/// </summary>
public sealed record IndexingStartedDomainEvent(
    string MessageId,
    string SessionId,
    int Dimension,
    DateTime StartedAt) : DomainEvent;