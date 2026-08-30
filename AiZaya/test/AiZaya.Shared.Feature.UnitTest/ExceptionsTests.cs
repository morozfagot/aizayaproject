using AiZaya.Shared.Domain.Results;
using AiZaya.Shared.Feature.Exceptions;
using Xunit;

namespace AiZaya.Shared.Feature.UnitTest;

public class ExceptionsTests
{
    [Fact]
    public void AiZayaException_ShouldExposeRequestNameAndError()
    {
        var error = Error.Failure();
        var ex = new AiZayaException("MyRequest", error);

        Assert.Equal("MyRequest", ex.RequestName);
        Assert.Same(error, ex.Error);
    }

    [Fact]
    public void AiZayaException_ShouldExposeInnerException()
    {
        var inner = new InvalidOperationException("inner");
        var ex = new AiZayaException("MyRequest", innerException: inner);

        Assert.Same(inner, ex.InnerException);
    }

    [Fact]
    public void AiZayaConcurrencyException_ShouldExposeConflictErrors()
    {
        var conflictErrors = new List<ConflictError>
        {
            new() { PrimaryKeyValue = "1", TypeName = "User" }
        };
        var ex = new AiZayaConcurrencyException(conflictErrors);

        Assert.Single(ex.ConflictErrors);
        Assert.Equal("User", ex.ConflictErrors[0].TypeName);
    }

    [Fact]
    public void ConflictError_DefaultProperties()
    {
        var ce = new ConflictError();

        Assert.Null(ce.PrimaryKeyValue);
        Assert.Null(ce.TypeName);
        Assert.Null(ce.TokenValue);
        Assert.Null(ce.TokenOriginalValue);
    }
}
