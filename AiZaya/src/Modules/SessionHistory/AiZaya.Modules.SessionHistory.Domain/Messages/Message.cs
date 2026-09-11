using AiZaya.Modules.SessionHistory.Domain.Messages.Events;
using AiZaya.Modules.SessionHistory.Domain.Sessions;
using AiZaya.Shared.Domain.Abstractions;
using AiZaya.Shared.Domain.Results;

namespace AiZaya.Modules.SessionHistory.Domain.Messages;

/// <summary>
/// Message — номинальное сообщение в истории сессии.
/// Append-only: после создания не изменяется. Хранит полный текст + метаданные + роли.
/// Вектор эмбеддинга НЕ хранится (он transient, передаётся в Qdrant-хранилище).
/// </summary>
public sealed partial class Message : AggregateRoot<MessageId>
{
    public SessionId SessionId { get; private set; } = null!;
    public Source Source { get; private set; } = null!;
    public MessageRole Role { get; private set; }
    public MessageKind Kind { get; private set; }
    public Content Content { get; private set; } = null!;
    public Timestamp Timestamp { get; private set; } = null!;
    public Mode? Mode { get; private set; }
    public IReadOnlyList<ToolCall> ToolCalls { get; private set; } = [];
    public ParentMessageId? ParentMessageId { get; private set; }
    public IReadOnlyList<int> IndexedDimensions { get; private set; } = [];
    public IndexingStatus IndexingStatus { get; private set; }
    public DateTime CreatedAt { get; private set; }

    private Message()
    {
    }

    public static Result<Message> Create(
        MessageId id,
        SessionId sessionId,
        Source source,
        MessageRole role,
        MessageKind kind,
        Content content,
        Timestamp timestamp,
        Mode? mode,
        IReadOnlyList<ToolCall>? toolCalls,
        ParentMessageId? parentMessageId)
    {
        var rule = Rule.CreateBuilder()
            .ErrorIf(nameof(MessageId), id is null || string.IsNullOrWhiteSpace(id.Value), "MessageId не может быть пустым")
            .ErrorIf(nameof(SessionId), sessionId is null || string.IsNullOrWhiteSpace(sessionId.Value), "SessionId не может быть пустым")
            .ErrorIf(nameof(Source), source is null || string.IsNullOrWhiteSpace(source.Value), "Source должен быть валидным")
            .ErrorIf(nameof(MessageRole), !Enum.IsDefined(typeof(MessageRole), (int)role), "MessageRole должен быть валидным")
            .ErrorIf(nameof(MessageKind), !Enum.IsDefined(typeof(MessageKind), (int)kind), "MessageKind должен быть валидным")
            .ErrorIf(nameof(Content), content is null || string.IsNullOrWhiteSpace(content.Value), "Content не может быть пустым")
            .ErrorIf(nameof(Timestamp), timestamp is null, "Timestamp должен быть указан")
            .Build();

        if (rule.IsFailure)
        {
            return rule.Error;
        }

        var message = new Message
        {
            Id = id!,
            SessionId = sessionId!,
            Source = source!,
            Role = role,
            Kind = kind,
            Content = content!,
            Timestamp = timestamp!,
            Mode = mode,
            ToolCalls = toolCalls ?? [],
            ParentMessageId = parentMessageId,
            IndexedDimensions = [],
            IndexingStatus = IndexingStatus.Pending,
            CreatedAt = DateTime.UtcNow
        };

        message.Raise(new MessageCreatedDomainEvent(
            message.Id.Value,
            message.SessionId.Value,
            message.Source.Value,
            (int)message.Role,
            (int)message.Kind,
            ComputeContentHash(message.Content.Value),
            message.Timestamp.Value,
            message.Mode?.Value,
            message.ParentMessageId?.Value.Value));

        return message;
    }

    public Result AddIndexedDimension(int dimension)
    {
        if (IndexedDimensions.Contains(dimension))
        {
            return MessageErrors.AlreadyIndexed(Id, dimension);
        }

        var updated = IndexedDimensions.Append(dimension).ToArray();
        IndexedDimensions = updated;
        IndexingStatus = IndexingStatus.Indexed;

        Raise(new MessageIndexedDomainEvent(Id.Value, SessionId.Value, dimension, DateTime.UtcNow));
        Raise(new IndexingCompletedDomainEvent(Id.Value, SessionId.Value, dimension, updated.Length, DateTime.UtcNow));

        return Result.Success();
    }

    public Result RemoveIndexedDimension(int dimension)
    {
        if (!IndexedDimensions.Contains(dimension))
        {
            return Result.Success();
        }

        var updated = IndexedDimensions.Where(d => d != dimension).ToArray();
        IndexedDimensions = updated;
        IndexingStatus = updated.Length == 0 ? IndexingStatus.Pending : IndexingStatus.Indexed;

        return Result.Success();
    }

    public void MarkIndexing() => IndexingStatus = IndexingStatus.Indexing;

    public void MarkError() => IndexingStatus = IndexingStatus.Error;

    private static string ComputeContentHash(string content)
    {
        var bytes = System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(content));
        return Convert.ToHexString(bytes);
    }

    private IEnumerable<object> GetComparisonValues() => [Id];
}

public partial class Message : IEquatable<Message>
{
    public bool Equals(Message? other)
    {
        if (other is null) return false;
        return GetComparisonValues().SequenceEqual(other.GetComparisonValues());
    }

    public override bool Equals(object? obj) => obj is Message other && Equals(other);

    public override int GetHashCode() => Id.GetHashCode();

    public static bool operator ==(Message? left, Message? right)
    {
        if (left is null) return right is null;
        return left.Equals(right);
    }

    public static bool operator !=(Message? left, Message? right) => !(left == right);
}