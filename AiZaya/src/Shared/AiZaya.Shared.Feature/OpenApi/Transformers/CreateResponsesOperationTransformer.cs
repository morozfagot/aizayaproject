using AiZaya.Shared.Feature.OpenApi.Models;
using AiZaya.Shared.Feature.OpenApi.Parsers;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;

namespace AiZaya.Shared.Feature.OpenApi.Transformers;

internal sealed class CreateResponsesOperationTransformer : IOpenApiOperationTransformer
{
    private bool _schemasCreated;
    private readonly ResponseParser<int> _responseParser;

    public CreateResponsesOperationTransformer(ResponsePatternName responsePatternName)
    {
        var response = new ResponseBuilder<int>()
            .AddModel<ResponseNoContent>(StatusCodes.Status204NoContent)
            .AddModel<ResponseBadRequest>(StatusCodes.Status400BadRequest)
            .AddModel<ResponseNotFound>(StatusCodes.Status404NotFound)
            .AddModel<ResponseUnprocessableEntity>(StatusCodes.Status422UnprocessableEntity)
            .AddModel<ResponseInternalServerError>(StatusCodes.Status500InternalServerError)
            .AddModel<ResponseConflict>(StatusCodes.Status409Conflict)
            .AddModel<ResponseError>(0)
            .Build();

        _responseParser = new ResponseParser<int>(response, responsePatternName);
    }

    public Task TransformAsync(OpenApiOperation operation, OpenApiOperationTransformerContext context,
        CancellationToken cancellationToken)
    {
        if (!_schemasCreated)
        {
            _schemasCreated = true;

            var schemas = context.Document?.Components?.Schemas;

            if (schemas is not null)
            {
                foreach (var schema in _responseParser.GetMapOpenApiSchema().Where(x => x.Value.Title is not null)
                             .OrderBy(x => x.Key)
                             .Select(x => x.Value))
                {
                    schemas.TryAdd(schema.Title!, schema);
                }
            }
        }

        var openApiResponses = operation.Responses;
        var mapResponse = _responseParser.GetMapOpenApiResponse();

        if (openApiResponses is not null)
        {
            var statusCodes = context.Description.SupportedResponseTypes
                .Select(x => x.StatusCode);

            foreach (var statusCode in statusCodes)
            {
                if (mapResponse.TryGetValue(statusCode, out var openApiResponse))
                {
                    var key = $"{statusCode}";
                    openApiResponses[key] = openApiResponse;
                }
            }
        }

        return Task.CompletedTask;
    }
}
