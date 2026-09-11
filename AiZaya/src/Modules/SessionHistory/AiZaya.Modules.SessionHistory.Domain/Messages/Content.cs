using AiZaya.Shared.Domain.Abstractions.Interfaces;
using AiZaya.Shared.Domain.Results;

namespace AiZaya.Modules.SessionHistory.Domain.Messages;

/// <summary>
/// Content — полный текст сообщения.
/// </summary>
public sealed partial class Content : IValueObject
{
    public string Value { get; private set; } = null!;

    private Content()
    {
    }

    public static Rule Validate(string value)
    {
        return Rule.CreateBuilder()
            .ErrorIf(nameof(Content), string.IsNullOrWhiteSpace(value), "Content не может быть пустым")
            .Build();
    }

    public static Result<Content> Create(string value)
    {
        var rule = Validate(value);

        if (rule.IsFailure)
        {
            return rule.Error;
        }

        return new Content { Value = value };
    }

    private IEnumerable<object> GetComparisonValues() => [Value];

    public static explicit operator Content(string value) => Create(value).Value!;

    public override string ToString() => Value;
}

public partial class Content : IEquatable<Content>
{
    public bool Equals(Content? other)
    {
        if (other is null) return false;
        return GetComparisonValues().SequenceEqual(other.GetComparisonValues());
    }

    public override bool Equals(object? obj) => obj is Content other && Equals(other);

    public override int GetHashCode() => Value.GetHashCode();

    public static bool operator ==(Content? left, Content? right)
    {
        if (left is null) return right is null;
        return left.Equals(right);
    }

    public static bool operator !=(Content? left, Content? right) => !(left == right);
}