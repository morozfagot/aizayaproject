namespace AiZaya.Shared.Feature.OpenApi.Parsers;

internal sealed class ResponseBuilder<TKey> where TKey : notnull
{
    private readonly Dictionary<TKey, Type> _map = [];
    public ResponseBuilder<TKey> AddModel<T>(TKey statusCode)
    {
        _map.TryAdd(statusCode, typeof(T));
        return this;
    }

    public Response<TKey> Build()
    {
        return new Response<TKey>(_map);
    }
}
