using System.Text.RegularExpressions;
using AiZaya.Shared.Domain.Abstractions.Interfaces;
using AiZaya.Shared.Domain.Results;

namespace AiZaya.Modules.Embedders.Domain.Embedders;

public sealed partial class ModelName : IValueObject
{
    public const int MaxLength = 128;
    public const int MinLength = 1;

    public string Value { get; private set; } = null!;

    private ModelName()
    {
    }

    public static Rule Validate(string? value)
    {
        return Rule.CreateBuilder()
            .ErrorIf(nameof(ModelName), value is null || value.IsWhiteSpace(),
                "ModelName должно быть указано и не содержать пробелов")
            .ErrorIf(nameof(ModelName),
                value is not null && (value.Length < MinLength || value.Length > MaxLength),
                $"ModelName должно быть от {MinLength} до {MaxLength} символов")
            .ErrorIf(nameof(ModelName),
                value is not null && !PatternRegex.IsMatch(value),
                "ModelName должно соответствовать [a-zA-Z0-9._/-]")
            .Build();
    }

    public static Result<ModelName> Create(string? value)
    {
        var rule = Validate(value);

        if (rule.IsFailure)
        {
            return rule.Error;
        }

        return new ModelName { Value = value! };
    }

    private static readonly Regex PatternRegex = PatternRegexFactory();

    private IEnumerable<object> GetComparisonValues() => [Value];

    public static explicit operator ModelName(string value) => Create(value).Value!;

    public override string ToString() => Value;

    [GeneratedRegex(@"^[a-zA-Z0-9._/\-]+$")]
    private static partial Regex PatternRegexFactory();
}

public partial class ModelName : IEquatable<ModelName>
{
    public bool Equals(ModelName? other)
    {
        if (other is null) return false;
        return GetComparisonValues().SequenceEqual(other.GetComparisonValues());
    }

    public override bool Equals(object? obj)
    {
        return obj is ModelName other && Equals(other);
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

    public static bool operator ==(ModelName? left, ModelName? right)
    {
        if (left is null) return right is null;
        return left.Equals(right);
    }

    public static bool operator !=(ModelName? left, ModelName? right) => !(left == right);
}