using AiZaya.Shared.Domain.Abstractions.Interfaces;
using AiZaya.Shared.Domain.Results;

namespace AiZaya.Modules.SessionHistory.Domain.Messages;

/// <summary>
/// MessageId — идентификатор сообщения в истории сессии.
/// Формат: msg-{timestamp}-frag-{index} (morozcode pattern) или UUID.
/// </summary>
public sealed partial class MessageId : IValueObject
{
    public string Value { get; private set; } = null!;

    private MessageId()
    {
    }

    public static Rule Validate(string value)
    {
        return Rule.CreateBuilder()
            .ErrorIf(nameof(MessageId), string.IsNullOrWhiteSpace(value), "MessageId не может быть пустым")
            .Build();
    }

    public static Result<MessageId> Create(string value)
    {
        var rule = Validate(value);

        if (rule.IsFailure)
        {
            return rule.Error;
        }

        return new MessageId { Value = value };
    }

    private IEnumerable<object> GetComparisonValues() => [Value];

    public static explicit operator MessageId(string value) => Create(value).Value!;

    public override string ToString() => Value;
}

public partial class MessageId : IEquatable<MessageId>
{
    public bool Equals(MessageId? other)
    {
        if (other is null) return false;
        return GetComparisonValues().SequenceEqual(other.GetComparisonValues());
    }

    public override bool Equals(object? obj) => obj is MessageId other && Equals(other);

    public override int GetHashCode() => Value.GetHashCode();

    public static bool operator ==(MessageId? left, MessageId? right)
    {
        if (left is null) return right is null;
        return left.Equals(right);
    }

    public static bool operator !=(MessageId? left, MessageId? right) => !(left == right);
}