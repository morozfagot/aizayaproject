using AiZaya.Shared.Domain.Abstractions.Interfaces;
using AiZaya.Shared.Domain.Results;

namespace AiZaya.Modules.Embedders.Domain.Providers;

public sealed partial class TimeoutMs : IValueObject
{
    public const int MaxValue = 600_000;
    public const int MinValue = 1;

    public int Value { get; private set; }

    private TimeoutMs()
    {
    }

    public static Rule Validate(int value)
    {
        return Rule.CreateBuilder()
            .ErrorIf(nameof(TimeoutMs), value < MinValue || value > MaxValue,
                $"TimeoutMs должен быть от {MinValue} до {MaxValue}")
            .Build();
    }

    public static Result<TimeoutMs> Create(int value)
    {
        var rule = Validate(value);

        if (rule.IsFailure)
        {
            return rule.Error;
        }

        return new TimeoutMs { Value = value };
    }

    private IEnumerable<object> GetComparisonValues() => [Value];

    public static explicit operator TimeoutMs(int value) => Create(value).Value!;

    public override string ToString() => $"{Value}ms";
}

public partial class TimeoutMs : IEquatable<TimeoutMs>
{
    public bool Equals(TimeoutMs? other)
    {
        if (other is null) return false;
        return GetComparisonValues().SequenceEqual(other.GetComparisonValues());
    }

    public override bool Equals(object? obj)
    {
        return obj is TimeoutMs other && Equals(other);
    }

    public override int GetHashCode() => Value.GetHashCode();

    public static bool operator ==(TimeoutMs? left, TimeoutMs? right)
    {
        if (left is null) return right is null;
        return left.Equals(right);
    }

    public static bool operator !=(TimeoutMs? left, TimeoutMs? right) => !(left == right);
}