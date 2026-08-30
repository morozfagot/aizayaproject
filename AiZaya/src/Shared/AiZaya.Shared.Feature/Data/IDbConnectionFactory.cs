using System.Data.Common;

namespace AiZaya.Shared.Feature.Data;

public interface IDbConnectionFactory
{
    ValueTask<DbConnection> OpenConnectionAsync();
}
