using System.Text.RegularExpressions;
using AiZaya.Shared.Domain.Abstractions.Interfaces;
using AiZaya.Shared.Domain.Results;

namespace AiZaya.Modules.Embedders.Domain.Providers;

public sealed partial class ProviderType : IValueObject
{
    public const int MaxLength = 32;
    public const int MinLength = 1;

    public string Value { get; private set; } = null!;

    private ProviderType()
    {
    }

    public static Rule Validate(string? value)
    {
        return Rule.CreateBuilder()
            .ErrorIf(nameof(ProviderType), value is null || value.IsWhiteSpace(),
                "ProviderType должен быть указан и не содержать пробелов")
            .ErrorIf(nameof(ProviderType),
                value is not null && (value.Length < MinLength || value.Length > MaxLength),
                $"ProviderType должен быть от {MinLength} до {MaxLength} символов")
            .ErrorIf(nameof(ProviderType),
                value is not null && !PatternRegex.IsMatch(value),
                "ProviderType должен соответствовать [a-z0-9-]")
            .Build();
    }

    public static Result<ProviderType> Create(string? value)
    {
        var rule = Validate(value);

        if (rule.IsFailure)
        {
            return rule.Error;
        }

        return new ProviderType { Value = value!.ToLowerInvariant() };
    }

    private static readonly Regex PatternRegex = PatternRegexFactory();

    private IEnumerable<object> GetComparisonValues() => [Value];

    public static explicit operator ProviderType(string value) => Create(value).Value!;

    public override string ToString() => Value;

    [GeneratedRegex("^[a-z0-9-]+$")]
    private static partial Regex PatternRegexFactory();
}

public partial class ProviderType : IEquatable<ProviderType>
{
    public bool Equals(ProviderType? other)
    {
        if (other is null) return false;
        return GetComparisonValues().SequenceEqual(other.GetComparisonValues());
    }

    public override bool Equals(object? obj)
    {
        return obj is ProviderType other && Equals(other);
    }

    public override int GetHashCode()
    {
        var hash = new HashCode();
        foreach (var component in GetComparisonValues())
        {
            hash.Add(component.GetHashCode());
        }
        return hash.ToHashCode();
    }

    public static bool operator ==(ProviderType? left, ProviderType? right)
    {
        if (left is null) return right is null;
        return left.Equals(right);
    }

    public static bool operator !=(ProviderType? left, ProviderType? right) => !(left == right);
}