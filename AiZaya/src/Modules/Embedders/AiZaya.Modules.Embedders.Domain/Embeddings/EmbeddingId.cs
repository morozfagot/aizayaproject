using AiZaya.Shared.Domain.Abstractions.Interfaces;

namespace AiZaya.Modules.Embedders.Domain.Embeddings;

public sealed partial class EmbeddingId : IValueObject
{
    private EmbeddingId()
    {
    }

    public Guid Value { get; private set; }

    public static EmbeddingId Create() => new() { Value = Guid.CreateVersion7() };

    public static EmbeddingId Create(Guid value) => new() { Value = value };

    private IEnumerable<object> GetComparisonValues() => [Value];

    public static explicit operator EmbeddingId(Guid value) => new() { Value = value };

    public override string ToString() => Value.ToString();
}

public partial class EmbeddingId : IEquatable<EmbeddingId>
{
    public bool Equals(EmbeddingId? other)
    {
        if (other is null) return false;
        return GetComparisonValues().SequenceEqual(other.GetComparisonValues());
    }

    public override bool Equals(object? obj)
    {
        return obj is EmbeddingId other && Equals(other);
    }

    public override int GetHashCode() => Value.GetHashCode();

    public static bool operator ==(EmbeddingId? left, EmbeddingId? right)
    {
        if (left is null) return right is null;
        return left.Equals(right);
    }

    public static bool operator !=(EmbeddingId? left, EmbeddingId? right) => !(left == right);
}