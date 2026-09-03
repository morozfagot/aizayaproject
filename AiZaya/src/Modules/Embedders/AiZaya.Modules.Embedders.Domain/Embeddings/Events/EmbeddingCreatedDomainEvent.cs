using AiZaya.Shared.Domain.Abstractions;

namespace AiZaya.Modules.Embedders.Domain.Embeddings.Events;

public sealed record EmbeddingCreatedDomainEvent(
    Guid EmbeddingId,
    string Source,
    int Dimension,
    float[] VectorValues,
    string PayloadJson,
    DateTime OccurredOnUtc) : DomainEvent;