using System.Text.RegularExpressions;
using AiZaya.Shared.Domain.Abstractions.Interfaces;
using AiZaya.Shared.Domain.Results;

namespace AiZaya.Modules.SessionHistory.Domain.Sessions;

/// <summary>
/// SessionId — идентификатор сессии (агрегат Session).
/// Формат: md5Uuid (36 chars: 8-4-4-4-12 hex), совпадает с morozcode md5Uuid().
/// </summary>
public sealed partial class SessionId : IValueObject
{
    public string Value { get; private set; } = null!;

    private SessionId()
    {
    }

    public static Rule Validate(string value)
    {
        return Rule.CreateBuilder()
            .ErrorIf(nameof(SessionId), string.IsNullOrWhiteSpace(value), "SessionId не может быть пустым")
            .ErrorIf(nameof(SessionId), value is not null && !UuidRegex.IsMatch(value), "SessionId должен быть в формате UUID (8-4-4-4-12 hex)")
            .Build();
    }

    public static Result<SessionId> Create(string value)
    {
        var rule = Validate(value);

        if (rule.IsFailure)
        {
            return rule.Error;
        }

        return new SessionId { Value = value };
    }

    private static readonly Regex UuidRegex = new(@"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$");

    private IEnumerable<object> GetComparisonValues() => [Value];

    public static explicit operator SessionId(string value) => Create(value).Value!;

    public override string ToString() => Value;
}

public partial class SessionId : IEquatable<SessionId>
{
    public bool Equals(SessionId? other)
    {
        if (other is null) return false;
        return GetComparisonValues().SequenceEqual(other.GetComparisonValues());
    }

    public override bool Equals(object? obj) => obj is SessionId other && Equals(other);

    public override int GetHashCode() => Value.GetHashCode();

    public static bool operator ==(SessionId? left, SessionId? right)
    {
        if (left is null) return right is null;
        return left.Equals(right);
    }

    public static bool operator !=(SessionId? left, SessionId? right) => !(left == right);
}