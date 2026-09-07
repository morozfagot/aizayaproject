using AiZaya.Shared.Feature.Clock;
using AiZaya.Shared.Feature.Data;
using AiZaya.Shared.Infrastructure.Clock;
using AiZaya.Shared.Infrastructure.Data;
using AiZaya.Shared.Infrastructure.Embeddings;
using AiZaya.Shared.Infrastructure.Outbox;
using AiZaya.Shared.Infrastructure.Qdrant;
using AiZaya.Shared.Infrastructure.Serialization;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Npgsql;
using Quartz;

namespace AiZaya.Shared.Infrastructure;

public static class InfrastructureConfiguration
{
    extension(IServiceCollection services)
    {
        public IServiceCollection AddInfrastructure(string databaseConnectionString, IConfiguration configuration)
        {
            services.TryAddSingleton<IDateTimeProvider, DateTimeProvider>();
            services.TryAddScoped<IDbConnectionFactory, DbConnectionFactory>();
            services.TryAddSingleton<OutboxMessagesInterceptor>();

            var npgsqlDataSource = new NpgsqlDataSourceBuilder(databaseConnectionString).Build();
            services.TryAddSingleton(npgsqlDataSource);

            services.AddQuartz(configurator =>
            {
                var scheduler = Guid.NewGuid();
                configurator.SchedulerId = $"default-id-{scheduler}";
                configurator.SchedulerName = $"default-name-{scheduler}";
            });

            services.AddQuartzHostedService(options => options.WaitForJobsToComplete = true);

            services.AddQdrantInfrastructure(configuration);
            services.AddEmbeddingsInfrastructure();

            return services;
        }
    }

}
