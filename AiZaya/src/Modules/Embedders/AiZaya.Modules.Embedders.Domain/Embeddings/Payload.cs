using AiZaya.Shared.Domain.Abstractions.Interfaces;
using AiZaya.Shared.Domain.Results;

namespace AiZaya.Modules.Embedders.Domain.Embeddings;

public sealed partial class Payload : IValueObject
{
    public const int MaxKeys = 32;
    public const int MaxValueLength = 4096;

    private static readonly HashSet<string> ReservedKeys =
    new(StringComparer.OrdinalIgnoreCase) { "id", "vector", "embedding" };

    public IReadOnlyDictionary<string, string> Values { get; private set; } = null!;

    private Payload()
    {
    }

    public static Rule Validate(IReadOnlyDictionary<string, string>? values)
    {
        return Rule.CreateBuilder()
            .ErrorIf(nameof(Payload), values is null,
                "Payload должен быть указан")
            .ErrorIf(nameof(Payload), values is not null && values.Count > MaxKeys,
                $"Payload не может содержать больше {MaxKeys} ключей")
            .ErrorIf(nameof(Payload),
                values is not null && values.Keys.Any(ReservedKeys.Contains),
                "Payload не может содержать зарезервированные ключи id/vector/embedding")
            .ErrorIf(nameof(Payload),
                values is not null && values.Keys.Any(string.IsNullOrWhiteSpace),
                "Payload не может содержать пустые ключи")
            .ErrorIf(nameof(Payload),
                values is not null && values.Any(kv => kv.Value is null || kv.Value.Length > MaxValueLength),
                $"Значения Payload не могут быть null или больше {MaxValueLength} символов")
            .Build();
    }

    public static Result<Payload> Create(IReadOnlyDictionary<string, string>? values)
    {
        var rule = Validate(values);

        if (rule.IsFailure)
        {
            return rule.Error;
        }

        var copy = new Dictionary<string, string>(values!.Count, StringComparer.Ordinal);
        foreach (var kv in values)
        {
            copy[kv.Key] = kv.Value;
        }

        return new Payload { Values = copy };
    }

    public static Payload Empty() => new() { Values = new Dictionary<string, string>(StringComparer.Ordinal) };

    private IEnumerable<object> GetComparisonValues()
    {
        if (Values is null)
        {
            yield return Array.Empty<KeyValuePair<string, string>>();
        }
        else
        {
            foreach (var kv in Values.OrderBy(kv => kv.Key, StringComparer.Ordinal))
            {
                yield return kv.Key;
                yield return kv.Value;
            }
        }
    }
}

public partial class Payload : IEquatable<Payload>
{
    public bool Equals(Payload? other)
    {
        if (other is null) return false;
        if (ReferenceEquals(this, other)) return true;
        return GetComparisonValues().SequenceEqual(other.GetComparisonValues());
    }

    public override bool Equals(object? obj) => obj is Payload other && Equals(other);

    public override int GetHashCode()
    {
        var hash = new HashCode();
        foreach (var component in GetComparisonValues())
        {
            hash.Add(component.GetHashCode());
        }
        return hash.ToHashCode();
    }

    public static bool operator ==(Payload? left, Payload? right)
    {
        if (left is null) return right is null;
        return left.Equals(right);
    }

    public static bool operator !=(Payload? left, Payload? right) => !(left == right);
}