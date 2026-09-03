using AiZaya.Shared.Domain.Abstractions;

namespace AiZaya.Modules.Embedders.Domain.Providers.Events;

public sealed record ProviderUpdatedDomainEvent(
    Guid ProviderId,
    DateTime OccurredOnUtc) : DomainEvent;