using Microsoft.OpenApi;

namespace AiZaya.Shared.Feature.OpenApi.Parsers;

internal sealed class ResponseProperty(string name, int order, IOpenApiSchema schema)
{
    public string Name => name;
    public IOpenApiSchema Schema => schema;
    public int Order => order;
}
