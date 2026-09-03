using System.Text.RegularExpressions;
using AiZaya.Shared.Domain.Abstractions.Interfaces;
using AiZaya.Shared.Domain.Results;

namespace AiZaya.Modules.Embedders.Domain.Providers;

public sealed partial class ApiKeyReference : IValueObject
{
    public const int MaxLength = 64;
    public const int MinLength = 1;

    public string Value { get; private set; } = null!;

    private ApiKeyReference()
    {
    }

    public static Rule Validate(string? value)
    {
        return Rule.CreateBuilder()
            .ErrorIf(nameof(ApiKeyReference), value is null || value.IsWhiteSpace(),
                "ApiKeyReference должен быть указан и не содержать пробелов")
            .ErrorIf(nameof(ApiKeyReference),
                value is not null && (value.Length < MinLength || value.Length > MaxLength),
                $"ApiKeyReference должен быть от {MinLength} до {MaxLength} символов")
            .ErrorIf(nameof(ApiKeyReference),
                value is not null && !PatternRegex.IsMatch(value),
                "ApiKeyReference должен соответствовать [A-Z0-9_]")
            .Build();
    }

    public static Result<ApiKeyReference> Create(string? value)
    {
        var rule = Validate(value);

        if (rule.IsFailure)
        {
            return rule.Error;
        }

        return new ApiKeyReference { Value = value! };
    }

    private static readonly Regex PatternRegex = PatternRegexFactory();

    private IEnumerable<object> GetComparisonValues() => [Value];

    public static explicit operator ApiKeyReference(string value) => Create(value).Value!;

    public override string ToString() => Value;

    [GeneratedRegex(@"^[A-Z0-9_]+$")]
    private static partial Regex PatternRegexFactory();
}

public partial class ApiKeyReference : IEquatable<ApiKeyReference>
{
    public bool Equals(ApiKeyReference? other)
    {
        if (other is null) return false;
        return GetComparisonValues().SequenceEqual(other.GetComparisonValues());
    }

    public override bool Equals(object? obj)
    {
        return obj is ApiKeyReference other && Equals(other);
    }

    public override int GetHashCode() => Value.GetHashCode();

    public static bool operator ==(ApiKeyReference? left, ApiKeyReference? right)
    {
        if (left is null) return right is null;
        return left.Equals(right);
    }

    public static bool operator !=(ApiKeyReference? left, ApiKeyReference? right) => !(left == right);
}