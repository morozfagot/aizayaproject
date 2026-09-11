using AiZaya.Shared.Domain.Abstractions.Interfaces;
using AiZaya.Shared.Domain.Results;

namespace AiZaya.Modules.SessionHistory.Domain.Chunks;

/// <summary>
/// ChunkIndex — порядковый индекс чанка внутри сообщения (≥ 0).
/// Чанк — отдельный агрегат, соответственно и ChunkIndex в нём.
/// </summary>
public sealed partial class ChunkIndex : IValueObject
{
    public int Value { get; private set; }

    private ChunkIndex()
    {
    }

    public static Rule Validate(int value)
    {
        return Rule.CreateBuilder()
            .ErrorIf(nameof(ChunkIndex), value < 0, "ChunkIndex должен быть ≥ 0")
            .Build();
    }

    public static Result<ChunkIndex> Create(int value)
    {
        var rule = Validate(value);

        if (rule.IsFailure)
        {
            return rule.Error;
        }

        return new ChunkIndex { Value = value };
    }

    private IEnumerable<object> GetComparisonValues() => [Value];

    public static explicit operator ChunkIndex(int value) => Create(value).Value!;

    public override string ToString() => Value.ToString();
}

public partial class ChunkIndex : IEquatable<ChunkIndex>
{
    public bool Equals(ChunkIndex? other)
    {
        if (other is null) return false;
        return GetComparisonValues().SequenceEqual(other.GetComparisonValues());
    }

    public override bool Equals(object? obj) => obj is ChunkIndex other && Equals(other);

    public override int GetHashCode() => Value.GetHashCode();

    public static bool operator ==(ChunkIndex? left, ChunkIndex? right)
    {
        if (left is null) return right is null;
        return left.Equals(right);
    }

    public static bool operator !=(ChunkIndex? left, ChunkIndex? right) => !(left == right);
}