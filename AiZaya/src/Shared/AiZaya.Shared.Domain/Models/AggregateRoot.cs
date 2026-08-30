using AiZaya.Shared.Domain.Abstractions.Interfaces;

namespace AiZaya.Shared.Domain.Abstractions;

public abstract class AggregateRoot<TId> : Entity<TId>, IAggregateRoot
    where TId : IValueObject
{
    private readonly List<IDomainEvent> _domainEvents = [];

    public IReadOnlyCollection<IDomainEvent> DomainEvents => _domainEvents.AsReadOnly();

    public IReadOnlyCollection<IDomainEvent> PopDomainEvents()
    {
        var result = _domainEvents.ToArray();
        _domainEvents.Clear();

        return result;
    }

    protected void Raise(IDomainEvent domainEvent)
    {
        _domainEvents.Add(domainEvent);
    }
}
