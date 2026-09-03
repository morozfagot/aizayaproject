using AiZaya.Shared.Domain.Abstractions;
using AiZaya.Shared.Domain.Results;
using AiZaya.Modules.Embedders.Domain.Providers;
using AiZaya.Modules.Embedders.Domain.Embedders.Events;

namespace AiZaya.Modules.Embedders.Domain.Embedders;

public sealed partial class Embedder : AggregateRoot<EmbedderId>
{
    public ProviderId ProviderId { get; private set; } = null!;
    public ModelName ModelName { get; private set; } = null!;
    public VectorDimension Dimension { get; private set; } = null!;
    public bool IsActive { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime? DeactivatedAtUtc { get; private set; }

    private Embedder()
    {
    }

    public static Result<Embedder> Create(
        ProviderId providerId,
        ModelName modelName,
        VectorDimension dimension,
        DateTime nowUtc)
    {
        var rule = Rule.CreateBuilder()
            .ErrorIf(nameof(Embedder), providerId is null, "ProviderId должен быть указан")
            .ErrorIf(nameof(Embedder), modelName is null, "ModelName должен быть указан")
            .ErrorIf(nameof(Embedder), dimension is null, "VectorDimension должен быть указан")
            .Build();

        if (rule.IsFailure)
        {
            return rule.Error;
        }

        var embedder = new Embedder
        {
            Id = EmbedderId.Create(),
            ProviderId = providerId!,
            ModelName = modelName!,
            Dimension = dimension!,
            IsActive = true,
            CreatedAtUtc = nowUtc
        };

        embedder.Raise(new EmbedderAddedDomainEvent(
            embedder.Id.Value,
            embedder.ProviderId.Value,
            embedder.ModelName.Value,
            embedder.Dimension.Value,
            nowUtc));

        return embedder;
    }

    public Result Deactivate(DateTime nowUtc)
    {
        if (!IsActive)
        {
            return EmbedderErrors.Disabled(Id);
        }

        IsActive = false;
        DeactivatedAtUtc = nowUtc;
        Raise(new EmbedderDeactivatedDomainEvent(Id.Value, ProviderId.Value, nowUtc));
        return Result.Success();
    }

    public Result Activate(DateTime nowUtc)
    {
        if (IsActive)
        {
            return Result.Success();
        }

        IsActive = true;
        DeactivatedAtUtc = null;
        Raise(new EmbedderActivatedDomainEvent(Id.Value, ProviderId.Value, nowUtc));
        return Result.Success();
    }

    private IEnumerable<object> GetComparisonValues() => [Id];
}

public partial class Embedder : IEquatable<Embedder>
{
    public bool Equals(Embedder? other)
    {
        if (other is null) return false;
        if (ReferenceEquals(this, other)) return true;
        return GetComparisonValues().SequenceEqual(other.GetComparisonValues());
    }

    public override bool Equals(object? obj) => obj is Embedder other && Equals(other);

    public override int GetHashCode()
    {
        var hash = new HashCode();
        foreach (var component in GetComparisonValues())
        {
            hash.Add(component.GetHashCode());
        }
        return hash.ToHashCode();
    }

    public static bool operator ==(Embedder? left, Embedder? right)
    {
        if (left is null) return right is null;
        return left.Equals(right);
    }

    public static bool operator !=(Embedder? left, Embedder? right) => !(left == right);
}