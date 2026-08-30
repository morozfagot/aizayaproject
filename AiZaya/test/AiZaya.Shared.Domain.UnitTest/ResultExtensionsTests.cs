using AiZaya.Shared.Domain.Results;
using Xunit;

namespace AiZaya.Shared.Domain.UnitTest;

public class ResultExtensionsTests
{
    [Fact]
    public void Match_OnSuccess_ShouldInvokeOnSuccess()
    {
        var result = Result.Success();

        var outcome = result.Match(
            onSuccess: () => "ok",
            onFailure: r => "fail");

        Assert.Equal("ok", outcome);
    }

    [Fact]
    public void Match_OnFailure_ShouldInvokeOnFailure()
    {
        var result = Result.Failure(Error.NotFound());

        var outcome = result.Match(
            onSuccess: () => "ok",
            onFailure: r => r.Error.Code);

        Assert.Equal("General.NotFound", outcome);
    }

    [Fact]
    public void MatchTyped_OnSuccess_ShouldPassValue()
    {
        var result = Result<int>.Success(7);

        var outcome = result.Match(
            onSuccess: v => v * 2,
            onFailure: _ => -1);

        Assert.Equal(14, outcome);
    }

    [Fact]
    public void MatchTyped_OnFailure_ShouldInvokeOnFailure()
    {
        var result = Result<int>.Failure(Error.Conflict());

        var outcome = result.Match(
            onSuccess: v => v,
            onFailure: _ => 0);

        Assert.Equal(0, outcome);
    }
}
