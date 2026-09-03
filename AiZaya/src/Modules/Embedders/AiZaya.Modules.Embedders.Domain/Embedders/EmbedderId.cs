using AiZaya.Shared.Domain.Abstractions.Interfaces;

namespace AiZaya.Modules.Embedders.Domain.Embedders;

public sealed partial class EmbedderId : IValueObject
{
    private EmbedderId()
    {
    }

    public Guid Value { get; private set; }

    public static EmbedderId Create() => new() { Value = Guid.CreateVersion7() };

    public static EmbedderId Create(Guid value) => new() { Value = value };

    private IEnumerable<object> GetComparisonValues() => [Value];

    public static explicit operator EmbedderId(Guid value) => new() { Value = value };

    public override string ToString() => Value.ToString();
}

public partial class EmbedderId : IEquatable<EmbedderId>
{
    public bool Equals(EmbedderId? other)
    {
        if (other is null) return false;
        return GetComparisonValues().SequenceEqual(other.GetComparisonValues());
    }

    public override bool Equals(object? obj)
    {
        return obj is EmbedderId other && Equals(other);
    }

    public override int GetHashCode() => Value.GetHashCode();

    public static bool operator ==(EmbedderId? left, EmbedderId? right)
    {
        if (left is null) return right is null;
        return left.Equals(right);
    }

    public static bool operator !=(EmbedderId? left, EmbedderId? right) => !(left == right);
}