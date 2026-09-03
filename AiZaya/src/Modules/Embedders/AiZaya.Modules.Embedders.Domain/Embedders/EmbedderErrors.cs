using AiZaya.Shared.Domain.Results;

namespace AiZaya.Modules.Embedders.Domain.Embedders;

public static class EmbedderErrors
{
    private const string Prefix = nameof(Embedder);

    public static Error NotFound(EmbedderId embedderId) =>
        Error.NotFound(
            $"{Prefix}.{nameof(Error.NotFound)}",
            $"Embedder {embedderId} не найден");

    public static Error Disabled(EmbedderId embedderId) =>
        Error.Failure(
            $"{Prefix}.Disabled",
            $"Embedder {embedderId} отключён");

    public static readonly Error InvalidProviderId =
        Rule.CreateError("ProviderId", "ProviderId должен быть указан");

    public static readonly Error InvalidModelName =
        Rule.CreateError(nameof(ModelName), "ModelName должен быть указан");

    public static readonly Error InvalidDimension =
        Rule.CreateError(nameof(VectorDimension), "VectorDimension должен быть указан");
}