namespace AiZaya.Shared.Domain.Abstractions.Interfaces;

public interface IAggregateRoot
{
    IReadOnlyCollection<IDomainEvent> DomainEvents { get; }

    IReadOnlyCollection<IDomainEvent> PopDomainEvents();
}
