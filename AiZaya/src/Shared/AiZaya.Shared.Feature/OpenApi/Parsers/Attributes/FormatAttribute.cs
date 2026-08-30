namespace AiZaya.Shared.Feature.OpenApi.Parsers.Attributes;

[AttributeUsage(AttributeTargets.Property)]
internal sealed class FormatAttribute(string format) : Attribute
{
    public string Format { get; } = format;
}
