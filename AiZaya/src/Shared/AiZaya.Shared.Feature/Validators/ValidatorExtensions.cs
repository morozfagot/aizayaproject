using AiZaya.Shared.Domain.Results;
using FluentValidation;
using FluentValidation.Results;

namespace AiZaya.Shared.Feature.Validators;

public static class ValidatorExtensions
{
    /// <summary>
    /// Подключает доменный чекер (Func → Rule) к правилу FluentValidation:
    /// ошибки Rule попадают в validation failures и далее в RuleError pipeline.
    /// </summary>
    public static IRuleBuilderOptionsConditions<T, TElement> Validate<T, TElement>(
        this IRuleBuilder<T, TElement> ruleBuilder,
        Func<TElement, Rule> ruleFactory)
    {
        return ruleBuilder.Custom((value, validationContext) =>
        {
            Rule rule = ruleFactory(value);

            if (rule.IsFailure && rule.Error is RuleError ruleError)
            {
                foreach (var error in ruleError.Errors)
                {
                    validationContext.AddFailure(new ValidationFailure
                    {
                        ErrorCode = error.Code,
                        ErrorMessage = error.Description,
                    });
                }
            }
        });
    }
}
