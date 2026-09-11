using AiZaya.Shared.Domain.Abstractions.Interfaces;
using AiZaya.Shared.Domain.Results;

namespace AiZaya.Modules.SessionHistory.Domain.Messages;

/// <summary>
/// ParentMessageId — идентификатор родительского сообщения (для цепочек).
/// </summary>
public sealed partial class ParentMessageId : IValueObject
{
    public MessageId Value { get; private set; } = null!;

    private ParentMessageId()
    {
    }

    public static Rule Validate(MessageId value)
    {
        return Rule.CreateBuilder()
            .ErrorIf(nameof(ParentMessageId), value is null, "ParentMessageId не может быть null")
            .Build();
    }

    public static Result<ParentMessageId> Create(MessageId value)
    {
        var rule = Validate(value);

        if (rule.IsFailure)
        {
            return rule.Error;
        }

        return new ParentMessageId { Value = value };
    }

    private IEnumerable<object> GetComparisonValues() => [Value];

    public static explicit operator ParentMessageId(MessageId value) => Create(value).Value!;

    public override string ToString() => Value.ToString();
}

public partial class ParentMessageId : IEquatable<ParentMessageId>
{
    public bool Equals(ParentMessageId? other)
    {
        if (other is null) return false;
        return GetComparisonValues().SequenceEqual(other.GetComparisonValues());
    }

    public override bool Equals(object? obj) => obj is ParentMessageId other && Equals(other);

    public override int GetHashCode() => Value.GetHashCode();

    public static bool operator ==(ParentMessageId? left, ParentMessageId? right)
    {
        if (left is null) return right is null;
        return left.Equals(right);
    }

    public static bool operator !=(ParentMessageId? left, ParentMessageId? right) => !(left == right);
}