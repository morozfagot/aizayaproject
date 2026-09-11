using AiZaya.Modules.SessionHistory.Domain.Sessions;
using AiZaya.Shared.Domain.Abstractions.Interfaces;
using AiZaya.Shared.Domain.Results;

namespace AiZaya.Modules.SessionHistory.Domain.Chunks;

/// <summary>
/// ChunkId — композитный идентификатор чанка: SessionId + ChunkIndex.
/// Уникальный ключ для Chunk AR + Qdrant pointId.
/// </summary>
public sealed partial class ChunkId : IValueObject
{
    public SessionId SessionId { get; private set; } = null!;
    public ChunkIndex ChunkIndex { get; private set; } = null!;

    private ChunkId()
    {
    }

    public static Result<ChunkId> Create(SessionId sessionId, ChunkIndex chunkIndex)
    {
        if (sessionId is null || chunkIndex is null)
        {
            return Rule.CreateError(nameof(ChunkId), "SessionId и ChunkIndex должны быть указаны");
        }

        return new ChunkId { SessionId = sessionId, ChunkIndex = chunkIndex };
    }

    private IEnumerable<object> GetComparisonValues() => [SessionId, ChunkIndex];

    public override string ToString() => $"{SessionId}_{ChunkIndex}";
}

public partial class ChunkId : IEquatable<ChunkId>
{
    public bool Equals(ChunkId? other)
    {
        if (other is null) return false;
        return GetComparisonValues().SequenceEqual(other.GetComparisonValues());
    }

    public override bool Equals(object? obj) => obj is ChunkId other && Equals(other);

    public override int GetHashCode()
    {
        var hash = new HashCode();
        foreach (var component in GetComparisonValues())
        {
            hash.Add(component.GetHashCode());
        }
        return hash.ToHashCode();
    }

    public static bool operator ==(ChunkId? left, ChunkId? right)
    {
        if (left is null) return right is null;
        return left.Equals(right);
    }

    public static bool operator !=(ChunkId? left, ChunkId? right) => !(left == right);
}