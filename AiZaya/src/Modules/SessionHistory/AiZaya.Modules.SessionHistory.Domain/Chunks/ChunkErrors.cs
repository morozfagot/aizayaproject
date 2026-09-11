using AiZaya.Shared.Domain.Results;

namespace AiZaya.Modules.SessionHistory.Domain.Chunks;

public static class ChunkErrors
{
    private const string Prefix = nameof(Chunk);

    public static Error NotFound(ChunkId chunkId) =>
        Error.NotFound(
            $"{Prefix}.{nameof(Error.NotFound)}",
            $"Чанк {chunkId} не найден");

    public static readonly Error NoisyContent =
        Rule.CreateError(nameof(Chunk), "Content является шумом и не может быть проиндексирован");
}
