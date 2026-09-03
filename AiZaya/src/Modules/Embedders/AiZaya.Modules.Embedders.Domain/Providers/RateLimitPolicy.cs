using AiZaya.Shared.Domain.Abstractions.Interfaces;
using AiZaya.Shared.Domain.Results;

namespace AiZaya.Modules.Embedders.Domain.Providers;

public sealed partial class RateLimitPolicy : IValueObject
{
    public const int MaxValue = 10_000_000;
    public const int MinValue = 0;

    public int TokensPerMinute { get; private set; }

    public int RequestsPerMinute { get; private set; }

    private RateLimitPolicy()
    {
    }

    public static Rule ValidateTokens(int tokensPerMinute)
    {
        return Rule.CreateBuilder()
            .ErrorIf(nameof(RateLimitPolicy), tokensPerMinute < MinValue || tokensPerMinute > MaxValue,
                $"TokensPerMinute должен быть от {MinValue} до {MaxValue}")
            .Build();
    }

    public static Rule ValidateRequests(int requestsPerMinute)
    {
        return Rule.CreateBuilder()
            .ErrorIf(nameof(RateLimitPolicy), requestsPerMinute < MinValue || requestsPerMinute > MaxValue,
                $"RequestsPerMinute должен быть от {MinValue} до {MaxValue}")
            .Build();
    }

    public static Result<RateLimitPolicy> Create(int tokensPerMinute, int requestsPerMinute)
    {
        var tokensRule = ValidateTokens(tokensPerMinute);
        if (tokensRule.IsFailure)
        {
            return tokensRule.Error;
        }

        var requestsRule = ValidateRequests(requestsPerMinute);
        if (requestsRule.IsFailure)
        {
            return requestsRule.Error;
        }

        var bothZeroRule = Rule.CreateBuilder()
            .ErrorIf(nameof(RateLimitPolicy),
                tokensPerMinute == 0 && requestsPerMinute == 0,
                "RateLimitPolicy должен иметь TokensPerMinute > 0 или RequestsPerMinute > 0")
            .Build();

        if (bothZeroRule.IsFailure)
        {
            return bothZeroRule.Error;
        }

        return new RateLimitPolicy
        {
            TokensPerMinute = tokensPerMinute,
            RequestsPerMinute = requestsPerMinute
        };
    }

    private IEnumerable<object> GetComparisonValues() => [TokensPerMinute, RequestsPerMinute];

    public override string ToString() =>
        $"tpm={TokensPerMinute}, rpm={RequestsPerMinute}";
}

public partial class RateLimitPolicy : IEquatable<RateLimitPolicy>
{
    public bool Equals(RateLimitPolicy? other)
    {
        if (other is null) return false;
        return GetComparisonValues().SequenceEqual(other.GetComparisonValues());
    }

    public override bool Equals(object? obj)
    {
        return obj is RateLimitPolicy other && Equals(other);
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

    public static bool operator ==(RateLimitPolicy? left, RateLimitPolicy? right)
    {
        if (left is null) return right is null;
        return left.Equals(right);
    }

    public static bool operator !=(RateLimitPolicy? left, RateLimitPolicy? right) => !(left == right);
}