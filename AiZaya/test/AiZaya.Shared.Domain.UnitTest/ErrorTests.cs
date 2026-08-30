using AiZaya.Shared.Domain.Results;
using Xunit;

namespace AiZaya.Shared.Domain.UnitTest;

public class ErrorTests
{
    [Fact]
    public void Failure_ShouldHaveFailureType()
    {
        var error = Error.Failure();

        Assert.Equal(ErrorType.Failure, error.Type);
        Assert.Equal("General.Failure", error.Code);
    }

    [Fact]
    public void NotFound_ShouldHaveNotFoundType()
    {
        var error = Error.NotFound();

        Assert.Equal(ErrorType.NotFound, error.Type);
    }

    [Fact]
    public void Conflict_ShouldHaveConflictType()
    {
        var error = Error.Conflict();

        Assert.Equal(ErrorType.Conflict, error.Type);
    }

    [Fact]
    public void Rule_ShouldHaveRuleType()
    {
        var error = Error.Rule();

        Assert.Equal(ErrorType.Rule, error.Type);
    }

    [Fact]
    public void TypeName_ShouldMatchEnumName()
    {
        var error = Error.NotFound();

        Assert.Equal("NotFound", error.TypeName);
    }

    [Fact]
    public void CustomCode_ShouldBeStored()
    {
        var error = Error.Failure("Custom.Code", "Custom desc");

        Assert.Equal("Custom.Code", error.Code);
        Assert.Equal("Custom desc", error.Description);
    }
}

public class RuleErrorTests
{
    [Fact]
    public void RuleError_ShouldExposeInnerErrors()
    {
        var inner = new Error[]
        {
            Error.Failure("E1", "d1"),
            Error.Failure("E2", "d2")
        };
        var ruleError = new RuleError(inner);

        Assert.Equal(ErrorType.Rule, ruleError.Type);
        Assert.Equal(2, ruleError.Errors.Count);
        Assert.Equal("E1", ruleError.Errors[0].Code);
    }
}
