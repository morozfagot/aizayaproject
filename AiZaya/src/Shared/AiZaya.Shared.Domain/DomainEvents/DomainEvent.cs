using AiZaya.Shared.Domain.Abstractions.Interfaces;

namespace AiZaya.Shared.Domain.Abstractions;

public abstract record DomainEvent : IDomainEvent
{
    protected DomainEvent()
    {
        Id = Guid.CreateVersion7();
        OccurredOnUtc = DateTime.UtcNow;
    }

    public Guid Id { get; init; }

    public DateTime OccurredOnUtc { get; init; }
}
