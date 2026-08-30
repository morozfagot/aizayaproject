namespace AiZaya.Shared.Domain.Results;

public class RuleBuilder
{
    private const string ErrorMessage = "Условие проверки правила не может быть пустым.";

    private readonly Rule rule = new();

    private CascadeMode cascadeMode = CascadeMode.Continue;

    public RuleBuilder()
    {
    }

    public RuleBuilder Cascade(CascadeMode cascadeMode)
    {
        this.cascadeMode = cascadeMode;
        return this;
    }

    public RuleBuilder ErrorIf<TValue>(TValue value, Predicate<TValue> predicate, string description)
    {
        if (predicate is null)
        {
            throw new ArgumentNullException(nameof(predicate), ErrorMessage);
        }

        if (IsCascadeModeStop())
        {
            return this;
        }

        if (predicate(value))
        {
            rule.AddError(Rule.GetError(value, description));
        }

        return this;
    }

    public RuleBuilder ErrorIf<TValue>(string objectName, TValue value, Predicate<TValue> predicate, string description)
    {
        if (predicate is null)
        {
            throw new ArgumentNullException(nameof(predicate), ErrorMessage);
        }

        if (IsCascadeModeStop())
        {
            return this;
        }

        if (predicate(value))
        {
            rule.AddError(Rule.GetError(objectName, description));
        }

        return this;
    }

    public RuleBuilder ErrorIf(string objectName, bool condition, string description)
    {
        if (IsCascadeModeStop())
        {
            return this;
        }

        if (condition)
        {
            rule.AddError(Rule.GetError(objectName, description));
        }

        return this;
    }

    public RuleBuilder AddError(string objectName, string description)
    {
        if (IsCascadeModeStop())
        {
            return this;
        }

        rule.AddError(Rule.GetError(objectName, description));

        return this;
    }

    public Rule Build()
    {
        return rule;
    }

    private bool IsCascadeModeStop() => cascadeMode == CascadeMode.Stop && rule.IsFailure;
}
