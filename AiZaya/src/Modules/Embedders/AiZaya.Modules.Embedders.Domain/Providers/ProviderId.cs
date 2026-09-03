using AiZaya.Shared.Domain.Abstractions.Interfaces;

namespace AiZaya.Modules.Embedders.Domain.Providers;

public sealed partial class ProviderId : IValueObject
{
    private ProviderId()
    {
    }

    public Guid Value { get; private set; }

    public static ProviderId Create() => new() { Value = Guid.CreateVersion7() };

    public static ProviderId Create(Guid value) => new() { Value = value };

    private IEnumerable<object> GetComparisonValues() => [Value];

    public static explicit operator ProviderId(Guid value) => new() { Value = value };

    public override string ToString() => Value.ToString();
}

public partial class ProviderId : IEquatable<ProviderId>
{
    public bool Equals(ProviderId? other)
    {
        if (other is null) return false;
        return GetComparisonValues().SequenceEqual(other.GetComparisonValues());
    }

    public override bool Equals(object? obj)
    {
        return obj is ProviderId other && Equals(other);
    }

    public override int GetHashCode() => Value.GetHashCode();

    public static bool operator ==(ProviderId? left, ProviderId? right)
    {
        if (left is null) return right is null;
        return left.Equals(right);
    }

    public static bool operator !=(ProviderId? left, ProviderId? right) => !(left == right);
}