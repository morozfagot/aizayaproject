namespace AiZaya.Modules.Embedders.Domain.Providers;

public interface IProviderRepository
{
    Task<Provider?> FindByIdAsync(ProviderId id, CancellationToken cancellationToken);

    Task<Provider?> FindByTypeAsync(ProviderType type, CancellationToken cancellationToken);

    Task<IReadOnlyList<Provider>> ListActiveAsync(CancellationToken cancellationToken);

    Task AddAsync(Provider provider, CancellationToken cancellationToken);

    Task UpdateAsync(Provider provider, CancellationToken cancellationToken);
}