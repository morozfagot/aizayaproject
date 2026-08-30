using AiZaya.Shared.Domain.Abstractions;
using AiZaya.Shared.Domain.Abstractions.Interfaces;
using AiZaya.Shared.Domain.Results;
using AiZaya.Shared.Feature.Messaging;
using MediatR;
using Xunit;

namespace AiZaya.Shared.Feature.UnitTest;

public class MessagingTests
{
    public record TestDomainEvent(string Payload) : DomainEvent;

    public sealed class TestDomainEventHandler
        : DomainEventHandler<TestDomainEvent>
    {
        public TestDomainEventPayload? Captured { get; private set; }

        public override Task Handle(TestDomainEvent domainEvent, CancellationToken cancellationToken = default)
        {
            Captured = new TestDomainEventPayload(domainEvent.Payload);
            return Task.CompletedTask;
        }
    }

    public sealed record TestDomainEventPayload(string Payload);

    [Fact]
    public async Task DomainEventHandler_HandleViaBaseInterface_DispatchesToTypedMethod()
    {
        var handler = new TestDomainEventHandler();
        IDomainEvent evt = new TestDomainEvent("hello");

        await handler.Handle(evt);

        Assert.NotNull(handler.Captured);
        Assert.Equal("hello", handler.Captured!.Payload);
    }

    [Fact]
    public async Task DomainEventHandler_HandleViaTypedInterface_DispatchesToTypedMethod()
    {
        var handler = new TestDomainEventHandler();
        var evt = new TestDomainEvent("typed");

        await handler.Handle(evt);

        Assert.Equal("typed", handler.Captured!.Payload);
    }
}

public class CommandInterfaceTests
{
    private sealed record TestCommand : ICommand;

    [Fact]
    public void ICommand_IsAlsoRequestOfResult()
    {
        var cmd = new TestCommand();
        IRequest<Result> asRequest = cmd;

        Assert.NotNull(asRequest);
    }

    private sealed record TestCommandWithResult : ICommand<string>;

    [Fact]
    public void ICommandWithResponse_IsAlsoRequestOfResultT()
    {
        var cmd = new TestCommandWithResult();
        IRequest<Result<string>> asRequest = cmd;

        Assert.NotNull(asRequest);
    }
}

public class QueryInterfaceTests
{
    private sealed record TestQuery : IQuery<int>;

    [Fact]
    public void IQuery_IsRequestOfResultT()
    {
        var q = new TestQuery();
        IRequest<Result<int>> asRequest = q;

        Assert.NotNull(asRequest);
    }
}
