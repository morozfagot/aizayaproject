using AiZaya.Shared.Domain.Results;

namespace AiZaya.Modules.SessionHistory.Domain.Messages;

/// <summary>
/// MessageRole — роль сообщения в диалоге (кто отправитель).
/// assistant_response — ответ модели на запрос пользователя,
/// assistant_message — сообщение модели в рамках потока (например, промежуточное).
/// </summary>
public enum MessageRole
{
    User = 0,
    AssistantResponse = 1,
    AssistantMessage = 2
}

/// <summary>
/// Доменный чекер MessageRole: единственный источник правила.
/// </summary>
public static class MessageRoleValidator
{
    public static Rule Validate(int value)
    {
        return Rule.CreateBuilder()
            .ErrorIf(nameof(MessageRole), !Enum.IsDefined(typeof(MessageRole), value),
                $"Неизвестное значение MessageRole: {value}. Допустимые: 0 (User), 1 (AssistantResponse), 2 (AssistantMessage)")
            .Build();
    }
}