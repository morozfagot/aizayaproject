using AiZaya.Shared.Infrastructure.Outbox;
using Microsoft.EntityFrameworkCore;

namespace AiZaya.Shared.Infrastructure.Database;

public static class ModelBuilderExtensions
{
    extension(ModelBuilder builder)
    {
        public void OutboxMessageConfiguration()
        {
            builder.ApplyConfiguration(new OutboxMessageConfiguration());
            builder.ApplyConfiguration(new OutboxMessageConsumerConfiguration());
        }
    }
}
