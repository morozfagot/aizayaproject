using System.Text.RegularExpressions;
using AiZaya.Shared.Domain.Abstractions.Interfaces;
using AiZaya.Shared.Domain.Results;

namespace AiZaya.Modules.Embedders.Domain.Embeddings;

/// <summary>
/// Метаинформация об источнике вектора. Не указывает на коллекцию напрямую —
/// модуль сохранения (VectorCollections) определяет целевую коллекцию по Source.
/// Формат: "kind:scope:id" (например "workspace:ws-abc:msg-123").
/// </summary>
public sealed partial class SourceInfo : IValueObject
{
    private static readonly Regex PatternRegex = PatternRegexFactory();

    public const int MaxLength = 256;
    public const int MinLength = 3;

    public string Value { get; private set; } = null!;

    private SourceInfo()
    {
    }

    public static Rule Validate(string? value)
    {
        return Rule.CreateBuilder()
            .ErrorIf(nameof(SourceInfo), value is null || value.IsWhiteSpace(),
                "SourceInfo должен быть указан и не содержать пробелов")
            .ErrorIf(nameof(SourceInfo),
                value is not null && (value.Length < MinLength || value.Length > MaxLength),
                $"SourceInfo должен быть от {MinLength} до {MaxLength} символов")
            .ErrorIf(nameof(SourceInfo),
                value is not null && !PatternRegex.IsMatch(value),
                "SourceInfo должен соответствовать [a-zA-Z0-9._:/-]")
            .Build();
    }

    public static Result<SourceInfo> Create(string? value)
    {
        var rule = Validate(value);

        if (rule.IsFailure)
        {
            return rule.Error;
        }

        return new SourceInfo { Value = value! };
    }

    private IEnumerable<object> GetComparisonValues() => [Value];

    public static explicit operator SourceInfo(string value) => Create(value).Value!;

    public override string ToString() => Value;

    [GeneratedRegex(@"^[a-zA-Z0-9._:/\-]+$")]
    private static partial Regex PatternRegexFactory();
}

public partial class SourceInfo : IEquatable<SourceInfo>
{
    public bool Equals(SourceInfo? other)
    {
        if (other is null) return false;
        return GetComparisonValues().SequenceEqual(other.GetComparisonValues());
    }

    public override bool Equals(object? obj)
    {
        return obj is SourceInfo other && Equals(other);
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

    public static bool operator ==(SourceInfo? left, SourceInfo? right)
    {
        if (left is null) return right is null;
        return left.Equals(right);
    }

    public static bool operator !=(SourceInfo? left, SourceInfo? right) => !(left == right);
}