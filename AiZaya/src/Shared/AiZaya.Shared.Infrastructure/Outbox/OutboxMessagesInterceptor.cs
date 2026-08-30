using AiZaya.Shared.Domain.Abstractions.Interfaces;
using AiZaya.Shared.Infrastructure.Serialization;
using Microsoft.EntityFrameworkCore.Diagnostics;
using System.Text.Json;

namespace AiZaya.Shared.Infrastructure.Outbox;

public class OutboxMessagesInterceptor(ISerializerOptions serializerOptions) : SaveChangesInterceptor
{
    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData eventData, InterceptionResult<int> result,
        CancellationToken cancellationToken = new ())
    {
        if (eventData.Context is not null)
        {
            var outboxMessages = eventData.Context
                .ChangeTracker
                .Entries<IAggregateRoot>()
                .SelectMany(entry => entry.Entity.PopDomainEvents())
                .Select(domainEvent =>
                {
                    var type = domainEvent.GetType();

                    return new OutboxMessage
                    {
                        Id = domainEvent.Id,
                        Type = type.Name,
                        Content = JsonSerializer.Serialize(domainEvent, serializerOptions.Default),
                        OccurredOnUtc = domainEvent.OccurredOnUtc
                    };
                })
                .ToList();

            eventData.Context.Set<OutboxMessage>().AddRange(outboxMessages);
        }

        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }
}
