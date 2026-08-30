namespace AiZaya.Shared.Domain.Results;

public record Error(string Code, string Description, ErrorType Type)
{
    private const string General = nameof(General);
    public string TypeName { get; } = Type.ToString();

    public static Error Failure(
        string code = $"{General}.{nameof(Failure)}",
        string description = "Произошла ошибка") =>
        new(code, description, ErrorType.Failure);

    public static Error NotFound(
        string code = $"{General}.{nameof(NotFound)}",
        string description = "Произошла ошибка 'Не найдено'") =>
        new(code, description, ErrorType.NotFound);

    public static Error Conflict(
        string code = $"{General}.{nameof(Conflict)}",
        string description = "Произошла ошибка конфликта") =>
        new(code, description, ErrorType.Conflict);

    public static Error Rule(
        string code = $"{General}.{nameof(Rule)}",
        string description = "Произошла ошибка бизнес-правила") =>
        new(code, description, ErrorType.Rule);
}
