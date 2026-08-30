using Microsoft.OpenApi;

namespace AiZaya.Shared.Feature.OpenApi.Parsers.Attributes;

[AttributeUsage( AttributeTargets.Property)]
internal sealed class TypeAttribute(JsonSchemaType type) : Attribute
{
    public JsonSchemaType Type { get; } = type;
}
