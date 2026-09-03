using AiZaya.Shared.Domain.Abstractions.Interfaces;
using AiZaya.Shared.Domain.Results;
using AiZaya.Modules.Embedders.Domain.Embedders;

namespace AiZaya.Modules.Embedders.Domain.Embeddings;

public sealed partial class EmbeddingVector : IValueObject
{
    public IReadOnlyList<float> Values { get; private set; } = null!;

    private EmbeddingVector()
    {
    }

    public static Rule Validate(IReadOnlyList<float>? values, VectorDimension? dimension)
    {
        return Rule.CreateBuilder()
            .ErrorIf(nameof(EmbeddingVector), values is null,
                "EmbeddingVector.Values должен быть указан")
            .ErrorIf(nameof(EmbeddingVector), dimension is null,
                "VectorDimension должен быть указан для валидации EmbeddingVector")
            .ErrorIf(nameof(EmbeddingVector),
                values is not null && dimension is not null && values.Count != dimension.Value,
                $"EmbeddingVector.Values длина ({values?.Count}) должна соответствовать VectorDimension ({dimension?.Value})")
            .ErrorIf(nameof(EmbeddingVector),
                values is not null && values.Count > 0 && values.Any(v => float.IsNaN(v) || float.IsInfinity(v)),
                "EmbeddingVector.Values содержит NaN или Infinity")
            .Build();
    }

    public static Result<EmbeddingVector> Create(IReadOnlyList<float>? values, VectorDimension? dimension)
    {
        var rule = Validate(values, dimension);

        if (rule.IsFailure)
        {
            return rule.Error;
        }

        return new EmbeddingVector { Values = values!.ToArray() };
    }

    private IEnumerable<object> GetComparisonValues()
    {
        if (Values is null)
        {
            yield return Array.Empty<float>();
        }
        else
        {
            yield return Values.Count;
            yield return string.Join(",", Values);
        }
    }

    public override string ToString() =>
        Values is null ? "[]" : $"[{Values.Count}-dim vector]";
}

public partial class EmbeddingVector : IEquatable<EmbeddingVector>
{
    public bool Equals(EmbeddingVector? other)
    {
        if (other is null) return false;
        if (ReferenceEquals(this, other)) return true;
        return GetComparisonValues().SequenceEqual(other.GetComparisonValues());
    }

    public override bool Equals(object? obj) => obj is EmbeddingVector other && Equals(other);

    public override int GetHashCode()
    {
        var hash = new HashCode();
        foreach (var component in GetComparisonValues())
        {
            hash.Add(component.GetHashCode());
        }
        return hash.ToHashCode();
    }

    public static bool operator ==(EmbeddingVector? left, EmbeddingVector? right)
    {
        if (left is null) return right is null;
        return left.Equals(right);
    }

    public static bool operator !=(EmbeddingVector? left, EmbeddingVector? right) => !(left == right);
}