namespace AiZaya.Shared.Feature.Exceptions;

public sealed class AiZayaConcurrencyException(List<ConflictError> conflictErrors)
    : Exception("Ошибка конфликта конкурентности")
{
    public List<ConflictError> ConflictErrors { get; } = conflictErrors;
}

public sealed class ConflictError()
{
    public string PrimaryKeyValue { get; set; } = null!;
    public string TypeName { get; set; } = null!;
    public string TokenValue { get; set; } = null!;
    public string TokenOriginalValue { get; set; } = null!;
}
