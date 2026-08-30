namespace AiZaya.Shared.Domain.Abstractions.Interfaces;

public interface IDomainEvent
{
    Guid Id { get; }
    DateTime OccurredOnUtc { get; }
}
