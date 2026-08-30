namespace AiZaya.Shared.Domain.Abstractions.Interfaces;

public interface IEntity;

public interface IEntity<out TId> : IEntity where TId : IValueObject
{
    TId Id { get; }
}
