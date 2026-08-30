namespace AiZaya.Shared.Domain.Results;

public sealed record RuleError : Error
{
    private readonly Error[] _errors = [];

    public IReadOnlyList<Error> Errors => _errors.AsReadOnly();

    public RuleError(Error[] errors) : base(
        $"General.{nameof(ErrorType.Rule)}",
        "Одна или несколько ошибок в бизнес-правилах",
        ErrorType.Rule
    )
    {
        _errors = errors;
    }
}
