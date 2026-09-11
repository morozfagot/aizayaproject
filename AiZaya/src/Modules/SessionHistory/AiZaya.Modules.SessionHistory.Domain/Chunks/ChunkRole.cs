using AiZaya.Shared.Domain.Results;

namespace AiZaya.Modules.SessionHistory.Domain.Chunks;

/// <summary>
/// ChunkRole — роль чанка для ранжирования в RRR-поиске.
/// morozcode понижает score для tool_output чанков (TOOL_OUTPUT_PENALTY = 0.15).
/// </summary>
public enum ChunkRole
{
    UserMessage = 0,
    AssistantMessage = 1,
    ToolOutput = 2
}

/// <summary>
/// Доменный чекер ChunkRole: единственный источник правила.
/// </summary>
public static class ChunkRoleValidator
{
    public static Rule Validate(int value)
    {
        return Rule.CreateBuilder()
            .ErrorIf(nameof(ChunkRole), !Enum.IsDefined(typeof(ChunkRole), value),
                $"Неизвестное значение ChunkRole: {value}. Допустимые: 0 (UserMessage), 1 (AssistantMessage), 2 (ToolOutput)")
            .Build();
    }
}