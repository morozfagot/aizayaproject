namespace AiZaya.Shared.Feature.OpenApi.Parsers.Attributes;

[AttributeUsage(AttributeTargets.Property)]
internal sealed class EnumValueNumbersAttribute(Type type) : Attribute
{
    public Type Type { get; } = type;
}
