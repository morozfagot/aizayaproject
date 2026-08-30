namespace AiZaya.Shared.Feature.OpenApi.Parsers.Attributes;

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Property)]
internal sealed class DescriptionAttribute(string description) : Attribute
{
    public string Description { get; } = description;
}
