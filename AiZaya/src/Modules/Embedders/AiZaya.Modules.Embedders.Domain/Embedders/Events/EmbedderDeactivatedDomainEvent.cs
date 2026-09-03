using AiZaya.Shared.Domain.Abstractions;

namespace AiZaya.Modules.Embedders.Domain.Embedders.Events;

public sealed record EmbedderDeactivatedDomainEvent(
    Guid EmbedderId,
    Guid ProviderId,
    DateTime OccurredOnUtc) : DomainEvent;