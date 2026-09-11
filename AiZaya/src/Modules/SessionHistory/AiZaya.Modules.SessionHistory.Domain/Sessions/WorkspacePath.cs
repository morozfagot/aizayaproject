using AiZaya.Shared.Domain.Abstractions.Interfaces;
using AiZaya.Shared.Domain.Results;

namespace AiZaya.Modules.SessionHistory.Domain.Sessions;

/// <summary>
/// WorkspacePath — путь рабочей области, к которой привязана сессия.
/// Имеет смысл только на уровне Session (не Message/Chunk).
/// </summary>
public sealed partial class WorkspacePath : IValueObject
{
    public string Value { get; private set; } = null!;

    private WorkspacePath()
    {
    }

    public static Rule Validate(string value)
    {
        return Rule.CreateBuilder()
            .ErrorIf(nameof(WorkspacePath), string.IsNullOrWhiteSpace(value), "WorkspacePath не может быть пустым")
            .Build();
    }

    public static Result<WorkspacePath> Create(string value)
    {
        var rule = Validate(value);

        if (rule.IsFailure)
        {
            return rule.Error;
        }

        return new WorkspacePath { Value = value };
    }

    /// <summary>
    /// Нормализация для collection naming: lowercase, separators → dashes.
    /// Соответствует morozcode normalizeWorkspacePathForCollection(). 
    /// </summary>
    public string NormalizedForCollection() =>
        Value.ToLower().Replace('\\', '-').Replace('/', '-').Replace(' ', '-');

    private IEnumerable<object> GetComparisonValues() => [Value];

    public static explicit operator WorkspacePath(string value) => Create(value).Value!;

    public override string ToString() => Value;
}

public partial class WorkspacePath : IEquatable<WorkspacePath>
{
    public bool Equals(WorkspacePath? other)
    {
        if (other is null) return false;
        return GetComparisonValues().SequenceEqual(other.GetComparisonValues());
    }

    public override bool Equals(object? obj) => obj is WorkspacePath other && Equals(other);

    public override int GetHashCode() => Value.GetHashCode();

    public static bool operator ==(WorkspacePath? left, WorkspacePath? right)
    {
        if (left is null) return right is null;
        return left.Equals(right);
    }

    public static bool operator !=(WorkspacePath? left, WorkspacePath? right) => !(left == right);
}