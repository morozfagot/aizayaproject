using AiZaya.Shared.Domain.Results;
using AiZaya.Shared.Feature.Results;
using Xunit;
using IResultInterface = AiZaya.Shared.Domain.Results.Interfaces.IResult;

namespace AiZaya.Shared.Feature.UnitTest;

public class ApiResultsTests
{
    [Fact]
    public void Problem_OnSuccess_ShouldThrow()
    {
        IResultInterface result = Result.Success();

        Assert.Throws<InvalidOperationException>(() => ApiResults.Problem(result));
    }

    [Fact]
    public void Problem_OnFailure_ShouldReturnIResult()
    {
        IResultInterface result = Result.Failure(Error.NotFound());

        var problem = ApiResults.Problem(result);

        Assert.NotNull(problem);
    }

    [Fact]
    public void Problem_FailureError_ShouldProduceProblem()
    {
        IResultInterface result = Result.Failure(Error.Failure());

        var problem = ApiResults.Problem(result);

        Assert.NotNull(problem);
    }

    [Fact]
    public void Problem_NotFoundError_ShouldProduceProblem()
    {
        IResultInterface result = Result.Failure(Error.NotFound());

        var problem = ApiResults.Problem(result);

        Assert.NotNull(problem);
    }

    [Fact]
    public void Problem_ConflictError_ShouldProduceProblem()
    {
        IResultInterface result = Result.Failure(Error.Conflict());

        var problem = ApiResults.Problem(result);

        Assert.NotNull(problem);
    }

    [Fact]
    public void Problem_RuleError_ShouldProduceProblem()
    {
        IResultInterface result = Result.Failure(new RuleError([Error.Failure()]));

        var problem = ApiResults.Problem(result);

        Assert.NotNull(problem);
    }
}
