using AiZaya.Shared.Domain.Abstractions;

namespace AiZaya.Modules.SessionHistory.Domain.Chunks.Events;

/// <summary>
/// SessionChunkCreatedDomainEvent — чанк создан (audit trail).
/// Вектор НЕ входит в событие: он transient, передаётся напрямую в Qdrant-хранилище.
/// Хендлер этого события запускает IndexingStartedDomainEvent (единый вызов эмбеддера).
/// </summary>
public sealed record SessionChunkCreatedDomainEvent(
    string SessionId,
    int ChunkIndex,
    string Source,
    string MessageId,
    string ChunkTextHash,
    int Role,
    DateTime CreatedAt) : DomainEvent;