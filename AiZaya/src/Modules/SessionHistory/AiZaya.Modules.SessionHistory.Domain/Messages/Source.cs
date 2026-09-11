using AiZaya.Shared.Domain.Abstractions.Interfaces;
using AiZaya.Shared.Domain.Results;

namespace AiZaya.Modules.SessionHistory.Domain.Messages;

/// <summary>
/// Source — источник сообщения/чанка. Определяет целевую Qdrant-коллекцию:
/// значение попадает в payload["source"], QdrantVectorStore читает имя коллекции из него.
/// </summary>
public sealed partial class Source : IValueObject
{
    public const string SessionHistory = "session-history";
    public const string Workspace = "workspace";
    public const string Archive = "archive";
    public const string Import = "import";

    public string Value { get; private set; } = null!;

    private Source()
    {
    }

    public static Rule Validate(string value)
    {
        return Rule.CreateBuilder()
            .ErrorIf(nameof(Source), value is null || !IsKnown(value), "Source должен быть одним из: session-history | workspace | archive | import") 
            .Build();
    }

    public static Result<Source> Create(string value)
    {
        var rule = Validate(value);

        if (rule.IsFailure)
        {
            return rule.Error;
        }

        return new Source { Value = value };
    }

    public static Source SessionHistorySource() => new() { Value = SessionHistory };
    public static Source WorkspaceSource() => new() { Value = Workspace };
    public static Source ArchiveSource() => new() { Value = Archive };
    public static Source ImportSource() => new() { Value = Import };

    private static bool IsKnown(string value) =>
        value == SessionHistory || value == Workspace || value == Archive || value == Import;

    private IEnumerable<object> GetComparisonValues() => [Value];

    public static explicit operator Source(string value) => Create(value).Value!;

    public override string ToString() => Value;
}

public partial class Source : IEquatable<Source>
{
    public bool Equals(Source? other)
    {
        if (other is null) return false;
        return GetComparisonValues().SequenceEqual(other.GetComparisonValues());
    }

    public override bool Equals(object? obj) => obj is Source other && Equals(other);

    public override int GetHashCode() => Value.GetHashCode();

    public static bool operator ==(Source? left, Source? right)
    {
        if (left is null) return right is null;
        return left.Equals(right);
    }

    public static bool operator !=(Source? left, Source? right) => !(left == right);
}