using AiZaya.Shared.Domain.Abstractions.Interfaces;
using AiZaya.Shared.Domain.Results;

namespace AiZaya.Modules.SessionHistory.Domain.Messages;

/// <summary>
/// Timestamp — время сообщения.
/// </summary>
public sealed partial class Timestamp : IValueObject
{
    public DateTime Value { get; private set; }

    private Timestamp()
    {
    }

    public static Rule Validate(DateTime value)
    {
        return Rule.CreateBuilder()
            .ErrorIf(nameof(Timestamp), value > DateTime.UtcNow.AddMinutes(5),
                "Timestamp не может быть в будущем (допуск 5 минут)")
            .Build();
    }

    public static Result<Timestamp> Create(DateTime value)
    {
        var rule = Validate(value);

        if (rule.IsFailure)
        {
            return rule.Error;
        }

        return new Timestamp { Value = value };
    }

    public static Timestamp Now() => new() { Value = DateTime.UtcNow };

    private IEnumerable<object> GetComparisonValues() => [Value];

    public static explicit operator Timestamp(DateTime value) => Create(value).Value!;

    public override string ToString() => Value.ToString();
}

public partial class Timestamp : IEquatable<Timestamp>
{
    public bool Equals(Timestamp? other)
    {
        if (other is null) return false;
        return GetComparisonValues().SequenceEqual(other.GetComparisonValues());
    }

    public override bool Equals(object? obj) => obj is Timestamp other && Equals(other);

    public override int GetHashCode() => Value.GetHashCode();

    public static bool operator ==(Timestamp? left, Timestamp? right)
    {
        if (left is null) return right is null;
        return left.Equals(right);
    }

    public static bool operator !=(Timestamp? left, Timestamp? right) => !(left == right);
}