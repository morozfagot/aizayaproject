namespace AiZaya.Shared.Feature.OpenApi.Parsers.Attributes;

[AttributeUsage(AttributeTargets.Property)]
internal sealed class EnumValueNamesAttribute(Type type) : Attribute
{
    public Type Type { get; } = type;
}
