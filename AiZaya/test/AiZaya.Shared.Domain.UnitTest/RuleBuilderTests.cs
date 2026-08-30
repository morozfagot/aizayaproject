using AiZaya.Shared.Domain.Results;
using Xunit;

namespace AiZaya.Shared.Domain.UnitTest;

public class RuleBuilderTests
{
    [Fact]
    public void EmptyRule_ShouldBeSuccess()
    {
        var rule = Rule.CreateBuilder().Build();

        Assert.True(rule.IsSuccess);
        Assert.False(rule.IsFailure);
    }

    [Fact]
    public void ErrorIf_WhenConditionTrue_ShouldAddError()
    {
        var rule = Rule.CreateBuilder()
            .ErrorIf("name", condition: true, description: "boom")
            .Build();

        Assert.True(rule.IsFailure);
    }

    [Fact]
    public void ErrorIf_WhenConditionFalse_ShouldNotAddError()
    {
        var rule = Rule.CreateBuilder()
            .ErrorIf("name", condition: false, description: "boom")
            .Build();

        Assert.True(rule.IsSuccess);
    }

    [Fact]
    public void ErrorIf_WithPredicate_ShouldAddErrorWhenMatches()
    {
        var rule = Rule.CreateBuilder()
            .ErrorIf(value: "", predicate: string.IsNullOrEmpty, description: "empty")
            .Build();

        Assert.True(rule.IsFailure);
    }

    [Fact]
    public void ErrorIf_WithNullPredicate_ShouldThrow()
    {
        var builder = Rule.CreateBuilder();

        Assert.Throws<ArgumentNullException>(() =>
            builder.ErrorIf(value: 0, predicate: null!, description: "x"));
    }

    [Fact]
    public void CascadeStop_ShouldStopAfterFirstError()
    {
        var rule = Rule.CreateBuilder()
            .Cascade(CascadeMode.Stop)
            .ErrorIf("a", true, "first")
            .ErrorIf("b", true, "second")
            .Build();

        Assert.True(rule.IsFailure);
        if (rule.Error is RuleError re)
        {
            Assert.Single(re.Errors);
        }
        else
        {
            Assert.Fail("Expected RuleError");
        }
    }

    [Fact]
    public void CascadeContinue_ShouldCollectAllErrors()
    {
        var rule = Rule.CreateBuilder()
            .Cascade(CascadeMode.Continue)
            .ErrorIf("a", true, "first")
            .ErrorIf("b", true, "second")
            .Build();

        Assert.True(rule.IsFailure);
        if (rule.Error is RuleError re)
        {
            Assert.Equal(2, re.Errors.Count);
        }
    }

    [Fact]
    public void AddError_ShouldAddError()
    {
        var rule = Rule.CreateBuilder()
            .AddError("a", "boom")
            .Build();

        Assert.True(rule.IsFailure);
    }

    [Fact]
    public void CreateError_WithObjectName_ShouldProduceRuleError()
    {
        var error = Rule.CreateError("user", "bad");

        Assert.IsType<RuleError>(error);
    }

    [Fact]
    public void CreateError_WithValue_ShouldProduceRuleError()
    {
        var error = Rule.CreateError(42, "bad");

        Assert.IsType<RuleError>(error);
    }
}
