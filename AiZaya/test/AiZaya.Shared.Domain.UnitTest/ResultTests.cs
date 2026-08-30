using AiZaya.Shared.Domain.Results;
using Xunit;

namespace AiZaya.Shared.Domain.UnitTest;

public class ResultTests
{
    [Fact]
    public void Success_ShouldBeSuccessWithoutError()
    {
        var result = Result.Success();

        Assert.True(result.IsSuccess);
        Assert.False(result.IsFailure);
    }

    [Fact]
    public void Failure_ShouldBeFailureWithError()
    {
        var error = Error.Failure();
        var result = Result.Failure(error);

        Assert.True(result.IsFailure);
        Assert.False(result.IsSuccess);
        Assert.Equal(error, result.Error);
    }

    [Fact]
    public void Failure_AccessingError_ShouldNotThrow()
    {
        var result = Result.Failure(Error.NotFound());

        var error = result.Error;

        Assert.Equal(ErrorType.NotFound, error.Type);
    }

    [Fact]
    public void Success_AccessingError_ShouldThrow()
    {
        var result = Result.Success();

        Assert.Throws<InvalidOperationException>(() => result.Error);
    }

    [Fact]
    public void ImplicitConversion_FromError_ShouldProduceFailure()
    {
        Result result = Error.Conflict();

        Assert.True(result.IsFailure);
        Assert.Equal(ErrorType.Conflict, result.Error.Type);
    }

    [Fact]
    public void ImplicitConversion_ToBool_ShouldReturnIsSuccess()
    {
        Result success = Result.Success();
        Result failure = Result.Failure(Error.Failure());

        Assert.True((bool)success);
        Assert.False((bool)failure);
    }
}

public class ResultTValueTests
{
    [Fact]
    public void Success_ShouldExposeValue()
    {
        var result = Result<int>.Success(42);

        Assert.True(result.IsSuccess);
        Assert.Equal(42, result.Value);
    }

    [Fact]
    public void Failure_AccessingValue_ShouldThrow()
    {
        var result = Result<int>.Failure(Error.NotFound());

        Assert.Throws<InvalidOperationException>(() => result.Value);
    }

    [Fact]
    public void ImplicitConversion_FromValue_ShouldProduceSuccess()
    {
        Result<int> result = 100;

        Assert.True(result.IsSuccess);
        Assert.Equal(100, result.Value);
    }
}
