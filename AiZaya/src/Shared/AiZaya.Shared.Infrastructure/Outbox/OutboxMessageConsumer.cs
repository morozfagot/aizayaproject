namespace AiZaya.Shared.Infrastructure.Outbox;

public sealed class OutboxMessageConsumer(Guid outboxMessageId, string name)
{
    public Guid OutboxMessageId { get; } = outboxMessageId;

    public string Name { get; } = name;
}
