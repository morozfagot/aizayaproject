using AiZaya.Modules.SessionHistory.Domain.Sessions.Events;
using AiZaya.Shared.Domain.Abstractions;
using AiZaya.Shared.Domain.Results;

namespace AiZaya.Modules.SessionHistory.Domain.Sessions;

/// <summary>
/// Session — агрегат состояния сессии (Pending/Indexing/Indexed/Error).
/// Пересчитывается из сообщений. Привязана к рабочей области (WorkspacePath).
/// </summary>
public sealed partial class Session : AggregateRoot<SessionId>
{
    public WorkspacePath WorkspacePath { get; private set; } = null!;
    public SessionState State { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    private Session()
    {
    }

    public static Result<Session> Create(
        SessionId id,
        WorkspacePath workspacePath)
    {
        var rule = Rule.CreateBuilder()
            .ErrorIf(nameof(SessionId), id is null || string.IsNullOrWhiteSpace(id.Value), "SessionId не может быть пустым")
            .ErrorIf(nameof(WorkspacePath), workspacePath is null || string.IsNullOrWhiteSpace(workspacePath.Value), "WorkspacePath не может быть пустым")
            .Build();

        if (rule.IsFailure)
        {
            return rule.Error;
        }

        var now = DateTime.UtcNow;

        var session = new Session
        {
            Id = id!,
            WorkspacePath = workspacePath!,
            State = SessionState.Pending,
            CreatedAt = now,
            UpdatedAt = now
        };

        return session;
    }

    public Result MarkIndexing()
    {
        if (State == SessionState.Indexing)
        {
            return Result.Success();
        }

        var oldState = State;
        State = SessionState.Indexing;
        UpdatedAt = DateTime.UtcNow;

        Raise(new SessionIndexingStartedDomainEvent(Id.Value, UpdatedAt));

        return Result.Success();
    }

    public Result MarkIndexed(int dimension)
    {
        var oldState = State;
        State = SessionState.Indexed;
        UpdatedAt = DateTime.UtcNow;

        Raise(new SessionIndexedDomainEvent(Id.Value, dimension, UpdatedAt));

        return Result.Success();
    }

    public Result MarkPending()
    {
        if (State == SessionState.Pending)
        {
            return Result.Success();
        }

        State = SessionState.Pending;
        UpdatedAt = DateTime.UtcNow;

        return Result.Success();
    }

    public Result MarkError()
    {
        State = SessionState.Error;
        UpdatedAt = DateTime.UtcNow;

        return Result.Success();
    }

    public Result ClearIndex(int dimension)
    {
        State = SessionState.Pending;
        UpdatedAt = DateTime.UtcNow;

        Raise(new SessionIndexClearedDomainEvent(Id.Value, dimension, UpdatedAt));

        return Result.Success();
    }

    private IEnumerable<object> GetComparisonValues() => [Id];
}

public partial class Session : IEquatable<Session>
{
    public bool Equals(Session? other)
    {
        if (other is null) return false;
        return GetComparisonValues().SequenceEqual(other.GetComparisonValues());
    }

    public override bool Equals(object? obj) => obj is Session other && Equals(other);

    public override int GetHashCode() => Id.GetHashCode();

    public static bool operator ==(Session? left, Session? right)
    {
        if (left is null) return right is null;
        return left.Equals(right);
    }

    public static bool operator !=(Session? left, Session? right) => !(left == right);
}