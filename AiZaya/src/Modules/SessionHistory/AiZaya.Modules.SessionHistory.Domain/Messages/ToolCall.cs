using AiZaya.Shared.Domain.Abstractions.Interfaces;
using AiZaya.Shared.Domain.Results;

namespace AiZaya.Modules.SessionHistory.Domain.Messages;

/// <summary>
/// ToolCall — вызов инструмента, выполненный в рамках сообщения.
/// </summary>
public sealed partial class ToolCall : IValueObject
{
    public string ToolName { get; private set; } = null!;
    public string? Arguments { get; private set; }

    private ToolCall()
    {
    }

    public static Rule Validate(string toolName)
    {
        return Rule.CreateBuilder()
            .ErrorIf(nameof(ToolCall), string.IsNullOrWhiteSpace(toolName), "ToolName не может быть пустым")
            .Build();
    }

    public static Result<ToolCall> Create(string toolName, string? arguments)
    {
        var rule = Validate(toolName);

        if (rule.IsFailure)
        {
            return rule.Error;
        }

        return new ToolCall { ToolName = toolName, Arguments = arguments };
    }

    private IEnumerable<object> GetComparisonValues() => [ToolName, Arguments];

    public override string ToString() => $"ToolCall[{ToolName}]";
}

public partial class ToolCall : IEquatable<ToolCall>
{
    public bool Equals(ToolCall? other)
    {
        if (other is null) return false;
        return GetComparisonValues().SequenceEqual(other.GetComparisonValues());
    }

    public override bool Equals(object? obj) => obj is ToolCall other && Equals(other);

    public override int GetHashCode()
    {
        var hash = new HashCode();
        foreach (var component in GetComparisonValues())
        {
            hash.Add(component?.GetHashCode() ?? 0);
        }
        return hash.ToHashCode();
    }

    public static bool operator ==(ToolCall? left, ToolCall? right)
    {
        if (left is null) return right is null;
        return left.Equals(right);
    }

    public static bool operator !=(ToolCall? left, ToolCall? right) => !(left == right);
}