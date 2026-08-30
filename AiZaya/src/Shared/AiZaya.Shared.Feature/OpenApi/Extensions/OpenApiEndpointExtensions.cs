using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;

namespace AiZaya.Shared.Feature.OpenApi.Extensions;

public static class OpenApiEndpointExtensions
{
    extension(IEndpointRouteBuilder endpoints)
    {
        public void MapOpenApi()
        {
            OpenApiEndpointRouteBuilderExtensions.MapOpenApi(endpoints);
        }
    }
}
