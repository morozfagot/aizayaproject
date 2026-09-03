using AiZaya.Modules.Embedders.Domain.Providers;

namespace AiZaya.Modules.Embedders.Domain.Embedders;

public interface IEmbedderRepository
{
    Task<Embedder?> FindByIdAsync(EmbedderId id, CancellationToken cancellationToken);

    Task<Embedder?> FindByProviderAndModelAsync(
        ProviderId providerId,
        ModelName modelName,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<Embedder>> ListByProviderAsync(
        ProviderId providerId,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<Embedder>> ListActiveByProviderAsync(
        ProviderId providerId,
        CancellationToken cancellationToken);

    Task AddAsync(Embedder embedder, CancellationToken cancellationToken);

    Task UpdateAsync(Embedder embedder, CancellationToken cancellationToken);
}