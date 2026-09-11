using AiZaya.Shared.Domain.Results;

namespace AiZaya.Modules.SessionHistory.Domain.Messages;

/// <summary>
/// MessageKind — тип сообщения (структурная форма содержимого).
/// Отличается от MessageRole (кто отправитель): kind описывает форму сообщения.
/// </summary>
public enum MessageKind
{
    Message = 0,
    ToolUse = 1,
    ToolResult = 2
}

/// <summary>
/// Доменный чекер MessageKind: единственный источник правила.
/// </summary>
public static class MessageKindValidator
{
    public static Rule Validate(int value)
    {
        return Rule.CreateBuilder()
            .ErrorIf(nameof(MessageKind), !Enum.IsDefined(typeof(MessageKind), value),
                $"Неизвестное значение MessageKind: {value}. Допустимые: 0 (Message), 1 (ToolUse), 2 (ToolResult)")
            .Build();
    }
}