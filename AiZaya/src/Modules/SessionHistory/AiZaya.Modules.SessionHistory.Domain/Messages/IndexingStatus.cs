using AiZaya.Shared.Domain.Results;

namespace AiZaya.Modules.SessionHistory.Domain.Messages;

/// <summary>
/// IndexingStatus — статус индексации сообщения относительно текущей размерности.
/// UI индикаторы: серый/желтый/зеленый/красный.
/// </summary>
public enum IndexingStatus
{
    Pending = 0,
    Indexing = 1,
    Indexed = 2,
    Error = 3
}

/// <summary>
/// Доменный чекер IndexingStatus: единственный источник правила.
/// </summary>
public static class IndexingStatusValidator
{
    public static Rule Validate(int value)
    {
        return Rule.CreateBuilder()
            .ErrorIf(nameof(IndexingStatus), !Enum.IsDefined(typeof(IndexingStatus), value),
                $"Неизвестное значение IndexingStatus: {value}. Допустимые: 0 (Pending), 1 (Indexing), 2 (Indexed), 3 (Error)")
            .Build();
    }
}