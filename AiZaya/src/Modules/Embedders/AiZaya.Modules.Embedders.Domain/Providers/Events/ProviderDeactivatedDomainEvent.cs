using AiZaya.Shared.Domain.Abstractions;

namespace AiZaya.Modules.Embedders.Domain.Providers.Events;

public sealed record ProviderDeactivatedDomainEvent(
    Guid ProviderId,
    DateTime OccurredOnUtc) : DomainEvent;