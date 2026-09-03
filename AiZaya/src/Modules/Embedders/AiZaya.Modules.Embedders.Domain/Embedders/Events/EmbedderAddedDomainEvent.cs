using AiZaya.Shared.Domain.Abstractions;

namespace AiZaya.Modules.Embedders.Domain.Embedders.Events;

public sealed record EmbedderAddedDomainEvent(
    Guid EmbedderId,
    Guid ProviderId,
    string ModelName,
    int Dimension,
    DateTime OccurredOnUtc) : DomainEvent;