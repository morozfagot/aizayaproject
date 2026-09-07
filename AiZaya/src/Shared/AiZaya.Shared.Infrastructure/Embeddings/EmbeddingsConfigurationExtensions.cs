using AiZaya.Shared.Feature.Embeddings;
using Microsoft.Extensions.DependencyInjection;

namespace AiZaya.Shared.Infrastructure.Embeddings;

public static class EmbeddingsConfigurationExtensions
{
    extension(IServiceCollection services)
    {
        /// <summary>
        /// Регистрирует универсальный компонент генерации эмбеддингов.
        /// Используется из use cases SessionHistory / Workspace.
        /// </summary>
        public IServiceCollection AddEmbeddingsInfrastructure()
        {
            services.AddSingleton<IEmbeddingGenerator, EmbeddingGenerator>();
            return services;
        }
    }
}