using AiZaya.Shared.Domain.Results.Interfaces;
using CaseExtensions;

namespace AiZaya.Shared.Domain.Results;

public class Rule : IRule
{
    private readonly List<Error> _errors = [];

    public Error Error => IsFailure
        ? new RuleError(_errors.ToArray())
        : throw new InvalidOperationException("Свойство Errors недоступно, если ошибок не зарегистрировано. " +
                                              "Перед обращением к свойству Errors проверьте IsFailure");

    public bool IsFailure => _errors.Count > 0;

    public bool IsSuccess => !IsFailure;

    internal Rule()
    {
    }

    public void AddError(Error error)
    {
        _errors.Add(error);
    }

    public static RuleBuilder CreateBuilder()
    {
        return new RuleBuilder();
    }

    public static Error CreateError(string objectName, string description) =>
        new RuleError([GetError(objectName, description)]);

    public static Error CreateError<TValue>(TValue value, string description) =>
        new RuleError([GetError(value, description)]);

    internal static Error GetError(string objectName, string description) =>
        Error.Rule(GetErrorCode(objectName), description);

    internal static Error GetError<TValue>(TValue value, string description) =>
        Error.Rule(GetErrorCode(value), description);

    private static string GetErrorCode<TValue>(TValue value) =>
        GetValueToPascalCase(value?.GetType().Name.ToPascalCase() ?? string.Empty);

    private static string GetErrorCode(string objectName) => GetValueToPascalCase(objectName);

    private static string GetValueToPascalCase(string value) => value.ToPascalCase();
}
