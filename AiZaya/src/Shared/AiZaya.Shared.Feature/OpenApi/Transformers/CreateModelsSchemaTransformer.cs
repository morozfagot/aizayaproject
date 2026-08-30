using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;
using System.Text.RegularExpressions;

namespace AiZaya.Shared.Feature.OpenApi.Transformers;

public delegate string ModelPatternName(string feature, string action, string model);

internal sealed class CreateModelsSchemaTransformer(ModelPatternName modelPatternName)
    : IOpenApiSchemaTransformer
{

    public Task TransformAsync(OpenApiSchema schema, OpenApiSchemaTransformerContext context, CancellationToken cancellationToken)
    {
        if (context.JsonTypeInfo.Type.IsValueType ||
            context.JsonTypeInfo.Type == typeof(String) ||
            context.JsonTypeInfo.Type == typeof(string))
        {
            return Task.CompletedTask;
        }

        if (schema.Metadata == null || !schema.Metadata.TryGetValue("x-schema-id", out object? _))
        {
            return Task.CompletedTask;
        }

        if (context.JsonTypeInfo.Type.FullName is not null)
        {
            var pattern = @"\.([^.]+)\.([^+\.]+)\+([^\.]+)$";
            var match = Regex.Match(context.JsonTypeInfo.Type.FullName, pattern, RegexOptions.Compiled);

            if (match.Success)
            {
                var feature = match.Groups[1].Value;
                var action = match.Groups[2].Value;
                var model = match.Groups[3].Value;

                var schemaId = modelPatternName(feature, action, model);

                schema.Metadata["x-schema-id"] = schemaId;
                schema.Title = schemaId;
            }
        }

        return Task.CompletedTask;
    }
}
