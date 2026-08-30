namespace AiZaya.Shared.Feature.OpenApi.Parsers.Attributes;

[AttributeUsage(AttributeTargets.Class)]
internal sealed class TitleAttribute(string title) : Attribute
{
    public string Title { get; } = title;
}
