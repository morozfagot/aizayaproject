using AiZaya.Shared.Domain.Results;
using AiZaya.Shared.Feature.Behaviors;
using AiZaya.Shared.Feature.Exceptions;
using AiZaya.Shared.Feature.Messaging;
using FluentValidation;
using MediatR;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace AiZaya.Shared.Feature.UnitTest;

public class BehaviorsTests
{
    public sealed record TestCommand(string Name) : ICommand;

    public sealed class TestCommandValidator : AbstractValidator<TestCommand>
    {
        public TestCommandValidator()
        {
            RuleFor(x => x.Name).NotEmpty();
        }
    }

    [Fact]
    public async Task RulePipeline_WhenValidationFails_ReturnsFailure()
    {
        var validators = new IValidator<TestCommand>[] { new TestCommandValidator() };
        var behavior = new RulePipelineBehavior<TestCommand, Result>(validators);

        var result = await behavior.Handle(
            new TestCommand(""),
            _ => Task.FromResult(Result.Success()),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal(ErrorType.Rule, result.Error.Type);
    }

    [Fact]
    public async Task RulePipeline_WhenValidationPasses_InvokesNext()
    {
        var validators = new IValidator<TestCommand>[] { new TestCommandValidator() };
        var behavior = new RulePipelineBehavior<TestCommand, Result>(validators);

        var result = await behavior.Handle(
            new TestCommand("valid"),
            _ => Task.FromResult(Result.Success()),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
    }

    [Fact]
    public async Task ExceptionPipeline_WhenHandlerThrows_WrapsIntoAiZayaException()
    {
        var logger = NullLogger<ExceptionPipelineBehavior<TestCommand, Result>>.Instance;
        var behavior = new ExceptionPipelineBehavior<TestCommand, Result>(logger);

        var ex = await Assert.ThrowsAsync<AiZayaException>(async () =>
            await behavior.Handle(
                new TestCommand("x"),
                _ => throw new InvalidOperationException("inner"),
                CancellationToken.None));

        Assert.Equal("TestCommand", ex.RequestName);
    }

    [Fact]
    public async Task ExceptionPipeline_WhenHandlerSucceeds_ReturnsResult()
    {
        var logger = NullLogger<ExceptionPipelineBehavior<TestCommand, Result>>.Instance;
        var behavior = new ExceptionPipelineBehavior<TestCommand, Result>(logger);

        var result = await behavior.Handle(
            new TestCommand("x"),
            _ => Task.FromResult(Result.Success()),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
    }
}
