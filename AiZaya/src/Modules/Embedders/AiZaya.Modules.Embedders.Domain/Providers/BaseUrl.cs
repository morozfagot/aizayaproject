using AiZaya.Shared.Domain.Abstractions.Interfaces;
using AiZaya.Shared.Domain.Results;

namespace AiZaya.Modules.Embedders.Domain.Providers;

public sealed partial class BaseUrl : IValueObject
{
    public Uri Value { get; private set; } = null!;

    private BaseUrl()
    {
    }

    public static Rule Validate(string? value)
    {
        return Rule.CreateBuilder()
            .ErrorIf(nameof(BaseUrl), string.IsNullOrWhiteSpace(value),
                "BaseUrl должен быть указан")
            .ErrorIf(nameof(BaseUrl),
                value is not null && (!Uri.TryCreate(value, UriKind.Absolute, out var uri)
                                       || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)),
                "BaseUrl должен быть валидным абсолютным URI с http/https схемой")
            .Build();
    }

    public static Result<BaseUrl> Create(string? value)
    {
        var rule = Validate(value);

        if (rule.IsFailure)
        {
            return rule.Error;
        }

        return new BaseUrl { Value = new Uri(value!, UriKind.Absolute) };
    }

    private IEnumerable<object> GetComparisonValues() => [Value];

    public static explicit operator BaseUrl(string value) => Create(value).Value!;

    public override string ToString() => Value.ToString();
}

public partial class BaseUrl : IEquatable<BaseUrl>
{
    public bool Equals(BaseUrl? other)
    {
        if (other is null) return false;
        return GetComparisonValues().SequenceEqual(other.GetComparisonValues());
    }

    public override bool Equals(object? obj)
    {
        return obj is BaseUrl other && Equals(other);
    }

    public override int GetHashCode() => Value.GetHashCode();

    public static bool operator ==(BaseUrl? left, BaseUrl? right)
    {
        if (left is null) return right is null;
        return left.Equals(right);
    }

    public static bool operator !=(BaseUrl? left, BaseUrl? right) => !(left == right);
}