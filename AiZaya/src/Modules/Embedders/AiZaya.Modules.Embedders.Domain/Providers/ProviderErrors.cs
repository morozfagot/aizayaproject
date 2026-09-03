using AiZaya.Shared.Domain.Results;

namespace AiZaya.Modules.Embedders.Domain.Providers;

public static class ProviderErrors
{
    private const string Prefix = nameof(Provider);

    public static Error NotFound(ProviderId providerId) =>
        Error.NotFound(
            $"{Prefix}.{nameof(Error.NotFound)}",
            $"Provider с id {providerId} не найден");

    public static Error Disabled(ProviderId providerId) =>
        Error.Failure(
            $"{Prefix}.Disabled",
            $"Provider {providerId} отключён и не может использоваться");

    public static readonly Error InvalidBaseUrlError =
        Rule.CreateError(nameof(BaseUrl),
            "BaseUrl должен быть валидным абсолютным URI с http/https схемой");

    public static readonly Error InvalidApiKeyReferenceError =
        Rule.CreateError(nameof(ApiKeyReference),
            "ApiKeyReference не должен быть пустым и должен соответствовать [A-Z0-9_]{1,64}");

    public static readonly Error InvalidProviderTypeError =
        Rule.CreateError(nameof(ProviderType),
            "ProviderType должен соответствовать [a-z0-9-]{1,32}");
}