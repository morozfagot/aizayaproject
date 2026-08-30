namespace AiZaya.Shared.Feature.OpenApi.Parsers;

internal sealed class Response<TKey>(Dictionary<TKey, Type> map)
    where TKey : notnull
{
    public readonly Dictionary<TKey, Type> Map = map;
}
