using AiZaya.Shared.Domain.Results;

namespace AiZaya.Modules.Embedders.Domain.Embeddings;

public static class EmbeddingErrors
{
    private const string Prefix = nameof(Embedding);

    public static readonly Error InvalidVector =
        Rule.CreateError(nameof(EmbeddingVector),
            "EmbeddingVector.Values пустой, содержит NaN/Infinity или длина не соответствует размерности");

    public static readonly Error InvalidPayload =
        Rule.CreateError(nameof(Payload),
            "Payload содержит зарезервированные ключи или имеет невалидный формат");

    public static readonly Error InvalidSourceInfo =
        Rule.CreateError(nameof(SourceInfo),
            "SourceInfo должен быть указан и не быть пустым");
}