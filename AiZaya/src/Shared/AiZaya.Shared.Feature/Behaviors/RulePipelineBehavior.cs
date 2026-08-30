using AiZaya.Shared.Domain.Results;
using AiZaya.Shared.Feature.Messaging;
using FluentValidation;
using FluentValidation.Results;
using MediatR;

namespace AiZaya.Shared.Feature.Behaviors;

/// <summary>
/// Pipeline-валидация для ВСЕХ запросов MediatR (команды и запросы):
/// failures собираются в RuleError → Result.Failure, чтобы ошибка формы
/// payload обрабатывалась единообразно на границе.
/// </summary>
internal sealed class RulePipelineBehavior<TRequest, TResponse>(
    IEnumerable<IValidator<TRequest>> validators)
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : IBaseCommand
{
    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        var validationFailures = await ValidateAsync(request);

        if (validationFailures.Length == 0)
        {
            return await next(cancellationToken);
        }

        var responseType = typeof(TResponse);
        var resultType = typeof(Result);
        var genericResultType = typeof(Result<>);

        if (responseType.IsGenericType && responseType.GetGenericTypeDefinition() == genericResultType)
        {
            var genericType = responseType.GetGenericArguments()[0];
            var failureMethod = genericResultType.MakeGenericType(genericType).GetMethod(nameof(Result<>.Failure));

            if (failureMethod is not null)
            {
                var error = CreateRuleError(validationFailures);

                return (TResponse?)failureMethod.Invoke(null, [error])
                       ?? throw new ValidationException(validationFailures);
            }
        }

        if (responseType == resultType)
        {
            var error = CreateRuleError(validationFailures);
            return (TResponse)(object)Result.Failure(error);
        }

        throw new ValidationException(validationFailures);
    }

    private async Task<ValidationFailure[]> ValidateAsync(TRequest request)
    {
        if (!validators.Any())
        {
            return [];
        }

        var validationContext = new ValidationContext<TRequest>(request);

        var validationResults = await Task.WhenAll(
            validators.Select(v => v.ValidateAsync(validationContext)));

        var validationFailures = validationResults
            .Where(r => !r.IsValid)
            .SelectMany(r => r.Errors)
            .ToArray();

        return validationFailures;
    }

    private static RuleError CreateRuleError(ValidationFailure[] validationFailures) =>
        new(validationFailures.Select(f => Error.Rule(f.ErrorCode, f.ErrorMessage)).ToArray());
}
