using AiZaya.Shared.Domain.Abstractions.Interfaces;
using AiZaya.Shared.Domain.Results;

namespace AiZaya.Modules.Embedders.Domain.Embedders;

public sealed partial class VectorDimension : IValueObject
{
    public const int MaxValue = 4096;
    public const int MinValue = 1;

    public int Value { get; private set; }

    private VectorDimension()
    {
    }

    public static Rule Validate(int value)
    {
        return Rule.CreateBuilder()
            .ErrorIf(nameof(VectorDimension), value < MinValue || value > MaxValue,
                $"VectorDimension должен быть от {MinValue} до {MaxValue}")
            .Build();
    }

    public static Result<VectorDimension> Create(int value)
    {
        var rule = Validate(value);

        if (rule.IsFailure)
        {
            return rule.Error;
        }

        return new VectorDimension { Value = value };
    }

    private IEnumerable<object> GetComparisonValues() => [Value];

    public static explicit operator VectorDimension(int value) => Create(value).Value!;

    public override string ToString() => Value.ToString();
}

public partial class VectorDimension : IEquatable<VectorDimension>
{
    public bool Equals(VectorDimension? other)
    {
        if (other is null) return false;
        return GetComparisonValues().SequenceEqual(other.GetComparisonValues());
    }

    public override bool Equals(object? obj)
    {
        return obj is VectorDimension other && Equals(other);
    }

    public override int GetHashCode() => Value.GetHashCode();

    public static bool operator ==(VectorDimension? left, VectorDimension? right)
    {
        if (left is null) return right is null;
        return left.Equals(right);
    }

    public static bool operator !=(VectorDimension? left, VectorDimension? right) => !(left == right);
}