using AiZaya.Shared.Feature.Data;
using Npgsql;
using System.Data.Common;

namespace AiZaya.Shared.Infrastructure.Data;

internal sealed class DbConnectionFactory(NpgsqlDataSource dataSource) : IDbConnectionFactory
{
    public async ValueTask<DbConnection> OpenConnectionAsync()
    {
        return await dataSource.OpenConnectionAsync();
    }
}
