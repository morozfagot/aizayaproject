using System.Text.Json;
using AiZaya.Shared.Domain.Abstractions;
using AiZaya.Shared.Domain.Results;
using AiZaya.Modules.Embedders.Domain.Embeddings.Events;

namespace AiZaya.Modules.Embedders.Domain.Embeddings;

public sealed partial class Embedding : AggregateRoot<EmbeddingId>
{
    public SourceInfo Source { get; private set; } = null!;
    public EmbeddingVector Vector { get; private set; } = null!;
    public Payload Payload { get; private set; } = null!;
    public DateTime CreatedAtUtc { get; private set; }

    private Embedding()
    {
    }

    public static Result<Embedding> Create(
        SourceInfo source,
        EmbeddingVector vector,
        Payload payload,
        DateTime nowUtc)
    {
        var rule = Rule.CreateBuilder()
            .ErrorIf(nameof(Embedding), source is null, "SourceInfo должен быть указан")
            .ErrorIf(nameof(Embedding), vector is null, "EmbeddingVector должен быть указан")
            .ErrorIf(nameof(Embedding), payload is null, "Payload должен быть указан")
            .Build();

        if (rule.IsFailure)
        {
            return rule.Error;
        }

        var embedding = new Embedding
        {
            Id = EmbeddingId.Create(),
            Source = source!,
            Vector = vector!,
            Payload = payload!,
            CreatedAtUtc = nowUtc
        };

        embedding.Raise(new EmbeddingCreatedDomainEvent(
            embedding.Id.Value,
            embedding.Source.Value,
            embedding.Vector.Values.Count,
            embedding.Vector.Values.ToArray(),
            JsonSerializer.Serialize(embedding.Payload.Values),
            nowUtc));

        return embedding;
    }

    private IEnumerable<object> GetComparisonValues() => [Id];
}

public partial class Embedding : IEquatable<Embedding>
{
    public bool Equals(Embedding? other)
    {
        if (other is null) return false;
        if (ReferenceEquals(this, other)) return true;
        return GetComparisonValues().SequenceEqual(other.GetComparisonValues());
    }

    public override bool Equals(object? obj) => obj is Embedding other && Equals(other);

    public override int GetHashCode()
    {
        var hash = new HashCode();
        foreach (var component in GetComparisonValues())
        {
            hash.Add(component.GetHashCode());
        }
        return hash.ToHashCode();
    }

    public static bool operator ==(Embedding? left, Embedding? right)
    {
        if (left is null) return right is null;
        return left.Equals(right);
    }

    public static bool operator !=(Embedding? left, Embedding? right) => !(left == right);
}