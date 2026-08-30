namespace AiZaya.Shared.Feature.OpenApi.Parsers.Attributes;

[AttributeUsage(AttributeTargets.Property)]
internal sealed class OrderAttribute(int order) : Attribute
{
    public int Order { get; } = order;
}
