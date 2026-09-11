using AiZaya.Shared.Domain.Abstractions.Interfaces;
using AiZaya.Shared.Domain.Results;

namespace AiZaya.Modules.SessionHistory.Domain.Messages;

/// <summary>
/// Mode — режим работы, в котором было создано сообщение.
/// Список допустимых модов передаётся в use case из Infrastructure (конфиг),
/// валидация против него выполняется на уровне use case (Feature).
/// В Domain — только проверка на непустую строку.
/// </summary>
public sealed partial class Mode : IValueObject
{
    public string Value { get; private set; } = null!;

    private Mode()
    {
    }

    public static Rule Validate(string value)
    {
        return Rule.CreateBuilder()
            .ErrorIf(nameof(Mode), string.IsNullOrWhiteSpace(value), "Mode не может быть пустым")
            .Build();
    }

    public static Result<Mode> Create(string value)
    {
        var rule = Validate(value);

        if (rule.IsFailure)
        {
            return rule.Error;
        }

        return new Mode { Value = value };
    }

    private IEnumerable<object> GetComparisonValues() => [Value];

    public static explicit operator Mode(string value) => Create(value).Value!;

    public override string ToString() => Value;
}

public partial class Mode : IEquatable<Mode>
{
    public bool Equals(Mode? other)
    {
        if (other is null) return false;
        return GetComparisonValues().SequenceEqual(other.GetComparisonValues());
    }

    public override bool Equals(object? obj) => obj is Mode other && Equals(other);

    public override int GetHashCode() => Value.GetHashCode();

    public static bool operator ==(Mode? left, Mode? right)
    {
        if (left is null) return right is null;
        return left.Equals(right);
    }

    public static bool operator !=(Mode? left, Mode? right) => !(left == right);
}