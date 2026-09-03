using AiZaya.Shared.Domain.Abstractions;

namespace AiZaya.Modules.Embedders.Domain.Providers.Events;

public sealed record ProviderConfiguredDomainEvent(
    Guid ProviderId,
    string ProviderType,
    DateTime OccurredOnUtc) : DomainEvent;