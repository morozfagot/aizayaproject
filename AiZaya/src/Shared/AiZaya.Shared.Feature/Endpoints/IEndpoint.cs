using Microsoft.AspNetCore.Routing;

namespace AiZaya.Shared.Feature.Endpoints;

public interface IEndpoint
{
    void MapEndpoint(IEndpointRouteBuilder endpoint);
}
