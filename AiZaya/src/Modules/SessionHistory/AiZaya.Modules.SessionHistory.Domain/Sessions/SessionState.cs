using AiZaya.Shared.Domain.Results;

namespace AiZaya.Modules.SessionHistory.Domain.Sessions;

/// <summary>
/// SessionState — агрегированное состояние сессии.
/// UI цвета: Pending (серый), Indexing (желтый), Indexed (зеленый), Error (красный).
/// </summary>
public enum SessionState
{
    Pending = 0,
    Indexing = 1,
    Indexed = 2,
    Error = 3
}

/// <summary>
/// Доменный чекер SessionState: единственный источник правила.
/// </summary>
public static class SessionStateValidator
{
    public static Rule Validate(int value)
    {
        return Rule.CreateBuilder()
            .ErrorIf(nameof(SessionState), !Enum.IsDefined(typeof(SessionState), value),
                $"Неизвестное значение SessionState: {value}. Допустимые: 0 (Pending), 1 (Indexing), 2 (Indexed), 3 (Error)")
            .Build();
    }
}