using AiZaya.Shared.Domain.Abstractions.Interfaces;

namespace AiZaya.Shared.Domain.Abstractions;

public abstract class AggregateRootConcurrency<TId, TRowVersion> : AggregateRoot<TId>, IConcurrency<TRowVersion>
    where TId : IValueObject
    where TRowVersion : notnull

{
    public TRowVersion RowVersion { get; protected set; } = default!;
}
