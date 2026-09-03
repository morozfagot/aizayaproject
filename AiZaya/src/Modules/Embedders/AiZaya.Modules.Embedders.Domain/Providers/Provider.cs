using AiZaya.Shared.Domain.Abstractions;
using AiZaya.Shared.Domain.Results;
using AiZaya.Modules.Embedders.Domain.Providers.Events;

namespace AiZaya.Modules.Embedders.Domain.Providers;

public sealed partial class Provider : AggregateRoot<ProviderId>
{
    public ProviderType Type { get; private set; } = null!;
    public BaseUrl BaseUrl { get; private set; } = null!;
    public ApiKeyReference ApiKeyReference { get; private set; } = null!;
    public TimeoutMs TimeoutMs { get; private set; } = null!;
    public RateLimitPolicy RateLimit { get; private set; } = null!;
    public bool IsActive { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime? DeactivatedAtUtc { get; private set; }

    private Provider()
    {
    }

    public static Result<Provider> Create(
        ProviderType type,
        BaseUrl baseUrl,
        ApiKeyReference apiKeyReference,
        TimeoutMs timeoutMs,
        RateLimitPolicy rateLimit,
        DateTime nowUtc)
    {
        var rule = Rule.CreateBuilder()
            .ErrorIf(nameof(Provider), type is null, "ProviderType должен быть указан")
            .ErrorIf(nameof(Provider), baseUrl is null, "BaseUrl должен быть указан")
            .ErrorIf(nameof(Provider), apiKeyReference is null, "ApiKeyReference должен быть указан")
            .ErrorIf(nameof(Provider), timeoutMs is null, "TimeoutMs должен быть указан")
            .ErrorIf(nameof(Provider), rateLimit is null, "RateLimitPolicy должна быть указана")
            .Build();

        if (rule.IsFailure)
        {
            return rule.Error;
        }

        var provider = new Provider
        {
            Id = ProviderId.Create(),
            Type = type!,
            BaseUrl = baseUrl!,
            ApiKeyReference = apiKeyReference!,
            TimeoutMs = timeoutMs!,
            RateLimit = rateLimit!,
            IsActive = true,
            CreatedAtUtc = nowUtc
        };

        provider.Raise(new ProviderConfiguredDomainEvent(
            provider.Id.Value,
            type.Value,
            nowUtc));

        return provider;
    }

    public Result Update(
        BaseUrl newBaseUrl,
        ApiKeyReference newApiKeyReference,
        TimeoutMs newTimeoutMs,
        RateLimitPolicy newRateLimit,
        DateTime nowUtc)
    {
        var rule = Rule.CreateBuilder()
            .ErrorIf(nameof(Provider), newBaseUrl is null, "BaseUrl должен быть указан")
            .ErrorIf(nameof(Provider), newApiKeyReference is null, "ApiKeyReference должен быть указан")
            .ErrorIf(nameof(Provider), newTimeoutMs is null, "TimeoutMs должен быть указан")
            .ErrorIf(nameof(Provider), newRateLimit is null, "RateLimitPolicy должна быть указана")
            .ErrorIf(nameof(Provider), !IsActive, "Нельзя обновлять деактивированный Provider")
            .Build();

        if (rule.IsFailure)
        {
            return rule.Error;
        }

        BaseUrl = newBaseUrl!;
        ApiKeyReference = newApiKeyReference!;
        TimeoutMs = newTimeoutMs!;
        RateLimit = newRateLimit!;

        Raise(new ProviderUpdatedDomainEvent(Id.Value, nowUtc));
        return Result.Success();
    }

    public Result Deactivate(DateTime nowUtc)
    {
        if (!IsActive)
        {
            return ProviderErrors.Disabled(Id);
        }

        IsActive = false;
        DeactivatedAtUtc = nowUtc;
        Raise(new ProviderDeactivatedDomainEvent(Id.Value, nowUtc));
        return Result.Success();
    }

    public Result Activate(DateTime nowUtc)
    {
        if (IsActive)
        {
            return Result.Success();
        }

        IsActive = true;
        DeactivatedAtUtc = null;
        Raise(new ProviderActivatedDomainEvent(Id.Value, nowUtc));
        return Result.Success();
    }

    private IEnumerable<object> GetComparisonValues() => [Id];
}

public partial class Provider : IEquatable<Provider>
{
    public bool Equals(Provider? other)
    {
        if (other is null) return false;
        if (ReferenceEquals(this, other)) return true;
        return GetComparisonValues().SequenceEqual(other.GetComparisonValues());
    }

    public override bool Equals(object? obj) => obj is Provider other && Equals(other);

    public override int GetHashCode()
    {
        var hash = new HashCode();
        foreach (var component in GetComparisonValues())
        {
            hash.Add(component.GetHashCode());
        }
        return hash.ToHashCode();
    }

    public static bool operator ==(Provider? left, Provider? right)
    {
        if (left is null) return right is null;
        return left.Equals(right);
    }

    public static bool operator !=(Provider? left, Provider? right) => !(left == right);
}