using AiZaya.Shared.Infrastructure.Outbox;
using Xunit;

namespace AiZaya.Shared.Infrastructure.UnitTest;

public class OutboxMessageTests
{
    [Fact]
    public void OutboxMessage_DefaultProperties()
    {
        var msg = new OutboxMessage();

        Assert.Equal(Guid.Empty, msg.Id);
        Assert.Equal(string.Empty, msg.Type);
        Assert.Equal(string.Empty, msg.Content);
        Assert.Equal(default, msg.OccurredOnUtc);
        Assert.Null(msg.ProcessedOnUtc);
        Assert.Null(msg.Error);
    }

    [Fact]
    public void OutboxMessage_CanAssignAllProperties()
    {
        var id = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var processed = DateTime.UtcNow.AddSeconds(1);

        var msg = new OutboxMessage
        {
            Id = id,
            Type = "TestType",
            Content = "{\"a\":1}",
            OccurredOnUtc = now,
            ProcessedOnUtc = processed,
            Error = "none"
        };

        Assert.Equal(id, msg.Id);
        Assert.Equal("TestType", msg.Type);
        Assert.Equal("{\"a\":1}", msg.Content);
        Assert.Equal(now, msg.OccurredOnUtc);
        Assert.Equal(processed, msg.ProcessedOnUtc);
        Assert.Equal("none", msg.Error);
    }
}

public class OutboxMessageConsumerTests
{
    [Fact]
    public void OutboxMessageConsumer_StoresProperties()
    {
        var id = Guid.NewGuid();
        var consumer = new OutboxMessageConsumer(id, "MyHandler");

        Assert.Equal(id, consumer.OutboxMessageId);
        Assert.Equal("MyHandler", consumer.Name);
    }
}
