using AiZaya.Shared.Domain.Abstractions.Interfaces;

namespace AiZaya.Shared.Domain.Abstractions;

public abstract class Entity<TId> : IEntity where TId : notnull
{
    public TId Id { get; protected set; } = default!;
}
