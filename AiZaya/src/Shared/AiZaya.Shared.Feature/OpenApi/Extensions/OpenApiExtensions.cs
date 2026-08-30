using AiZaya.Shared.Feature.OpenApi.Parsers;
using AiZaya.Shared.Feature.OpenApi.Transformers;
using Microsoft.AspNetCore.OpenApi;

namespace AiZaya.Shared.Feature.OpenApi.Extensions;

internal static class OpenApiExtensions
{
    extension(OpenApiOptions config)
    {
        public OpenApiOptions CreateModels(ModelPatternName modelPatternName)
        {
            return config.AddSchemaTransformer(new CreateModelsSchemaTransformer(modelPatternName));
        }

        public OpenApiOptions CreateResponses(ResponsePatternName responsePatternName)
        {
            return config.AddOperationTransformer(new CreateResponsesOperationTransformer(responsePatternName));
        }
    }
}
