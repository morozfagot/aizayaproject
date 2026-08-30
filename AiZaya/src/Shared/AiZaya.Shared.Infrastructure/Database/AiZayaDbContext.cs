using AiZaya.Shared.Domain.Abstractions.Interfaces;
using AiZaya.Shared.Feature.Data;
using AiZaya.Shared.Feature.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace AiZaya.Shared.Infrastructure.Database;

public class AiZayaDbContext<TContext>(
    DbContextOptions<TContext> options) : DbContext(options), IUnitOfWork
    where TContext : DbContext
{
    protected DbSet<T> AggregateRootSet<T>() where T : class, IAggregateRoot => Set<T>();

    protected async Task<int> ConcurrencySaveChangesAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            return await base.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException exception)
        {
            var errors = new List<ConflictError>();

            foreach (var entry in exception.Entries)
            {
                var currentValues = entry.CurrentValues;
                var databaseValues = await entry.GetDatabaseValuesAsync(cancellationToken);
                var primaryKeyProperty = currentValues.Properties.FirstOrDefault(x => x.IsPrimaryKey());
                var tokenProperty = currentValues.Properties.FirstOrDefault(x => x.IsConcurrencyToken);

                if (tokenProperty is not null && primaryKeyProperty is not null && databaseValues is not null)
                {
                    var tokenCurrentValue = currentValues[tokenProperty]?.ToString() ?? string.Empty;
                    var tokenDatabaseValue = databaseValues[tokenProperty]?.ToString() ?? string.Empty;
                    var typeName = entry.Entity.GetType().FullName?.Split('.').LastOrDefault() ?? string.Empty;
                    var primaryKeyValue = currentValues[primaryKeyProperty]?.ToString() ?? string.Empty;

                    var error = new ConflictError
                    {
                        PrimaryKeyValue = primaryKeyValue,
                        TypeName = typeName,
                        TokenValue = tokenCurrentValue,
                        TokenOriginalValue = tokenDatabaseValue
                    };

                    errors.Add(error);
                }
            }

            throw new AiZayaConcurrencyException(errors);
        }
    }
}
